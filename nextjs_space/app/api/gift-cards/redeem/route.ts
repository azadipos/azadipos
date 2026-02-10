export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Redeem/use gift card balance
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
    
    if (!giftCard.isActive) {
      return NextResponse.json({ error: "Gift card is inactive" }, { status: 400 });
    }
    
    if (!giftCard.purchasedAt) {
      return NextResponse.json({ error: "Gift card has not been activated yet" }, { status: 400 });
    }
    
    const amountToRedeem = Math.min(parseFloat(amount), giftCard.balance);
    
    if (amountToRedeem <= 0) {
      return NextResponse.json({ error: "No balance remaining on gift card" }, { status: 400 });
    }
    
    const newBalance = Math.round((giftCard.balance - amountToRedeem) * 100) / 100;
    
    // Update gift card balance and create usage record
    const [updated] = await Promise.all([
      prisma.giftCard.update({
        where: { barcode },
        data: {
          balance: newBalance,
          isActive: newBalance > 0,
        },
      }),
      prisma.giftCardUsage.create({
        data: {
          giftCardId: giftCard.id,
          transactionId: transactionId || null,
          amount: amountToRedeem,
          balanceAfter: newBalance,
        },
      }),
    ]);
    
    return NextResponse.json({
      ...updated,
      amountRedeemed: amountToRedeem,
      remainingBalance: newBalance,
    });
  } catch (error) {
    console.error("Error redeeming gift card:", error);
    return NextResponse.json({ error: "Failed to redeem gift card" }, { status: 500 });
  }
}
