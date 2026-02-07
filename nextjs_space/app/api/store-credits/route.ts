import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const barcode = searchParams.get("barcode");
  
  if (barcode) {
    const credit = await prisma.storeCredit.findUnique({
      where: { barcode },
    });
    
    if (!credit) {
      return NextResponse.json({ error: "Store credit not found" }, { status: 404 });
    }
    
    return NextResponse.json(credit);
  }
  
  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 });
  }
  
  const credits = await prisma.storeCredit.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  
  return NextResponse.json(credits);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, amount, transactionId } = body;
    
    if (!companyId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Generate unique barcode for store credit
    const barcode = `SC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const credit = await prisma.storeCredit.create({
      data: {
        companyId,
        barcode,
        amount,
        transactionId,
      },
    });
    
    return NextResponse.json(credit);
  } catch (error) {
    console.error("Create store credit error:", error);
    return NextResponse.json({ error: "Failed to create store credit" }, { status: 500 });
  }
}
