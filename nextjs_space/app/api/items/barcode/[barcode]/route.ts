export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { barcode: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }
    
    const item = await prisma.item.findFirst({
      where: {
        companyId,
        barcode: params.barcode,
        isActive: true,
      },
      include: {
        category: true,
        vendor: true,
      },
    });
    
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching item by barcode:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}