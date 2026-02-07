export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, pin, isManager, isActive } = await req.json();
    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        name,
        pin,
        isManager,
        isActive,
      },
    });
    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Error updating employee:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "An employee with this PIN already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.employee.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}