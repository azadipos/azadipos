export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const phone = searchParams.get("phone");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    if (phone) {
      // Lookup customer by phone
      const customer = await prisma.customer.findUnique({
        where: {
          companyId_phone: { companyId, phone },
        },
      });
      
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      
      return NextResponse.json(customer);
    }
    
    // Return all customers for the company
    const customers = await prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, phone, name, email } = data;
    
    if (!companyId || !phone || !name) {
      return NextResponse.json({ error: "companyId, phone, and name are required" }, { status: 400 });
    }
    
    // Check if customer already exists
    const existing = await prisma.customer.findUnique({
      where: {
        companyId_phone: { companyId, phone },
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: "Customer with this phone already exists" }, { status: 409 });
    }
    
    const customer = await prisma.customer.create({
      data: {
        companyId,
        phone,
        name,
        email: email || null,
      },
    });
    
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
