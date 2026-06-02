export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Handle sync queue operations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status") || "pending";
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const queueItems = await prisma.syncQueue.findMany({
      where: { companyId, status },
      orderBy: { createdAt: "asc" },
    });
    
    return NextResponse.json({ queueItems });
  } catch (error) {
    console.error("Error fetching sync queue:", error);
    return NextResponse.json({ error: "Failed to fetch sync queue" }, { status: 500 });
  }
}

// Process offline data sync
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, items } = data; // items is array of offline data to sync
    
    if (!companyId || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "companyId and items array required" }, { status: 400 });
    }
    
    const results: any[] = [];
    
    for (const item of items) {
      try {
        if (item.entityType === "transaction") {
          const result = await syncTransaction(companyId, item);
          results.push(result);
        } else if (item.entityType === "shift") {
          const result = await syncShift(companyId, item);
          results.push(result);
        }
      } catch (itemError: any) {
        results.push({
          localId: item.localId,
          error: itemError.message,
          status: "failed",
        });
      }
    }
    
    return NextResponse.json({ results, synced: results.filter(r => r.status === "synced").length });
  } catch (error) {
    console.error("Error processing sync:", error);
    return NextResponse.json({ error: "Failed to process sync" }, { status: 500 });
  }
}

async function syncTransaction(companyId: string, item: any) {
  const txData = JSON.parse(item.entityData);
  
  // Get the next transaction number
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId },
    orderBy: { transactionNumber: "desc" },
    select: { transactionNumber: true },
  });
  
  let nextNumber = 1;
  if (lastTx?.transactionNumber) {
    const match = lastTx.transactionNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0]) + 1;
    }
  }
  
  const newTransactionNumber = `TXN${nextNumber.toString().padStart(6, "0")}`;
  
  // Create the transaction with new server-assigned number
  const transaction = await prisma.transaction.create({
    data: {
      companyId,
      shiftId: txData.shiftId,
      employeeId: txData.employeeId,
      transactionNumber: newTransactionNumber,
      type: txData.type || "sale",
      subtotal: txData.subtotal,
      tax: txData.tax,
      total: txData.total,
      paymentMethod: txData.paymentMethod || "cash",
      cashGiven: txData.cashGiven,
      changeDue: txData.changeDue,
      status: "completed",
      customerId: txData.customerId,
      loyaltyPointsEarned: txData.loyaltyPointsEarned || 0,
      loyaltyPointsRedeemed: txData.loyaltyPointsRedeemed || 0,
      items: {
        create: (txData.items || []).map((ti: any) => ({
          itemId: ti.itemId,
          itemName: ti.itemName,
          quantity: ti.quantity,
          unitPrice: ti.unitPrice,
          lineTotal: ti.lineTotal,
          isWeightItem: ti.isWeightItem || false,
        })),
      },
    },
  });
  
  // Update inventory for each item (deduct quantities)
  for (const ti of txData.items || []) {
    await prisma.item.update({
      where: { id: ti.itemId },
      data: { quantityOnHand: { decrement: Math.abs(ti.quantity) } },
    });
  }
  
  // Update sync queue record if exists
  if (item.id) {
    await prisma.syncQueue.update({
      where: { id: item.id },
      data: {
        status: "synced",
        serverTransactionNumber: newTransactionNumber,
        syncedAt: new Date(),
        conflictResolution: item.localTransactionNumber !== newTransactionNumber
          ? JSON.stringify({
              localNumber: item.localTransactionNumber,
              serverNumber: newTransactionNumber,
              resolvedAt: new Date().toISOString(),
            })
          : null,
      },
    });
  }
  
  return {
    localId: item.localId,
    serverId: transaction.id,
    localTransactionNumber: item.localTransactionNumber,
    serverTransactionNumber: newTransactionNumber,
    status: "synced",
  };
}

async function syncShift(companyId: string, item: any) {
  const shiftData = JSON.parse(item.entityData);
  
  // Check if shift already exists
  const existingShift = await prisma.shift.findFirst({
    where: {
      companyId,
      employeeId: shiftData.employeeId,
      startTime: { gte: new Date(shiftData.startTime) },
    },
  });
  
  if (existingShift) {
    // Update existing shift
    const updated = await prisma.shift.update({
      where: { id: existingShift.id },
      data: {
        endTime: shiftData.endTime ? new Date(shiftData.endTime) : undefined,
        closingBalance: shiftData.closingBalance,
        status: shiftData.status,
      },
    });
    
    return {
      localId: item.localId,
      serverId: updated.id,
      status: "synced",
      merged: true,
    };
  }
  
  // Create new shift
  const shift = await prisma.shift.create({
    data: {
      companyId,
      employeeId: shiftData.employeeId,
      registerId: shiftData.registerId,
      startTime: new Date(shiftData.startTime),
      endTime: shiftData.endTime ? new Date(shiftData.endTime) : undefined,
      openingBalance: shiftData.openingBalance || 0,
      closingBalance: shiftData.closingBalance,
      cashInjections: shiftData.cashInjections || 0,
      status: shiftData.status || "open",
    },
  });
  
  return {
    localId: item.localId,
    serverId: shift.id,
    status: "synced",
  };
}
