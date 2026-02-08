export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const query = searchParams.get("q") || "";
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    if (query.length < 2) {
      return NextResponse.json([]);
    }
    
    const items = await prisma.item.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { barcode: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        category: {
          select: {
            taxRate: true,
          },
        },
      },
      take: 10,
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json(items);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
