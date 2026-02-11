export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { companyId: params.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, contactInfo } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }
    const vendor = await prisma.vendor.create({
      data: {
        companyId: params.id,
        name,
        contactInfo: contactInfo ?? null,
      },
    });
    return NextResponse.json(vendor);
  } catch (error: any) {
    console.error("Error creating vendor:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Vendor already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}