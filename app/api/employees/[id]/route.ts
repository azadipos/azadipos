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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
    });
    
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Employee fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // If regenerateBarcode is requested, generate a new one
    let newBarcode = body.barcode;
    if (body.regenerateBarcode) {
      const employee = await prisma.employee.findUnique({
        where: { id: params.id },
      });
      if (employee) {
        newBarcode = generateEmployeeBarcode();
        let attempts = 0;
        while (attempts < 10) {
          const existing = await prisma.employee.findFirst({
            where: { companyId: employee.companyId, barcode: newBarcode, id: { not: params.id } },
          });
          if (!existing) break;
          newBarcode = generateEmployeeBarcode();
          attempts++;
        }
      }
    }
    
    const updateData: any = {
      name: body.name,
      isManager: body.isManager,
      isActive: body.isActive,
      inSales: body.inSales ?? true,
    };
    
    if (newBarcode !== undefined) {
      updateData.barcode = newBarcode;
    }
    
    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: updateData,
    });
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Employee update error:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.employee.delete({
      where: { id: params.id },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee delete error:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
