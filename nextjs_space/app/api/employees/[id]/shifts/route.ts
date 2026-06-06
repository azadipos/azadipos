import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    
    const shifts = await prisma.shift.findMany({
      where: {
        employeeId,
      },
      orderBy: {
        startTime: "desc",
      },
      take: 20,
    });
    
    return NextResponse.json(shifts);
  } catch (error) {
    console.error("Employee shifts error:", error);
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
  }
}
