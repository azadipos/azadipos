import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Get active promotions for POS use
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  
  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 });
  }
  
  const now = new Date();
  
  const promotions = await prisma.promotion.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    },
  });
  
  return NextResponse.json(promotions);
}
