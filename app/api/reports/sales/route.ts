export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const groupBy = searchParams.get("groupBy") || "day"; // day, week, month, category, employee
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    
    // Get all transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId,
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        items: {
          include: {
            item: { include: { category: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    // Summary calculations
    const summary = {
      totalSales: 0,
      totalRefunds: 0,
      totalVoids: 0,
      netSales: 0,
      totalTax: 0,
      saleCount: 0,
      refundCount: 0,
      voidCount: 0,
      cashSales: 0,
      cardSales: 0,
      averageTransaction: 0,
    };
    
    transactions.forEach((t) => {
      if (t.type === "sale" && t.status !== "deleted") {
        summary.totalSales += t.total;
        summary.saleCount++;
        summary.totalTax += t.tax;
        if (t.paymentMethod === "cash") summary.cashSales += t.total;
        if (t.paymentMethod === "card") summary.cardSales += t.total;
      } else if (t.type === "refund") {
        summary.totalRefunds += Math.abs(t.total);
        summary.refundCount++;
      } else if (t.type === "void" || t.status === "deleted") {
        summary.totalVoids += t.total;
        summary.voidCount++;
      }
    });
    
    summary.netSales = summary.totalSales - summary.totalRefunds;
    summary.averageTransaction = summary.saleCount > 0 ? summary.totalSales / summary.saleCount : 0;
    
    // Group by different dimensions
    let breakdown: any[] = [];
    
    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      const grouped: { [key: string]: { sales: number; refunds: number; count: number; tax: number } } = {};
      
      transactions.forEach((t) => {
        if (t.status === "deleted" && t.type !== "void") return;
        
        const date = new Date(t.createdAt);
        let key = "";
        
        if (groupBy === "day") {
          key = date.toISOString().split("T")[0];
        } else if (groupBy === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        } else if (groupBy === "month") {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }
        
        if (!grouped[key]) {
          grouped[key] = { sales: 0, refunds: 0, count: 0, tax: 0 };
        }
        
        if (t.type === "sale") {
          grouped[key].sales += t.total;
          grouped[key].count++;
          grouped[key].tax += t.tax;
        } else if (t.type === "refund") {
          grouped[key].refunds += Math.abs(t.total);
        }
      });
      
      breakdown = Object.entries(grouped)
        .map(([date, data]) => ({ date, ...data, net: data.sales - data.refunds }))
        .sort((a, b) => a.date.localeCompare(b.date));
        
    } else if (groupBy === "category") {
      const grouped: { [key: string]: { name: string; sales: number; quantity: number; count: number } } = {};
      
      transactions.forEach((t) => {
        if (t.type !== "sale" || t.status === "deleted") return;
        
        t.items.forEach((item) => {
          const cat = item.item.category;
          const catId = cat?.id || "uncategorized";
          const catName = cat?.name || "Uncategorized";
          
          if (!grouped[catId]) {
            grouped[catId] = { name: catName, sales: 0, quantity: 0, count: 0 };
          }
          
          grouped[catId].sales += item.lineTotal;
          grouped[catId].quantity += item.quantity;
          grouped[catId].count++;
        });
      });
      
      breakdown = Object.values(grouped).sort((a, b) => b.sales - a.sales);
      
    } else if (groupBy === "employee") {
      const grouped: { [key: string]: { name: string; sales: number; refunds: number; count: number; refundCount: number } } = {};
      
      transactions.forEach((t) => {
        if (t.status === "deleted" && t.type !== "void") return;
        
        const empId = t.employee.id;
        const empName = t.employee.name;
        
        if (!grouped[empId]) {
          grouped[empId] = { name: empName, sales: 0, refunds: 0, count: 0, refundCount: 0 };
        }
        
        if (t.type === "sale") {
          grouped[empId].sales += t.total;
          grouped[empId].count++;
        } else if (t.type === "refund") {
          grouped[empId].refunds += Math.abs(t.total);
          grouped[empId].refundCount++;
        }
      });
      
      breakdown = Object.entries(grouped)
        .map(([id, data]) => ({ id, ...data, net: data.sales - data.refunds }))
        .sort((a, b) => b.sales - a.sales);
    }
    
    // Top selling items
    const itemSales: { [key: string]: { id: string; name: string; quantity: number; revenue: number } } = {};
    transactions.forEach((t) => {
      if (t.type !== "sale" || t.status === "deleted") return;
      t.items.forEach((item) => {
        if (!itemSales[item.itemId]) {
          itemSales[item.itemId] = { id: item.itemId, name: item.itemName, quantity: 0, revenue: 0 };
        }
        itemSales[item.itemId].quantity += item.quantity;
        itemSales[item.itemId].revenue += item.lineTotal;
      });
    });
    
    const topItems = Object.values(itemSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return NextResponse.json({
      summary,
      breakdown,
      topItems,
      transactionCount: transactions.length,
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
