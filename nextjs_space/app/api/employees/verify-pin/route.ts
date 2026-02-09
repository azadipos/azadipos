export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { companyId, pin, barcode } = await req.json();
    
    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }
    
    if (!pin && !barcode) {
      return NextResponse.json({ error: "PIN or barcode is required" }, { status: 400 });
    }
    
    // Search by barcode first (preferred method), then fallback to legacy PIN
    let employee = null;
    
    if (barcode) {
      employee = await prisma.employee.findFirst({
        where: {
          companyId,
          barcode,
          isActive: true,
        },
      });
    } else if (pin) {
      employee = await prisma.employee.findFirst({
        where: {
          companyId,
          pin,
          isActive: true,
        },
      });
    }
    
    if (!employee) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      isManager: employee.isManager,
      barcode: employee.barcode,
    });
  } catch (error) {
    console.error("Error verifying credentials:", error);
    return NextResponse.json({ error: "Failed to verify credentials" }, { status: 500 });
  }
}