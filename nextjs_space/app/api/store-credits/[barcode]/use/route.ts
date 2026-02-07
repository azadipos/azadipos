import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { barcode: string } }
) {
  try {
    const credit = await prisma.storeCredit.findUnique({
      where: { barcode: params.barcode },
    });
    
    if (!credit) {
      return NextResponse.json({ error: "Store credit not found" }, { status: 404 });
    }
    
    if (credit.isUsed) {
      return NextResponse.json({ error: "Store credit already used" }, { status: 400 });
    }
    
    const updated = await prisma.storeCredit.update({
      where: { barcode: params.barcode },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Use store credit error:", error);
    return NextResponse.json({ error: "Failed to use store credit" }, { status: 500 });
  }
}
