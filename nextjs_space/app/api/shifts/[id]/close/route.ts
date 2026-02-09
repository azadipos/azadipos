import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { closingBalance } = body;
    
    const shift = await prisma.shift.update({
      where: { id: params.id },
      data: {
        endTime: new Date(),
        closingBalance: closingBalance ?? null,
        status: "closed",
      },
    });
    
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Close shift error:", error);
    return NextResponse.json({ error: "Failed to close shift" }, { status: 500 });
  }
}
