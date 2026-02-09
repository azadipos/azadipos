import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barcode, transactionId } = body;
    
    if (!barcode) {
      return NextResponse.json({ error: "Barcode required" }, { status: 400 });
    }
    
    // Find the store credit
    const credit = await prisma.storeCredit.findUnique({
      where: { barcode },
    });
    
    if (!credit) {
      return NextResponse.json({ error: "Store credit not found" }, { status: 404 });
    }
    
    if (credit.isUsed) {
      return NextResponse.json({ 
        error: "Store credit already used",
        usedAt: credit.usedAt 
      }, { status: 400 });
    }
    
    // Mark as used
    const updatedCredit = await prisma.storeCredit.update({
      where: { id: credit.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        redeemedTransactionId: transactionId || null,
      },
    });
    
    return NextResponse.json({
      success: true,
      amount: updatedCredit.amount,
      barcode: updatedCredit.barcode,
    });
  } catch (error) {
    console.error("Redeem store credit error:", error);
    return NextResponse.json({ error: "Failed to redeem store credit" }, { status: 500 });
  }
}
