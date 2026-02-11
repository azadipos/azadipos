export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: { id: true, name: true },
        },
        transactions: {
          where: { status: "completed" },
          select: {
            id: true,
            total: true,
            paymentMethod: true,
            cashGiven: true,
            changeDue: true,
          },
        },
      },
    });
    
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    
    const transactions = shift.transactions ?? [];
    
    // Calculate summary
    const totalSales = transactions.reduce((sum: number, t: any) => sum + (t?.total ?? 0), 0);
    const transactionCount = transactions.length;
    
    const cashTransactions = transactions.filter((t: any) => t?.paymentMethod === "cash");
    const cardTransactions = transactions.filter((t: any) => t?.paymentMethod === "card");
    
    const cashCollected = cashTransactions.reduce((sum: number, t: any) => {
      const cashGiven = t?.cashGiven ?? t?.total ?? 0;
      const changeDue = t?.changeDue ?? 0;
      return sum + (cashGiven - changeDue);
    }, 0);
    
    const cardTotal = cardTransactions.reduce((sum: number, t: any) => sum + (t?.total ?? 0), 0);
    
    const expectedCash = (shift.openingBalance ?? 0) + cashCollected + (shift.cashInjections ?? 0);
    
    return NextResponse.json({
      shift: {
        id: shift.id,
        employeeName: shift.employee?.name ?? "Unknown",
        startTime: shift.startTime,
        endTime: shift.endTime,
        openingBalance: shift.openingBalance ?? 0,
        cashInjections: shift.cashInjections ?? 0,
        status: shift.status,
      },
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        transactionCount,
        cashCollected: Math.round(cashCollected * 100) / 100,
        cardTotal: Math.round(cardTotal * 100) / 100,
        expectedCash: Math.round(expectedCash * 100) / 100,
        cashTransactionCount: cashTransactions.length,
        cardTransactionCount: cardTransactions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching shift summary:", error);
    return NextResponse.json({ error: "Failed to fetch shift summary" }, { status: 500 });
  }
}