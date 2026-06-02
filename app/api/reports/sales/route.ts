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
            item: { include: { category: { select: { id: true, name: true, taxRate: true } } } },
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
      totalCost: 0,
      grossProfit: 0,
      profitMargin: 0,
    };
    
    transactions.forEach((t: any) => {
      if (t.type === "sale" && t.status !== "deleted") {
        summary.totalSales += t.total;
        summary.saleCount++;
        summary.totalTax += t.tax;
        if (t.paymentMethod === "cash") summary.cashSales += t.total;
        if (t.paymentMethod === "card") summary.cardSales += t.total;
        
        // Calculate cost for profit
        t.items.forEach((item: any) => {
          const itemCost = item.item.cost || 0;
          summary.totalCost += itemCost * item.quantity;
        });
      } else if (t.type === "refund") {
        summary.totalRefunds += Math.abs(t.total);
        summary.refundCount++;
        
        // Subtract cost for refunded items
        t.items.forEach((item: any) => {
          const itemCost = item.item.cost || 0;
          summary.totalCost -= itemCost * item.quantity;
        });
      } else if (t.type === "void" || t.status === "deleted") {
        summary.totalVoids += t.total;
        summary.voidCount++;
      }
    });
    
    summary.netSales = summary.totalSales - summary.totalRefunds;
    summary.averageTransaction = summary.saleCount > 0 ? summary.totalSales / summary.saleCount : 0;
    summary.grossProfit = summary.netSales - summary.totalTax - summary.totalCost;
    summary.profitMargin = summary.netSales > 0 ? (summary.grossProfit / summary.netSales) * 100 : 0;
    
    // Group by different dimensions
    let breakdown: any[] = [];
    
    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      const grouped: { [key: string]: { sales: number; refunds: number; count: number; tax: number; cost: number } } = {};
      
      transactions.forEach((t: any) => {
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
          grouped[key] = { sales: 0, refunds: 0, count: 0, tax: 0, cost: 0 };
        }
        
        if (t.type === "sale") {
          grouped[key].sales += t.total;
          grouped[key].count++;
          grouped[key].tax += t.tax;
          t.items.forEach((item: any) => {
            grouped[key].cost += (item.item.cost || 0) * item.quantity;
          });
        } else if (t.type === "refund") {
          grouped[key].refunds += Math.abs(t.total);
          t.items.forEach((item: any) => {
            grouped[key].cost -= (item.item.cost || 0) * item.quantity;
          });
        }
      });
      
      breakdown = Object.entries(grouped)
        .map(([date, data]) => ({
          date,
          ...data,
          net: data.sales - data.refunds,
          profit: data.sales - data.refunds - data.tax - data.cost,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
        
    } else if (groupBy === "category") {
      const grouped: { [key: string]: { name: string; sales: number; cost: number; quantity: number; count: number } } = {};
      
      transactions.forEach((t: any) => {
        if (t.type !== "sale" || t.status === "deleted") return;
        
        t.items.forEach((item: any) => {
          const cat = item.item.category;
          const catId = cat?.id || "uncategorized";
          const catName = cat?.name || "Uncategorized";
          
          if (!grouped[catId]) {
            grouped[catId] = { name: catName, sales: 0, cost: 0, quantity: 0, count: 0 };
          }
          
          grouped[catId].sales += item.lineTotal;
          grouped[catId].cost += (item.item.cost || 0) * item.quantity;
          grouped[catId].quantity += item.quantity;
          grouped[catId].count++;
        });
      });
      
      breakdown = Object.values(grouped)
        .map(data => ({
          ...data,
          profit: data.sales - data.cost,
          margin: data.sales > 0 ? ((data.sales - data.cost) / data.sales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);
      
    } else if (groupBy === "employee") {
      const grouped: { [key: string]: { name: string; sales: number; refunds: number; count: number; refundCount: number } } = {};
      
      transactions.forEach((t: any) => {
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
    
    // Top selling items with profit
    const itemSales: { [key: string]: { id: string; name: string; quantity: number; revenue: number; cost: number } } = {};
    transactions.forEach((t: any) => {
      if (t.type !== "sale" || t.status === "deleted") return;
      t.items.forEach((item: any) => {
        if (!itemSales[item.itemId]) {
          itemSales[item.itemId] = { id: item.itemId, name: item.itemName, quantity: 0, revenue: 0, cost: 0 };
        }
        itemSales[item.itemId].quantity += item.quantity;
        itemSales[item.itemId].revenue += item.lineTotal;
        itemSales[item.itemId].cost += (item.item.cost || 0) * item.quantity;
      });
    });
    
    const topItems = Object.values(itemSales)
      .map(item => ({
        ...item,
        profit: item.revenue - item.cost,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    // Tax breakdown by rate (for state tax reconciliation)
    const taxByRate: { [rate: string]: { rate: number; taxableAmount: number; taxCollected: number; itemCount: number; categoryName: string } } = {};
    
    transactions.forEach((t: any) => {
      if (t.type !== "sale" || t.status === "deleted") return;
      
      t.items.forEach((item: any) => {
        const taxRate = item.item.category?.taxRate || 0;
        const rateKey = taxRate.toFixed(3); // Use 3 decimal places as key
        const categoryName = item.item.category?.name || "No Category (Tax Exempt)";
        
        if (!taxByRate[rateKey]) {
          taxByRate[rateKey] = { 
            rate: taxRate, 
            taxableAmount: 0, 
            taxCollected: 0, 
            itemCount: 0,
            categoryName: taxRate === 0 ? "Tax Exempt Items" : `${(taxRate * 100).toFixed(2)}% Rate Items`
          };
        }
        
        const lineSubtotal = item.lineTotal;
        const lineTax = lineSubtotal * taxRate;
        
        taxByRate[rateKey].taxableAmount += lineSubtotal;
        taxByRate[rateKey].taxCollected += lineTax;
        taxByRate[rateKey].itemCount++;
      });
    });
    
    // Convert to array and sort by tax rate descending
    const taxBreakdown = Object.values(taxByRate)
      .sort((a, b) => b.rate - a.rate)
      .map(entry => ({
        rate: entry.rate,
        ratePercent: (entry.rate * 100).toFixed(2),
        taxableAmount: entry.taxableAmount,
        taxCollected: entry.taxCollected,
        itemCount: entry.itemCount,
        categoryName: entry.categoryName
      }));
    
    return NextResponse.json({
      summary,
      breakdown,
      topItems,
      taxBreakdown,
      transactionCount: transactions.length,
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
