import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shiftId = params.id;
    
    // Get the shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });
    
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    
    // Get all transactions for this shift
    const transactions = await prisma.transaction.findMany({
      where: { shiftId },
    });
    
    // Calculate stats
    const sales = transactions.filter((t: any) => t.type === "sale" && t.status !== "deleted");
    const refunds = transactions.filter((t: any) => t.type === "refund");
    const voids = transactions.filter((t: any) => t.type === "void" || t.status === "deleted");
    
    const totalSales = sales.reduce((sum: number, t: any) => sum + t.total, 0);
    const totalRefunds = refunds.reduce((sum: number, t: any) => sum + t.total, 0);
    const cashSales = sales.filter((t: any) => t.paymentMethod === "cash").reduce((sum: number, t: any) => sum + t.total, 0);
    const cardSales = sales.filter((t: any) => t.paymentMethod === "card").reduce((sum: number, t: any) => sum + t.total, 0);
    
    // Get store credits issued during this shift
    const storeCredits = await prisma.storeCredit.findMany({
      where: {
        companyId: shift.companyId,
        createdAt: {
          gte: shift.startTime,
          lte: shift.endTime || new Date(),
        },
      },
    });
    
    const totalStoreCreditsIssued = storeCredits.reduce((sum: number, sc: any) => sum + sc.amount, 0);
    
    // Hourly breakdown
    const hourlyBreakdown: { hour: number; sales: number; transactions: number }[] = [];
    const hourMap = new Map<number, { sales: number; transactions: number }>();
    
    sales.forEach((t: any) => {
      const hour = new Date(t.createdAt).getHours();
      const existing = hourMap.get(hour) || { sales: 0, transactions: 0 };
      hourMap.set(hour, {
        sales: existing.sales + t.total,
        transactions: existing.transactions + 1,
      });
    });
    
    hourMap.forEach((value: any, hour: number) => {
      hourlyBreakdown.push({ hour, ...value });
    });
    
    hourlyBreakdown.sort((a, b) => a.hour - b.hour);
    
    return NextResponse.json({
      totalSales,
      totalRefunds,
      totalVoids: voids.length,
      totalStoreCreditsIssued,
      transactionCount: sales.length,
      refundCount: refunds.length,
      voidCount: voids.length,
      storeCreditCount: storeCredits.length,
      cashSales,
      cardSales,
      averageTransaction: sales.length > 0 ? totalSales / sales.length : 0,
      hourlyBreakdown,
    });
  } catch (error) {
    console.error("Get shift stats error:", error);
    return NextResponse.json({ error: "Failed to get shift stats" }, { status: 500 });
  }
}
