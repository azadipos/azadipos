import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true } },
        items: true,
      },
    });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Get transaction error:", error);
    return NextResponse.json({ error: "Failed to get transaction" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status, type } = body;
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (type) updateData.type = type;
    
    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data: updateData,
    });
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const authorizedByEmployeeId = searchParams.get("authorizedBy");
    const reason = searchParams.get("reason") || "Deleted by admin";
    const source = searchParams.get("source") || "admin"; // "admin" or "pos"
    
    // Get the transaction first
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { items: true, employee: true },
    });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    
    // Get authorized employee name if provided
    let authorizedByName: string | null = null;
    if (authorizedByEmployeeId) {
      const authorizedBy = await prisma.employee.findUnique({
        where: { id: authorizedByEmployeeId },
        select: { name: true },
      });
      authorizedByName = authorizedBy?.name || null;
    }
    
    // Instead of hard delete, mark as voided
    const updatedTransaction = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        status: "deleted",
        type: "void",
        authorizedByEmployeeId: authorizedByEmployeeId || undefined,
      },
    });
    
    // ONLY restore inventory for POS voids/refunds, NOT admin deletes
    // Admin deletes are for audit cleanup, not operational voids
    if (source === "pos" && transaction.type === "sale") {
      for (const item of transaction.items) {
        await prisma.item.update({
          where: { id: item.itemId },
          data: {
            quantityOnHand: { increment: Math.abs(item.quantity) },
          },
        });
      }
    }
    
    // Create audit trail entry - CRITICAL for legal compliance
    let auditTrailCreated = false;
    let auditTrailError: string | null = null;
    
    try {
      const auditEntry = await prisma.auditTrail.create({
        data: {
          companyId: transaction.companyId,
          action: source === "admin" ? "DELETE_TRANSACTION" : "VOID",
          entityType: "transaction",
          entityId: transaction.id,
          description: `Transaction #${transaction.transactionNumber} ${source === "admin" ? 'deleted' : 'voided'}: ${reason}`,
          employeeId: transaction.employeeId || null,
          employeeName: transaction.employee?.name || null,
          authorizedById: authorizedByEmployeeId || null,
          authorizedByName: authorizedByName,
          metadata: JSON.stringify({
            total: transaction.total,
            type: transaction.type,
            paymentMethod: transaction.paymentMethod,
            source,
            reason,
            itemCount: transaction.items.length,
            transactionNumber: transaction.transactionNumber,
            transactionDate: transaction.createdAt?.toISOString() || null,
          }),
        },
      });
      auditTrailCreated = true;
      console.log("Audit trail entry created:", auditEntry.id);
    } catch (auditError: any) {
      console.error("Failed to create audit trail entry:", auditError);
      auditTrailError = auditError?.message || "Unknown error";
      // Don't fail the whole operation, but log the error
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Transaction voided successfully",
      transaction: updatedTransaction,
      auditTrailCreated,
      auditTrailError,
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
