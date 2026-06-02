export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        address: true,
        phone: true,
        receiptHeader: true,
        receiptFooter: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { name, logoUrl, address, phone, receiptHeader, receiptFooter } = body;

    const company = await prisma.company.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(receiptHeader !== undefined && { receiptHeader }),
        ...(receiptFooter !== undefined && { receiptFooter }),
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
