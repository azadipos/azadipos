export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    
    const shifts = await prisma.shift.findMany({
      where: {
        employeeId,
      },
      include: {
        closedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        startTime: "desc",
      },
      take: 20,
    });
    
    // For closed shifts, calculate variance for discrepancy flagging
    const shiftsWithVariance = await Promise.all(
      shifts.map(async (shift) => {
        if (shift.status !== 'closed' || shift.closingBalance == null) {
          return { ...shift, variance: null };
        }
        
        // Get cash sales and refunds for this shift
        const transactions = await prisma.transaction.findMany({
          where: {
            shiftId: shift.id,
            status: { not: 'deleted' },
          },
          select: { type: true, paymentMethod: true, total: true },
        });
        
        let cashSales = 0;
        let totalRefunds = 0;
        for (const tx of transactions) {
          if (tx.type === 'sale' && (tx.paymentMethod === 'cash' || tx.paymentMethod === 'split')) {
            cashSales += tx.total;
          } else if (tx.type === 'refund') {
            totalRefunds += Math.abs(tx.total);
          }
        }
        
        const expected = (shift.openingBalance || 0) + (shift.cashInjections || 0) + cashSales - totalRefunds;
        const variance = shift.closingBalance - expected;
        return { ...shift, variance: Math.round(variance * 100) / 100 };
      })
    );
    
    return NextResponse.json(shiftsWithVariance);
  } catch (error) {
    console.error("Employee shifts error:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}
