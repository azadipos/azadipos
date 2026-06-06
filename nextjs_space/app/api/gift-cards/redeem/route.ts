export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { barcode, amount, transactionId } = data;
    
    if (!barcode || !amount) {
      return NextResponse.json({ error: "barcode and amount required" }, { status: 400 });
    }
    
    const giftCard = await prisma.giftCard.findUnique({
      where: { barcode },
    });
    
    if (!giftCard) {
      return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
    }
    
    if (!giftCard.purchasedAt) {
      return NextResponse.json({ error: "Gift card not yet activated" }, { status: 400 });
    }
    
    if (!giftCard.isActive) {
      return NextResponse.json({ error: "Gift card is inactive" }, { status: 400 });
    }
    
    const redeemAmount = Math.min(parseFloat(String(amount)), giftCard.balance);
    const newBalance = Math.max(0, giftCard.balance - redeemAmount);
    
    // Update balance and create usage record
    const [updatedCard] = await prisma.$transaction([
      prisma.giftCard.update({
        where: { barcode },
        data: { balance: newBalance },
      }),
      prisma.giftCardUsage.create({
        data: {
          giftCardId: giftCard.id,
          transactionId: transactionId || null,
          amount: redeemAmount,
          balanceAfter: newBalance,
        },
      }),
    ]);
    
    return NextResponse.json({
      success: true,
      redeemedAmount: redeemAmount,
      remainingBalance: newBalance,
      giftCard: updatedCard,
    });
  } catch (error) {
    console.error("Error redeeming gift card:", error);
    return NextResponse.json({ error: "Failed to redeem gift card" }, { status: 500 });
  }
}
