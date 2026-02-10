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
    
    const config = await prisma.loyaltyConfig.findUnique({
      where: { companyId },
    });
    
    if (!config) {
      // Return default config if not yet created
      return NextResponse.json({
        companyId,
        pointsPerDollar: 1,
        rewardTiersJson: null,
        isEnabled: true,
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
    const { companyId, isEnabled, pointsPerDollar, rewardTiers } = data;
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const config = await prisma.loyaltyConfig.upsert({
      where: { companyId },
      update: {
        isEnabled: isEnabled ?? true,
        pointsPerDollar: pointsPerDollar ?? 1,
        rewardTiersJson: rewardTiers ? JSON.stringify(rewardTiers) : null,
      },
      create: {
        companyId,
        isEnabled: isEnabled ?? true,
        pointsPerDollar: pointsPerDollar ?? 1,
        rewardTiersJson: rewardTiers ? JSON.stringify(rewardTiers) : null,
      },
    });
    
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error saving loyalty config:", error);
    return NextResponse.json({ error: "Failed to save loyalty config" }, { status: 500 });
  }
}
