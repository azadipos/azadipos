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
    
    // For admin deletions, we TRULY delete the transaction
    // For POS voids, we mark as voided (keeps record for shift reconciliation)
    if (source === "admin") {
      // Create audit trail entry BEFORE deletion - CRITICAL for legal compliance
      let auditTrailCreated = false;
      let auditTrailError: string | null = null;
      
      try {
        const auditEntry = await prisma.auditTrail.create({
          data: {
            companyId: transaction.companyId,
            action: "DELETE_TRANSACTION",
            entityType: "transaction",
            entityId: transaction.id,
            description: `Transaction #${transaction.transactionNumber} permanently deleted: ${reason}`,
            employeeId: transaction.employeeId || null,
            employeeName: transaction.employee?.name || null,
            authorizedById: authorizedByEmployeeId || null,
            authorizedByName: authorizedByName,
            metadata: JSON.stringify({
              total: transaction.total,
              subtotal: transaction.subtotal,
              tax: transaction.tax,
              type: transaction.type,
              paymentMethod: transaction.paymentMethod,
              source,
              reason,
              itemCount: transaction.items.length,
              transactionNumber: transaction.transactionNumber,
              transactionDate: transaction.createdAt?.toISOString() || null,
              items: transaction.items.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
              })),
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
      
      // Restore inventory for sales that are being deleted
      if (transaction.type === "sale" && transaction.status !== "deleted") {
        for (const item of transaction.items) {
          await prisma.item.update({
            where: { id: item.itemId },
            data: {
              quantityOnHand: { increment: Math.abs(item.quantity) },
            },
          });
        }
      }
      
      // For refunds that are being deleted, deduct the inventory back
      if (transaction.type === "refund") {
        for (const item of transaction.items) {
          await prisma.item.update({
            where: { id: item.itemId },
            data: {
              quantityOnHand: { decrement: Math.abs(item.quantity) },
            },
          });
        }
      }
      
      // TRULY delete the transaction and its items (cascade handles items)
      await prisma.transaction.delete({
        where: { id: params.id },
      });
      
      return NextResponse.json({ 
        success: true, 
        message: "Transaction permanently deleted",
        deleted: true,
        auditTrailCreated,
        auditTrailError,
      });
    } else {
      // POS void - mark as voided but keep the record
      const updatedTransaction = await prisma.transaction.update({
        where: { id: params.id },
        data: {
          status: "deleted",
          type: "void",
          authorizedByEmployeeId: authorizedByEmployeeId || undefined,
        },
      });
      
      // Restore inventory for voided sales
      if (transaction.type === "sale") {
        for (const item of transaction.items) {
          await prisma.item.update({
            where: { id: item.itemId },
            data: {
              quantityOnHand: { increment: Math.abs(item.quantity) },
            },
          });
        }
      }
      
      // Create audit trail entry for void
      let auditTrailCreated = false;
      let auditTrailError: string | null = null;
      
      try {
        const auditEntry = await prisma.auditTrail.create({
          data: {
            companyId: transaction.companyId,
            action: "VOID",
            entityType: "transaction",
            entityId: transaction.id,
            description: `Transaction #${transaction.transactionNumber} voided: ${reason}`,
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
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Transaction voided successfully",
        transaction: updatedTransaction,
        auditTrailCreated,
        auditTrailError,
      });
    }
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
