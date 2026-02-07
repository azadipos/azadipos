export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTransactionNumber } from "@/lib/helpers";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type");
    
    const where: any = { companyId: params.id };
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59.999Z"),
      };
    } else if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    } else if (endDate) {
      where.createdAt = { lte: new Date(endDate + "T23:59:59.999Z") };
    }
    
    if (type) {
      where.type = type;
    }
    
    const transactions = await prisma.transaction.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    const { employeeId, shiftId, items, paymentMethod, cashGiven, type } = data;
    
    if (!employeeId || !items || items.length === 0) {
      return NextResponse.json({ error: "Employee and items are required" }, { status: 400 });
    }
    
    // Calculate totals with tax
    let subtotal = 0;
    let totalTax = 0;
    
    const itemsWithTax = await Promise.all(
      items.map(async (item: any) => {
        const dbItem = await prisma.item.findUnique({
          where: { id: item.itemId },
          include: { category: true },
        });
        
        const lineTotal = item.quantity * item.unitPrice;
        const taxRate = dbItem?.category?.taxRate ?? 0;
        const lineTax = lineTotal * (taxRate / 100);
        
        subtotal += lineTotal;
        totalTax += lineTax;
        
        return {
          itemId: item.itemId,
          itemName: dbItem?.name ?? item.itemName ?? "Unknown",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
          isWeightItem: item.isWeightItem ?? false,
        };
      })
    );
    
    const total = Math.round((subtotal + totalTax) * 100) / 100;
    const changeDue = cashGiven ? Math.round((cashGiven - total) * 100) / 100 : null;
    
    const transaction = await prisma.transaction.create({
      data: {
        companyId: params.id,
        employeeId,
        shiftId: shiftId || null,
        transactionNumber: generateTransactionNumber(),
        type: type || "sale",
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(totalTax * 100) / 100,
        total,
        paymentMethod: paymentMethod || "cash",
        cashGiven: cashGiven || null,
        changeDue,
        items: {
          create: itemsWithTax,
        },
      },
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
    
    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}