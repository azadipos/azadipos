import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    
    // Get sales transactions
    const salesAgg = await prisma.transaction.aggregate({
      where: {
        employeeId,
        type: "sale",
      },
      _sum: {
        total: true,
      },
      _count: true,
    });
    
    // Get refund transactions
    const refundAgg = await prisma.transaction.aggregate({
      where: {
        employeeId,
        type: "refund",
      },
      _sum: {
        total: true,
      },
      _count: true,
    });
    
    // Get void transactions
    const voidAgg = await prisma.transaction.aggregate({
      where: {
        employeeId,
        type: "void",
      },
      _sum: {
        total: true,
      },
      _count: true,
    });
    
    // Count store credits issued by this employee
    const storeCreditAgg = await prisma.storeCredit.aggregate({
      where: {
        issuedByEmployeeId: employeeId,
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });
    
    return NextResponse.json({
      totalSales: salesAgg._sum.total ?? 0,
      totalRefunds: refundAgg._sum.total ?? 0,
      totalVoids: voidAgg._sum.total ?? 0,
      totalStoreCredits: storeCreditAgg._sum.amount ?? 0,
      transactionCount: salesAgg._count ?? 0,
      refundCount: refundAgg._count ?? 0,
      voidCount: voidAgg._count ?? 0,
      storeCreditCount: storeCreditAgg._count ?? 0,
    });
  } catch (error) {
    console.error("Employee stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
