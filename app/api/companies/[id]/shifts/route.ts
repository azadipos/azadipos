export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    
    const where: any = { companyId: params.id };
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    
    const shifts = await prisma.shift.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true },
        },
        transactions: {
          select: { id: true, total: true, paymentMethod: true },
        },
      },
      orderBy: { startTime: "desc" },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { employeeId, registerId, openingBalance } = await req.json();
    
    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }
    
    // Check if employee already has an open shift
    const existingShift = await prisma.shift.findFirst({
      where: {
        companyId: params.id,
        employeeId,
        status: "open",
      },
    });
    
    if (existingShift) {
      return NextResponse.json(existingShift);
    }
    
    const shift = await prisma.shift.create({
      data: {
        companyId: params.id,
        employeeId,
        registerId: registerId || null,
        openingBalance: openingBalance ?? 0,
        status: "open",
      },
      include: {
        employee: {
          select: { id: true, name: true },
        },
      },
    });
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error creating shift:", error);
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
  }
}