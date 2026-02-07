export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            item: {
              select: { id: true, name: true, barcode: true },
            },
          },
        },
      },
    });
    
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
  }
}