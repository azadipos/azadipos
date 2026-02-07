export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const categories = await prisma.category.findMany({
      where: { companyId: params.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, taxRate, isAgeRestricted, returnPeriodDays } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }
    const category = await prisma.category.create({
      data: {
        companyId: params.id,
        name,
        taxRate: taxRate ?? 0,
        isAgeRestricted: isAgeRestricted ?? false,
        returnPeriodDays: returnPeriodDays ?? 30,
      },
    });
    return NextResponse.json(category);
  } catch (error: any) {
    console.error("Error creating category:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}