export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    let config = await prisma.loyaltyConfig.findUnique({
      where: { companyId },
    });
    
    // Return default config if none exists
    if (!config) {
      return NextResponse.json({
        id: null,
        companyId,
        pointsPerDollar: 1,
        rewardTiersJson: JSON.stringify([
          { points: 100, type: "percent_off", value: 5, description: "5% off your purchase" },
          { points: 250, type: "cash_off", value: 5, description: "$5 off your purchase" },
          { points: 500, type: "cash_off", value: 15, description: "$15 off your purchase" },
        ]),
        isEnabled: false,
      });
    }
    
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching loyalty config:", error);
    return NextResponse.json({ error: "Failed to fetch loyalty config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, pointsPerDollar, rewardTiers, isEnabled } = data;
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const config = await prisma.loyaltyConfig.upsert({
      where: { companyId },
      update: {
        pointsPerDollar: pointsPerDollar ?? 1,
        rewardTiersJson: rewardTiers ? JSON.stringify(rewardTiers) : undefined,
        isEnabled: isEnabled ?? true,
      },
      create: {
        companyId,
        pointsPerDollar: pointsPerDollar ?? 1,
        rewardTiersJson: rewardTiers ? JSON.stringify(rewardTiers) : JSON.stringify([]),
        isEnabled: isEnabled ?? true,
      },
    });
    
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error saving loyalty config:", error);
    return NextResponse.json({ error: "Failed to save loyalty config" }, { status: 500 });
  }
}

// Check available rewards for a customer
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const customerId = searchParams.get("customerId");
    
    if (!companyId || !customerId) {
      return NextResponse.json({ error: "companyId and customerId required" }, { status: 400 });
    }
    
    const [config, customer] = await Promise.all([
      prisma.loyaltyConfig.findUnique({ where: { companyId } }),
      prisma.customer.findUnique({ where: { id: customerId } }),
    ]);
    
    if (!config || !config.isEnabled) {
      return NextResponse.json({ availableRewards: [], customerPoints: 0 });
    }
    
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    
    // Parse reward tiers and find available ones
    const tiers = config.rewardTiersJson ? JSON.parse(config.rewardTiersJson) : [];
    const availableRewards = tiers.filter((tier: any) => customer.loyaltyPoints >= tier.points);
    
    return NextResponse.json({
      availableRewards,
      customerPoints: customer.loyaltyPoints,
      nextReward: tiers.find((tier: any) => tier.points > customer.loyaltyPoints) || null,
    });
  } catch (error) {
    console.error("Error checking rewards:", error);
    return NextResponse.json({ error: "Failed to check rewards" }, { status: 500 });
  }
}
