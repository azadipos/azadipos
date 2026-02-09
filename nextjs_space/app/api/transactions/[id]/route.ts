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
    
    // Get the transaction first
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
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
    
    // Restore inventory for voided transaction items (if it was a sale)
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
    
    return NextResponse.json({ 
      success: true, 
      message: "Transaction voided successfully",
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
