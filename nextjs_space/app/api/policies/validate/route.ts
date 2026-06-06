export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Validate if a return is allowed based on policy settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, transactionId, itemId } = body;
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Get company default return period
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultReturnPeriodDays: true },
    });
    
    const defaultPeriod = company?.defaultReturnPeriodDays ?? 30;
    
    // If checking transaction age
    if (transactionId) {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          createdAt: true,
          type: true,
          status: true,
        },
      });
      
      if (!transaction) {
        return NextResponse.json({
          allowed: false,
          reason: "Transaction not found",
        });
      }
      
      if (transaction.type !== "sale") {
        return NextResponse.json({
          allowed: false,
          reason: "Only sale transactions can be returned",
        });
      }
      
      if (transaction.status === "refunded" || transaction.status === "deleted") {
        return NextResponse.json({
          allowed: false,
          reason: "Transaction has already been refunded or voided",
        });
      }
      
      const transactionDate = new Date(transaction.createdAt);
      const daysSincePurchase = Math.floor((Date.now() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSincePurchase > defaultPeriod) {
        return NextResponse.json({
          allowed: false,
          reason: `Transaction is ${daysSincePurchase} days old. Maximum return period is ${defaultPeriod} days.`,
          daysSincePurchase,
          maxDays: defaultPeriod,
        });
      }
      
      return NextResponse.json({
        allowed: true,
        daysSincePurchase,
        maxDays: defaultPeriod,
      });
    }
    
    // If checking item return policy
    if (itemId) {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          name: true,
          noReturns: true,
          returnPeriodDays: true,
          category: {
            select: {
              returnPeriodDays: true,
            },
          },
        },
      });
      
      if (!item) {
        return NextResponse.json({
          allowed: false,
          reason: "Item not found",
        });
      }
      
      // Check item-level no return policy
      if (item.noReturns) {
        return NextResponse.json({
          allowed: false,
          reason: `"${item.name}" is marked as non-returnable`,
          isNonReturnable: true,
        });
      }
      
      // Determine the effective return period (item > category > company default)
      const effectivePeriod = item.returnPeriodDays 
        ?? item.category?.returnPeriodDays 
        ?? defaultPeriod;
      
      return NextResponse.json({
        allowed: true,
        effectiveReturnPeriod: effectivePeriod,
        source: item.returnPeriodDays ? "item" : item.category?.returnPeriodDays ? "category" : "default",
      });
    }
    
    return NextResponse.json({
      allowed: true,
      defaultReturnPeriodDays: defaultPeriod,
    });
  } catch (error) {
    console.error("Error validating return policy:", error);
    return NextResponse.json({ error: "Failed to validate policy" }, { status: 500 });
  }
}
