export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    
    const where: any = {
      companyId: params.id,
      isActive: true,
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    const items = await prisma.item.findMany({
      where,
      include: {
        category: true,
        vendor: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    const { barcode, name, price, cost, categoryId, vendorId, reorderPoint, isWeightPriced, imageUrl, quantityOnHand } = data;
    
    if (!barcode || !name || price === undefined) {
      return NextResponse.json({ error: "Barcode, name, and price are required" }, { status: 400 });
    }
    
    const item = await prisma.item.create({
      data: {
        companyId: params.id,
        barcode,
        name,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : 0,
        categoryId: categoryId || null,
        vendorId: vendorId || null,
        reorderPoint: reorderPoint ? parseInt(reorderPoint) : 0,
        isWeightPriced: isWeightPriced ?? false,
        imageUrl: imageUrl || null,
        quantityOnHand: quantityOnHand ? parseInt(quantityOnHand) : 0,
      },
      include: {
        category: true,
        vendor: true,
      },
    });
    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Error creating item:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Item with this barcode already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}