export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Generate unique employee barcode (EMP-XXXXX format)
function generateEmployeeBarcode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EMP-${code}`;
}

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
    const { name, isManager } = await req.json();
    
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    
    // Generate unique barcode
    let barcode = generateEmployeeBarcode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.employee.findFirst({
        where: { companyId: params.id, barcode },
      });
      if (!existing) break;
      barcode = generateEmployeeBarcode();
      attempts++;
    }
    
    const employee = await prisma.employee.create({
      data: {
        companyId: params.id,
        name,
        barcode,
        isManager: isManager ?? false,
      },
    });
    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Error creating employee:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Failed to generate unique barcode" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}