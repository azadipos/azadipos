export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const limit = parseInt(searchParams.get("limit") || "1000");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const where: any = {
      companyId,
      isActive: true,
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    const items = await prisma.item.findMany({
      where,
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        cost: true,
        vendorId: true,
        vendor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });
    
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}
