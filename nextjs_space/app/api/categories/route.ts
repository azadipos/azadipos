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
    
    const categories = await prisma.category.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        taxRate: true,
        returnPeriodDays: true,
      },
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
