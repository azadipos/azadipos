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
    
    // Get current item to check for price/cost changes
    const currentItem = await prisma.item.findUnique({
      where: { id: params.id },
      select: { price: true, cost: true },
    });
    
    const newPrice = data.price !== undefined ? parseFloat(data.price) : undefined;
    const newCost = data.cost !== undefined ? parseFloat(data.cost) : undefined;
    
    // Track price/cost changes for price optimization
    if (currentItem && (newPrice !== undefined || newCost !== undefined)) {
      const priceChanged = newPrice !== undefined && newPrice !== currentItem.price;
      const costChanged = newCost !== undefined && newCost !== currentItem.cost;
      
      if (priceChanged || costChanged) {
        // End the current price history entry
        await prisma.itemPriceHistory.updateMany({
          where: {
            itemId: params.id,
            endDate: null,
          },
          data: {
            endDate: new Date(),
          },
        });
        
        // Create new price history entry
        await prisma.itemPriceHistory.create({
          data: {
            itemId: params.id,
            price: newPrice ?? currentItem.price,
            cost: newCost ?? currentItem.cost,
          },
        });
      }
    }
    
    const item = await prisma.item.update({
      where: { id: params.id },
      data: {
        barcode: data.barcode,
        name: data.name,
        price: newPrice,
        cost: newCost,
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