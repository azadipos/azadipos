export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: fetch items that have no reorder point set
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }

    const items = await prisma.item.findMany({
      where: { companyId, isActive: true, reorderPoint: 0 },
      select: {
        id: true,
        name: true,
        barcode: true,
        quantityOnHand: true,
        cost: true,
        category: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Also return total item count for context
    const totalItems = await prisma.item.count({
      where: { companyId, isActive: true },
    });
    const configuredCount = await prisma.item.count({
      where: { companyId, isActive: true, reorderPoint: { gt: 0 } },
    });

    return NextResponse.json({
      unconfigured: items,
      totalItems,
      configuredCount,
    });
  } catch (error) {
    console.error("Error fetching unconfigured items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// POST: bulk-update reorder points
export async function POST(req: NextRequest) {
  try {
    const { companyId, updates } = await req.json();
    // updates: Array<{ id: string; reorderPoint: number }>

    if (!companyId || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "companyId and updates array required" },
        { status: 400 }
      );
    }

    let updatedCount = 0;
    for (const upd of updates) {
      if (upd.id && typeof upd.reorderPoint === "number" && upd.reorderPoint >= 0) {
        await prisma.item.update({
          where: { id: upd.id, companyId },
          data: { reorderPoint: upd.reorderPoint },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error("Error bulk-updating reorder points:", error);
    return NextResponse.json(
      { error: "Failed to update reorder points" },
      { status: 500 }
    );
  }
}
