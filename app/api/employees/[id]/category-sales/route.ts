export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const categoryId = searchParams.get("categoryId");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Get employee's transactions with items in the specified category
    const transactions = await prisma.transaction.findMany({
      where: {
        employeeId,
        companyId,
        type: "sale",
        status: { not: "deleted" },
      },
      include: {
        items: {
          include: {
            item: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
    
    // Calculate category sales for this employee
    let employeeCategorySales = 0;
    let employeeCategoryTransactions = 0;
    const flaggedTransactions: any[] = [];
    
    transactions.forEach((txn: any) => {
      let hasCategoryItem = false;
      let categoryTotal = 0;
      
      txn.items.forEach((item: any) => {
        if (!categoryId || item.item?.categoryId === categoryId) {
          hasCategoryItem = true;
          categoryTotal += item.lineTotal;
        }
      });
      
      if (hasCategoryItem) {
        employeeCategorySales += categoryTotal;
        employeeCategoryTransactions++;
        
        // Add to flagged transactions list
        flaggedTransactions.push({
          id: txn.id,
          transactionNumber: txn.transactionNumber,
          total: txn.total,
          categoryTotal,
          date: txn.createdAt,
        });
      }
    });
    
    // If a specific category is requested, get team comparison
    let teamComparison: any[] = [];
    let teamAverage = 0;
    
    if (categoryId) {
      // Get all active employees in the company
      const employees = await prisma.employee.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, isManager: true },
      });
      
      // Calculate category sales for each employee
      const employeeSales = await Promise.all(
        employees.map(async (emp: any) => {
          const empTxns = await prisma.transaction.findMany({
            where: {
              employeeId: emp.id,
              companyId,
              type: "sale",
              status: { not: "deleted" },
            },
            include: {
              items: {
                include: {
                  item: true,
                },
              },
            },
          });
          
          let categorySales = 0;
          let categoryCount = 0;
          
          empTxns.forEach((txn: any) => {
            txn.items.forEach((item: any) => {
              if (item.item?.categoryId === categoryId) {
                categorySales += item.lineTotal;
                categoryCount++;
              }
            });
          });
          
          return {
            id: emp.id,
            name: emp.name,
            isManager: emp.isManager,
            categorySales,
            categoryItemCount: categoryCount,
            isCurrentEmployee: emp.id === employeeId,
          };
        })
      );
      
      // Sort by category sales descending
      teamComparison = employeeSales.sort((a: any, b: any) => b.categorySales - a.categorySales);
      
      // Calculate team average (excluding managers)
      const nonManagerSales = teamComparison.filter((e: any) => !e.isManager);
      if (nonManagerSales.length > 0) {
        teamAverage = nonManagerSales.reduce((sum: number, e: any) => sum + e.categorySales, 0) / nonManagerSales.length;
      }
    }
    
    return NextResponse.json({
      employeeCategorySales,
      employeeCategoryTransactions,
      flaggedTransactions: flaggedTransactions.slice(0, 50), // Limit to 50 most recent
      teamComparison,
      teamAverage,
    });
  } catch (error) {
    console.error("Category sales error:", error);
    return NextResponse.json({ error: "Failed to fetch category sales" }, { status: 500 });
  }
}
