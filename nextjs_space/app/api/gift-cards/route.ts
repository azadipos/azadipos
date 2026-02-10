export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const barcode = searchParams.get("barcode");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    // Lookup by barcode
    if (barcode) {
      const giftCard = await prisma.giftCard.findUnique({
        where: { barcode },
        include: { usageHistory: { orderBy: { createdAt: "desc" } } },
      });
      
      if (!giftCard || giftCard.companyId !== companyId) {
        return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
      }
      
      return NextResponse.json(giftCard);
    }
    
    // Get all gift cards
    const giftCards = await prisma.giftCard.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(giftCards);
  } catch (error) {
    console.error("Error fetching gift cards:", error);
    return NextResponse.json({ error: "Failed to fetch gift cards" }, { status: 500 });
  }
}

// Create gift card (when receiving inventory)
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, barcode, initialValue } = data;
    
    if (!companyId || !barcode || !initialValue) {
      return NextResponse.json({ error: "companyId, barcode, and initialValue required" }, { status: 400 });
    }
    
    // Check if already exists
    const existing = await prisma.giftCard.findUnique({
      where: { barcode },
    });
    
    if (existing) {
      return NextResponse.json({ error: "Gift card with this barcode already exists" }, { status: 400 });
    }
    
    const giftCard = await prisma.giftCard.create({
      data: {
        companyId,
        barcode,
        initialValue: parseFloat(initialValue),
        balance: parseFloat(initialValue),
        isActive: true,
      },
    });
    
    return NextResponse.json(giftCard);
  } catch (error) {
    console.error("Error creating gift card:", error);
    return NextResponse.json({ error: "Failed to create gift card" }, { status: 500 });
  }
}

// Activate gift card (when sold to customer)
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { barcode, transactionId } = data;
    
    if (!barcode) {
      return NextResponse.json({ error: "barcode required" }, { status: 400 });
    }
    
    const giftCard = await prisma.giftCard.findUnique({
      where: { barcode },
    });
    
    if (!giftCard) {
      return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
    }
    
    if (giftCard.purchasedAt) {
      return NextResponse.json({ error: "Gift card already activated" }, { status: 400 });
    }
    
    const updated = await prisma.giftCard.update({
      where: { barcode },
      data: {
        purchasedAt: new Date(),
        purchaseTransactionId: transactionId || null,
      },
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error activating gift card:", error);
    return NextResponse.json({ error: "Failed to activate gift card" }, { status: 500 });
  }
}
