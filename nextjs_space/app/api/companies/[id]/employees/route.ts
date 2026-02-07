export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const employees = await prisma.employee.findMany({
      where: { companyId: params.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, pin, isManager } = await req.json();
    
    if (!name || !pin) {
      return NextResponse.json({ error: "Name and PIN are required" }, { status: 400 });
    }
    
    if (pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: "PIN must be 4-6 digits" }, { status: 400 });
    }
    
    const employee = await prisma.employee.create({
      data: {
        companyId: params.id,
        name,
        pin,
        isManager: isManager ?? false,
      },
    });
    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Error creating employee:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "An employee with this PIN already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}