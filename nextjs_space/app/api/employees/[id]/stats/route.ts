import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    
    // Get all transactions by this employee
    const transactions = await prisma.transaction.findMany({
      where: { employeeId },
    });
    
    // Calculate stats
    let totalSales = 0;
    let totalRefunds = 0;
    let totalVoids = 0;
    let totalStoreCredits = 0;
    let transactionCount = 0;
    let refundCount = 0;
    let voidCount = 0;
    let storeCreditCount = 0;
    
    transactions.forEach((txn: { type: string; total: number }) => {
      switch (txn.type) {
        case "sale":
          totalSales += txn.total;
          transactionCount++;
          break;
        case "refund":
          totalRefunds += txn.total;
          refundCount++;
          break;
        case "void":
          totalVoids += txn.total;
          voidCount++;
          break;
        case "store_credit":
          totalStoreCredits += txn.total;
          storeCreditCount++;
          break;
      }
    });
    
    // Also count store credits authorized by this employee (if manager)
    const authorizedCredits = await prisma.transaction.findMany({
      where: {
        authorizedByEmployeeId: employeeId,
        type: "store_credit",
      },
    });
    
    const authorizedCreditCount = authorizedCredits.length;
    const authorizedCreditTotal = authorizedCredits.reduce((sum: number, txn: { total: number }) => sum + txn.total, 0);
    
    return NextResponse.json({
      totalSales,
      totalRefunds,
      totalVoids,
      totalStoreCredits: totalStoreCredits + authorizedCreditTotal,
      transactionCount,
      refundCount,
      voidCount,
      storeCreditCount: storeCreditCount + authorizedCreditCount,
    });
  } catch (error) {
    console.error("Fetch stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
