import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const transactionNumber = searchParams.get("transactionNumber");
  
  if (!companyId || !transactionNumber) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }
  
  const transaction = await prisma.transaction.findFirst({
    where: {
      companyId,
      transactionNumber: {
        contains: transactionNumber,
        mode: "insensitive",
      },
    },
    include: {
      items: true,
      employee: {
        select: { id: true, name: true },
      },
    },
  });
  
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  
  return NextResponse.json(transaction);
}
