export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const item = await prisma.item.findUnique({
      where: { id: params.id },
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
    console.error("Error fetching item:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    const item = await prisma.item.update({
      where: { id: params.id },
      data: {
        barcode: data.barcode,
        name: data.name,
        price: data.price !== undefined ? parseFloat(data.price) : undefined,
        cost: data.cost !== undefined ? parseFloat(data.cost) : undefined,
        categoryId: data.categoryId || null,
        vendorId: data.vendorId || null,
        reorderPoint: data.reorderPoint !== undefined ? parseInt(data.reorderPoint) : undefined,
        isWeightPriced: data.isWeightPriced,
        imageUrl: data.imageUrl,
        quantityOnHand: data.quantityOnHand !== undefined ? parseInt(data.quantityOnHand) : undefined,
        isActive: data.isActive,
      },
      include: {
        category: true,
        vendor: true,
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.item.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}