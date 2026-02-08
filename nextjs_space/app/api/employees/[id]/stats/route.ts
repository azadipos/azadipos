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
    
    // Count store credits - since we don't have employeeId on StoreCredit,
    // we'll count from refund transactions that generated store credits
    // For now, return 0 until schema is updated to track issuer
    
    return NextResponse.json({
      totalSales: salesAgg._sum.total ?? 0,
      totalRefunds: refundAgg._sum.total ?? 0,
      totalVoids: voidAgg._sum.total ?? 0,
      totalStoreCredits: 0, // Need schema update to track issuer
      transactionCount: salesAgg._count ?? 0,
      refundCount: refundAgg._count ?? 0,
      voidCount: voidAgg._count ?? 0,
      storeCreditCount: 0, // Need schema update to track issuer
    });
  } catch (error) {
    console.error("Employee stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
