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
    
    // Check if already used
    if (credit.isUsed) {
      return NextResponse.json({ 
        error: "Store credit already used",
        usedAt: credit.usedAt 
      }, { status: 400 });
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
    const { companyId, amount, transactionId, description, issuedByEmployeeId, authorizedByEmployeeId } = body;
    
    if (!companyId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Generate unique barcode for store credit
    // Use SC- prefix with timestamp and random chars to ensure uniqueness
    // Format: SC-YYYYMMDD-XXXXXX (16 chars total, very unlikely to overlap with product barcodes)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const barcode = `SC-${dateStr}-${randomPart}`;
    
    const credit = await prisma.storeCredit.create({
      data: {
        companyId,
        barcode,
        amount,
        transactionId,
        description: description || null,
        issuedByEmployeeId: issuedByEmployeeId || null,
        authorizedByEmployeeId: authorizedByEmployeeId || null,
      },
    });
    
    return NextResponse.json(credit);
  } catch (error) {
    console.error("Create store credit error:", error);
    return NextResponse.json({ error: "Failed to create store credit" }, { status: 500 });
  }
}
