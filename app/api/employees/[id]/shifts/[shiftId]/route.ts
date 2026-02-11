export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string; shiftId: string } }
) {
  try {
    const { id: employeeId, shiftId } = params;
    
    // Get shift details
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            isManager: true,
          },
        },
      },
    });
    
    if (!shift || shift.employeeId !== employeeId) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    
    // Get all transactions during this shift
    const transactions = await prisma.transaction.findMany({
      where: {
        shiftId,
      },
      include: {
        items: {
          include: {
            item: {
              select: {
                name: true,
                barcode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    
    // Get store credits created during this shift timeframe
    const storeCredits = await prisma.storeCredit.findMany({
      where: {
        createdAt: {
          gte: shift.startTime,
          ...(shift.endTime ? { lte: shift.endTime } : {}),
        },
        // Link through transactions made by this employee in this shift
        transactionId: {
          in: transactions.map((t: any) => t.transactionNumber),
        },
      },
      orderBy: { createdAt: "asc" },
    });
    
    // Calculate summary stats
    const stats = {
      totalSales: 0,
      totalRefunds: 0,
      totalVoids: 0,
      saleCount: 0,
      refundCount: 0,
      voidCount: 0,
      averageTransactionValue: 0,
      storeCreditCount: storeCredits.length,
      storeCreditTotal: storeCredits.reduce((sum: number, sc: any) => sum + sc.amount, 0),
    };
    
    transactions.forEach((txn) => {
      if (txn.type === "sale") {
        stats.totalSales += txn.total;
        stats.saleCount++;
      } else if (txn.type === "refund") {
        stats.totalRefunds += Math.abs(txn.total);
        stats.refundCount++;
      } else if (txn.type === "void") {
        stats.totalVoids += Math.abs(txn.total);
        stats.voidCount++;
      }
    });
    
    if (stats.saleCount > 0) {
      stats.averageTransactionValue = stats.totalSales / stats.saleCount;
    }
    
    // Build timeline of sensitive actions (refunds, voids, store credits)
    const sensitiveActions: Array<{
      type: string;
      timestamp: Date;
      amount: number;
      details: string;
      transactionId?: string;
    }> = [];
    
    transactions.forEach((txn: any) => {
      if (txn.type === "refund" || txn.type === "void") {
        const items = txn.items.map((i: any) => i.item?.name || "Unknown").join(", ");
        sensitiveActions.push({
          type: txn.type,
          timestamp: txn.createdAt,
          amount: Math.abs(txn.total),
          details: items || "No items",
          transactionId: txn.transactionNumber,
        });
      }
    });
    
    storeCredits.forEach((sc: any) => {
      sensitiveActions.push({
        type: "store_credit",
        timestamp: sc.createdAt,
        amount: sc.amount,
        details: `Barcode: ${sc.barcode}`,
      });
    });
    
    // Sort by timestamp
    sensitiveActions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Hourly breakdown of transactions
    const hourlyBreakdown: { [hour: string]: { sales: number; refunds: number; count: number } } = {};
    transactions.forEach((txn: any) => {
      const hour = new Date(txn.createdAt).getHours();
      const hourKey = `${hour}:00`;
      if (!hourlyBreakdown[hourKey]) {
        hourlyBreakdown[hourKey] = { sales: 0, refunds: 0, count: 0 };
      }
      if (txn.type === "sale") {
        hourlyBreakdown[hourKey].sales += txn.total;
      } else if (txn.type === "refund") {
        hourlyBreakdown[hourKey].refunds += Math.abs(txn.total);
      }
      hourlyBreakdown[hourKey].count++;
    });
    
    return NextResponse.json({
      shift,
      stats,
      transactions: transactions.map((t) => ({
        id: t.id,
        transactionNumber: t.transactionNumber,
        type: t.type,
        totalAmount: t.total,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        itemCount: t.items.length,
      })),
      sensitiveActions,
      hourlyBreakdown: Object.entries(hourlyBreakdown)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([hour, data]) => ({ hour, ...data })),
      storeCredits,
    });
  } catch (error) {
    console.error("Get shift details error:", error);
    return NextResponse.json({ error: "Failed to fetch shift details" }, { status: 500 });
  }
}
