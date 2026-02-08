import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    
    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        name: body.name,
        pin: body.pin,
        isManager: body.isManager,
        isActive: body.isActive,
      },
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
