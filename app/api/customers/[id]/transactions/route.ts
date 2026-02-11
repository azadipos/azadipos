export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const customerId = params.id;
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    // Verify customer belongs to this company
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    
    // Fetch transactions for this customer
    const transactions = await prisma.transaction.findMany({
      where: {
        customerId,
        companyId,
      },
      select: {
        id: true,
        transactionNumber: true,
        type: true,
        total: true,
        loyaltyPointsEarned: true,
        loyaltyPointsRedeemed: true,
        createdAt: true,
        employee: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to last 100 transactions
    });
    
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching customer transactions:", error);
    return NextResponse.json({ error: "Failed to fetch customer transactions" }, { status: 500 });
  }
}
