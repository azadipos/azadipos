export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const payouts = await prisma.payout.findMany({
      where: { companyId },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(payouts);
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, vendorId, amount, notes } = data;
    
    if (!companyId || !amount) {
      return NextResponse.json({ error: "companyId and amount are required" }, { status: 400 });
    }
    
    const payout = await prisma.payout.create({
      data: {
        companyId,
        vendorId: vendorId || null,
        amount: parseFloat(amount),
        receiptImageUrl: notes || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
    
    return NextResponse.json(payout);
  } catch (error) {
    console.error("Error creating payout:", error);
    return NextResponse.json({ error: "Failed to create payout" }, { status: 500 });
  }
}
