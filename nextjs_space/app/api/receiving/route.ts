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
    
    // Create receiving log
    const receivingLog = await prisma.receivingLog.create({
      data: {
        companyId,
        vendorId: vendorId || null,
        itemsJson: JSON.stringify(items),
        invoiceImageUrl: notes || null,
      },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    });
    
    // Update inventory quantities
    for (const item of items) {
      if (item.itemId && item.quantity) {
        await prisma.item.update({
          where: { id: item.itemId },
          data: {
            quantityOnHand: { increment: parseFloat(item.quantity) },
          },
        });
      }
    }
    
    return NextResponse.json(receivingLog);
  } catch (error) {
    console.error("Error creating receiving log:", error);
    return NextResponse.json({ error: "Failed to create receiving log" }, { status: 500 });
  }
}
