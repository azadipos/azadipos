export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await req.json();
    const { transactionId } = data;
    
    const giftCard = await prisma.giftCard.update({
      where: { id: params.id },
      data: {
        purchasedAt: new Date(),
        purchaseTransactionId: transactionId || null,
      },
    });
    
    return NextResponse.json(giftCard);
  } catch (error) {
    console.error("Error activating gift card:", error);
    return NextResponse.json({ error: "Failed to activate gift card" }, { status: 500 });
  }
}
