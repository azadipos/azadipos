export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: employeeId } = params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Get all employees in this company (only those flagged as "in sales")
    const employees = await prisma.employee.findMany({
      where: { companyId, isActive: true, inSales: true },
      select: { id: true, name: true, isManager: true },
    });
    
    // For each employee, get their stats
    const comparison = await Promise.all(
      employees.map(async (emp) => {
        const [salesAgg, refundAgg, storeCreditCount] = await Promise.all([
          prisma.transaction.aggregate({
            where: { employeeId: emp.id, type: "sale" },
            _sum: { total: true },
            _count: { id: true },
          }),
          prisma.transaction.aggregate({
            where: { employeeId: emp.id, type: "refund" },
            _sum: { total: true },
            _count: { id: true },
          }),
          // Count store credits linked to this employee's transactions
          prisma.storeCredit.count({
            where: {
              transactionId: {
                in: (await prisma.transaction.findMany({
                  where: { employeeId: emp.id },
                  select: { transactionNumber: true },
                })).map(t => t.transactionNumber),
              },
            },
          }),
        ]);
        
        // Get store credit total
        const storeCreditTotal = await prisma.storeCredit.aggregate({
          where: {
            transactionId: {
              in: (await prisma.transaction.findMany({
                where: { employeeId: emp.id },
                select: { transactionNumber: true },
              })).map(t => t.transactionNumber),
            },
          },
          _sum: { amount: true },
        });
        
        const totalSales = salesAgg._sum.total || 0;
        const totalRefunds = Math.abs(refundAgg._sum.total || 0);
        const totalStoreCredits = storeCreditTotal._sum.amount || 0;
        const saleCount = salesAgg._count.id || 0;
        
        // Calculate refund rate
        const refundRate = totalSales > 0 ? (totalRefunds / totalSales) * 100 : 0;
        // Calculate store credit rate per 100 transactions
        const storeCreditRate = saleCount > 0 
          ? (storeCreditCount / saleCount) * 100 
          : 0;
        
        return {
          id: emp.id,
          name: emp.name,
          isManager: emp.isManager,
          isCurrentEmployee: emp.id === employeeId,
          totalSales,
          saleCount,
          totalRefunds,
          refundCount: refundAgg._count.id || 0,
          refundRate: Math.round(refundRate * 100) / 100,
          totalStoreCredits,
          storeCreditCount,
          storeCreditRate: Math.round(storeCreditRate * 100) / 100,
        };
      })
    );
    
    // Sort by total sales descending
    comparison.sort((a, b) => b.totalSales - a.totalSales);
    
    // Calculate averages for comparison
    const nonManagerCount = comparison.filter((e) => !e.isManager).length;
    const avgRefundRate = nonManagerCount > 0
      ? comparison.filter((e) => !e.isManager).reduce((sum, e) => sum + e.refundRate, 0) / nonManagerCount
      : 0;
    const avgStoreCreditRate = nonManagerCount > 0
      ? comparison.filter((e) => !e.isManager).reduce((sum, e) => sum + e.storeCreditRate, 0) / nonManagerCount
      : 0;
    
    return NextResponse.json({
      employees: comparison,
      averages: {
        refundRate: Math.round(avgRefundRate * 100) / 100,
        storeCreditRate: Math.round(avgStoreCreditRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Get employee comparison error:", error);
    return NextResponse.json({ error: "Failed to fetch comparison" }, { status: 500 });
  }
}
