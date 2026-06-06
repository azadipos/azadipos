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
    
    const receivingLogs = await prisma.receivingLog.findMany({
      where: { companyId },
      include: {
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(receivingLogs);
  } catch (error) {
    console.error("Error fetching receiving logs:", error);
    return NextResponse.json({ error: "Failed to fetch receiving logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, vendorId, items, notes } = data;
    
    if (!companyId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "companyId and items array are required" }, { status: 400 });
    }
    
    // Create receiving log with cost data
    const receivingLog = await prisma.receivingLog.create({
      data: {
        companyId,
        vendorId: vendorId || null,
        itemsJson: JSON.stringify(items), // Now includes cost per item
        invoiceImageUrl: notes || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
    
    // Update inventory quantities and handle per-item cost/vendor update decisions
    for (const item of items) {
      if (item.itemId && item.quantity) {
        const updateData: any = {
          quantityOnHand: { increment: parseFloat(item.quantity) },
        };
        
        // Only update cost if the admin specifically approved it for this item
        if (item.updateCost && item.cost !== undefined && item.cost !== null) {
          updateData.cost = parseFloat(item.cost);
        }
        
        // Only update vendor if the admin specifically approved it for this item
        if (item.updateVendor && vendorId) {
          updateData.vendorId = vendorId;
        }
        
        await prisma.item.update({
          where: { id: item.itemId },
          data: updateData,
        });
      }
    }
    
    return NextResponse.json(receivingLog);
  } catch (error) {
    console.error("Error creating receiving log:", error);
    return NextResponse.json({ error: "Failed to create receiving log" }, { status: 500 });
  }
}

// Get cost history for an item from receiving logs
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const itemId = searchParams.get("itemId");
    
    if (!companyId || !itemId) {
      return NextResponse.json({ error: "companyId and itemId required" }, { status: 400 });
    }
    
    // Get all receiving logs that include this item
    const logs = await prisma.receivingLog.findMany({
      where: { companyId },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    
    // Parse and find cost entries for the item
    const costHistory: { vendorId: string | null; vendorName: string | null; cost: number; date: Date }[] = [];
    
    for (const log of logs) {
      if (log.itemsJson) {
        try {
          const items = JSON.parse(log.itemsJson);
          const itemEntry = items.find((i: any) => i.itemId === itemId);
          if (itemEntry && itemEntry.cost !== undefined) {
            costHistory.push({
              vendorId: log.vendorId,
              vendorName: log.vendor?.name || null,
              cost: parseFloat(itemEntry.cost),
              date: log.createdAt,
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
    
    return NextResponse.json(costHistory);
  } catch (error) {
    console.error("Error fetching cost history:", error);
    return NextResponse.json({ error: "Failed to fetch cost history" }, { status: 500 });
  }
}
