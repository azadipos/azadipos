export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { companyId, pin } = await req.json();
    
    if (!companyId || !pin) {
      return NextResponse.json({ error: "Company ID and PIN are required" }, { status: 400 });
    }
    
    const employee = await prisma.employee.findFirst({
      where: {
        companyId,
        pin,
        isActive: true,
      },
    });
    
    if (!employee) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
    
    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      isManager: employee.isManager,
    });
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return NextResponse.json({ error: "Failed to verify PIN" }, { status: 500 });
  }
}