import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shifts = await prisma.shift.findMany({
      where: { employeeId: params.id },
      orderBy: { startTime: "desc" },
      take: 50,
    });
    
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Fetch shifts error:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}
