export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { name, contactInfo } = await req.json();
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: { name, contactInfo },
    });
    return NextResponse.json(vendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.vendor.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}