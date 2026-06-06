import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });
    
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Get shift error:", error);
    return NextResponse.json({ error: "Failed to get shift" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const shift = await prisma.shift.update({
      where: { id: params.id },
      data: body,
    });
    
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Update shift error:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}
