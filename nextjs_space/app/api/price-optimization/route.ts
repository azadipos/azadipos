export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const itemId = searchParams.get("itemId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    // If itemId provided, get detailed analysis for that item
    if (itemId) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          name: true,
          barcode: true,
          price: true,
          cost: true,
          category: { select: { name: true } },
        },
      });
      
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      
      // Build date filter
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      
      // Get all transaction items for this item in period
      const transactionItems = await prisma.transactionItem.findMany({
        where: {
          itemId,
          transaction: {
            companyId,
            type: "sale",
            status: "completed",
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          },
        },
        include: {
          transaction: {
            select: { createdAt: true },
          },
        },
      });
      
      // Get price history for this item
      const priceHistory = await prisma.itemPriceHistory.findMany({
        where: { itemId },
        orderBy: { startDate: "asc" },
      });
      
      // Get cost history from receiving logs
      const receivingLogs = await prisma.receivingLog.findMany({
        where: {
          companyId,
          itemsJson: { not: null },
        },
        orderBy: { createdAt: "asc" },
      });
      
      // Parse cost history from receiving logs
      const costHistory: { date: Date; cost: number }[] = [];
      for (const log of receivingLogs) {
        if (log.itemsJson) {
          try {
            const items = JSON.parse(log.itemsJson);
            const matchingItem = items.find((i: any) => i.itemId === itemId || i.barcode === item.barcode);
            if (matchingItem && matchingItem.cost) {
              costHistory.push({ date: log.createdAt, cost: matchingItem.cost });
            }
          } catch (e: any) {
            // Skip invalid JSON
          }
        }
      }
      
      // Group transactions by price point
      const pricePointAnalysis: Record<string, {
        price: number;
        totalQuantity: number;
        totalRevenue: number;
        totalCost: number;
        totalProfit: number;
        transactionCount: number;
        dates: { start: Date; end: Date } | null;
      }> = {};
      
      for (const ti of transactionItems) {
        const priceKey = ti.unitPrice.toFixed(2);
        
        // Find the cost at time of transaction
        let costAtTime = item.cost;
        for (let i = costHistory.length - 1; i >= 0; i--) {
          if (costHistory[i].date <= ti.transaction.createdAt) {
            costAtTime = costHistory[i].cost;
            break;
          }
        }
        
        if (!pricePointAnalysis[priceKey]) {
          pricePointAnalysis[priceKey] = {
            price: ti.unitPrice,
            totalQuantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0,
            transactionCount: 0,
            dates: null,
          };
        }
        
        const analysis = pricePointAnalysis[priceKey];
        analysis.totalQuantity += Math.abs(ti.quantity);
        analysis.totalRevenue += Math.abs(ti.lineTotal);
        analysis.totalCost += Math.abs(ti.quantity) * costAtTime;
        analysis.totalProfit += Math.abs(ti.lineTotal) - (Math.abs(ti.quantity) * costAtTime);
        analysis.transactionCount += 1;
        
        // Track date range for this price point
        const txDate = new Date(ti.transaction.createdAt);
        if (!analysis.dates) {
          analysis.dates = { start: txDate, end: txDate };
        } else {
          if (txDate < analysis.dates.start) analysis.dates.start = txDate;
          if (txDate > analysis.dates.end) analysis.dates.end = txDate;
        }
      }
      
      // Calculate metrics for each price point
      const pricePoints = Object.values(pricePointAnalysis).map(pp => ({
        ...pp,
        profitMargin: pp.totalRevenue > 0 ? (pp.totalProfit / pp.totalRevenue) * 100 : 0,
        avgQuantityPerDay: pp.dates 
          ? pp.totalQuantity / Math.max(1, Math.ceil((pp.dates.end.getTime() - pp.dates.start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
          : pp.totalQuantity,
        profitPerUnit: pp.totalQuantity > 0 ? pp.totalProfit / pp.totalQuantity : 0,
      })).sort((a, b) => b.price - a.price);
      
      // Calculate elasticity between price points
      const elasticityData: { fromPrice: number; toPrice: number; elasticity: number; interpretation: string }[] = [];
      for (let i = 0; i < pricePoints.length - 1; i++) {
        const higher = pricePoints[i];
        const lower = pricePoints[i + 1];
        
        if (higher.avgQuantityPerDay > 0 && lower.avgQuantityPerDay > 0) {
          const priceChange = (higher.price - lower.price) / lower.price;
          const quantityChange = (lower.avgQuantityPerDay - higher.avgQuantityPerDay) / higher.avgQuantityPerDay;
          const elasticity = priceChange !== 0 ? quantityChange / priceChange : 0;
          
          elasticityData.push({
            fromPrice: higher.price,
            toPrice: lower.price,
            elasticity: elasticity,
            interpretation: Math.abs(elasticity) > 1 ? "Elastic (price sensitive)" : "Inelastic (price insensitive)",
          });
        }
      }
      
      // Find optimal price point (highest total profit)
      const optimalPricePoint = pricePoints.reduce((best: any, current: any) => 
        current.totalProfit > best.totalProfit ? current : best, 
        pricePoints[0] || { price: item.price, totalProfit: 0 }
      );
      
      return NextResponse.json({
        item,
        pricePoints,
        priceHistory,
        costHistory,
        elasticityData,
        optimalPricePoint,
        summary: {
          totalTransactions: transactionItems.length,
          totalQuantitySold: transactionItems.reduce((sum: number, ti: any) => sum + Math.abs(ti.quantity), 0),
          totalRevenue: transactionItems.reduce((sum: number, ti: any) => sum + Math.abs(ti.lineTotal), 0),
          currentPrice: item.price,
          currentCost: item.cost,
          pricePointCount: pricePoints.length,
        },
      });
    }
    
    // No itemId - return list of items with basic sales stats
    const items = await prisma.item.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        barcode: true,
        price: true,
        cost: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error in price optimization:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
