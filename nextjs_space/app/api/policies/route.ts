export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Get company default return period
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultReturnPeriodDays: true },
    });
    
    // Get all return policies
    const policies = await prisma.returnPolicy.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    
    // Get categories with their return periods
    const categories = await prisma.category.findMany({
      where: { companyId },
      select: { id: true, name: true, returnPeriodDays: true },
      orderBy: { name: "asc" },
    });
    
    // Get items with custom return policies
    const itemsWithCustomPolicy = await prisma.item.findMany({
      where: {
        companyId,
        OR: [
          { returnPeriodDays: { not: null } },
          { noReturns: true },
        ],
      },
      select: {
        id: true,
        name: true,
        barcode: true,
        returnPeriodDays: true,
        noReturns: true,
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json({
      defaultReturnPeriodDays: company?.defaultReturnPeriodDays ?? 30,
      policies,
      categories,
      itemsWithCustomPolicy,
    });
  } catch (error) {
    console.error("Error fetching policies:", error);
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, targetType, targetId, returnPeriodDays, noReturns } = body;
    
    if (!companyId || !targetType || !targetId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Create or update the policy
    const policy = await prisma.returnPolicy.upsert({
      where: {
        companyId_targetType_targetId: {
          companyId,
          targetType,
          targetId,
        },
      },
      update: {
        returnPeriodDays,
        noReturns: noReturns ?? false,
      },
      create: {
        companyId,
        targetType,
        targetId,
        returnPeriodDays,
        noReturns: noReturns ?? false,
      },
    });
    
    // Also update the item or category directly if applicable
    if (targetType === "item") {
      await prisma.item.update({
        where: { id: targetId },
        data: {
          returnPeriodDays,
          noReturns: noReturns ?? false,
        },
      });
    } else if (targetType === "category") {
      await prisma.category.update({
        where: { id: targetId },
        data: {
          returnPeriodDays: returnPeriodDays ?? 30,
        },
      });
    }
    
    return NextResponse.json(policy);
  } catch (error) {
    console.error("Error creating policy:", error);
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, defaultReturnPeriodDays } = body;
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }
    
    // Update company default return period
    const company = await prisma.company.update({
      where: { id: companyId },
      data: { defaultReturnPeriodDays },
    });
    
    return NextResponse.json(company);
  } catch (error) {
    console.error("Error updating company settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");
    
    if (id) {
      await prisma.returnPolicy.delete({
        where: { id },
      });
    }
    
    // Also reset the item or category policy
    if (targetType === "item" && targetId) {
      await prisma.item.update({
        where: { id: targetId },
        data: {
          returnPeriodDays: null,
          noReturns: false,
        },
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting policy:", error);
    return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 });
  }
}
