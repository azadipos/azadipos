export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "15");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Allow single character searches for instant feedback
    if (query.length < 1) {
      return NextResponse.json([]);
    }
    
    // Use startsWith for better index utilization on barcode searches
    // and contains for name searches
    const items = await prisma.item.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          // Barcode prefix match (fastest - uses index)
          { barcode: { startsWith: query } },
          // Name contains (slower but necessary for text search)
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        isWeightPriced: true,
        category: {
          select: {
            id: true,
            taxRate: true,
          },
        },
      },
      take: limit,
      orderBy: [
        // Prioritize exact barcode matches
        { barcode: "asc" },
        { name: "asc" },
      ],
    });
    
    // Sort results to prioritize barcode prefix matches
    const sortedItems = items.sort((a: any, b: any) => {
      const aStartsWithBarcode = a.barcode.toLowerCase().startsWith(query.toLowerCase());
      const bStartsWithBarcode = b.barcode.toLowerCase().startsWith(query.toLowerCase());
      
      if (aStartsWithBarcode && !bStartsWithBarcode) return -1;
      if (!aStartsWithBarcode && bStartsWithBarcode) return 1;
      
      const aStartsWithName = a.name.toLowerCase().startsWith(query.toLowerCase());
      const bStartsWithName = b.name.toLowerCase().startsWith(query.toLowerCase());
      
      if (aStartsWithName && !bStartsWithName) return -1;
      if (!aStartsWithName && bStartsWithName) return 1;
      
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json(sortedItems);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
