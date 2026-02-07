export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: { id: true, name: true },
        },
        transactions: {
          include: {
            items: true,
          },
        },
      },
    });
    
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error fetching shift:", error);
    return NextResponse.json({ error: "Failed to fetch shift" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status, closingBalance, cashInjections } = await req.json();
    
    const updateData: any = {};
    
    if (status) updateData.status = status;
    if (closingBalance !== undefined) updateData.closingBalance = closingBalance;
    if (cashInjections !== undefined) updateData.cashInjections = cashInjections;
    if (status === "closed") updateData.endTime = new Date();
    
    const shift = await prisma.shift.update({
      where: { id: params.id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, name: true },
        },
        transactions: {
          select: { id: true, total: true, paymentMethod: true },
        },
      },
    });
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error updating shift:", error);
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 });
  }
}