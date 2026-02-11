import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  
  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 });
  }
  
  const promotions = await prisma.promotion.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  
  return NextResponse.json(promotions);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, name, type, configJson, startDate, endDate, isActive } = body;
    
    if (!companyId || !name || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const promotion = await prisma.promotion.create({
      data: {
        companyId,
        name,
        type,
        configJson: configJson ? JSON.stringify(configJson) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive ?? true,
      },
    });
    
    return NextResponse.json(promotion);
  } catch (error) {
    console.error("Create promotion error:", error);
    return NextResponse.json({ error: "Failed to create promotion" }, { status: 500 });
  }
}
