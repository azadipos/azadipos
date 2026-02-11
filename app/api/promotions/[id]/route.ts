import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const promotion = await prisma.promotion.findUnique({
    where: { id: params.id },
  });
  
  if (!promotion) {
    return NextResponse.json({ error: "Promotion not found" }, { status: 404 });
  }
  
  return NextResponse.json(promotion);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, type, configJson, startDate, endDate, isActive } = body;
    
    const promotion = await prisma.promotion.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(configJson !== undefined && { configJson: configJson ? JSON.stringify(configJson) : null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    
    return NextResponse.json(promotion);
  } catch (error) {
    console.error("Update promotion error:", error);
    return NextResponse.json({ error: "Failed to update promotion" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.promotion.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete promotion error:", error);
    return NextResponse.json({ error: "Failed to delete promotion" }, { status: 500 });
  }
}
