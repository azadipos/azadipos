export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Get all items and filter in application
    const items = await prisma.item.findMany({
      where: {
        companyId,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { vendor: { name: "asc" } },
        { name: "asc" },
      ],
    });
    
    // Filter items at or below reorder point and calculate sold since last intake
    const reorderItems = await Promise.all(
      items
        .filter((item: any) => item.quantityOnHand <= item.reorderPoint && item.reorderPoint > 0)
        .map(async (item: any) => {
          // Calculate sold since last receiving (intake)
          // For now, we'll estimate based on transaction items since we don't have intake tracking yet
          const soldAgg = await prisma.transactionItem.aggregate({
            where: {
              itemId: item.id,
              transaction: {
                type: "sale",
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days as proxy
                },
              },
            },
            _sum: {
              quantity: true,
            },
          });
          
          return {
            id: item.id,
            name: item.name,
            barcode: item.barcode,
            currentStock: item.quantityOnHand,
            reorderLevel: item.reorderPoint,
            reorderQty: Math.max(10, item.reorderPoint * 2 - item.quantityOnHand), // Suggested reorder qty
            soldSinceLastIntake: Math.round(soldAgg._sum.quantity ?? 0),
            cost: item.cost,
            vendor: item.vendor,
          };
        })
    );
    
    return NextResponse.json(reorderItems);
  } catch (error) {
    console.error("Reorder list error:", error);
    return NextResponse.json({ error: "Failed to fetch reorder list" }, { status: 500 });
  }
}
