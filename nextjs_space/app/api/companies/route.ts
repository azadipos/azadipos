export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(companies);
  } catch (error: any) {
    console.error('Error fetching companies:', error?.message, error?.code);
    return NextResponse.json(
      { error: `Failed to fetch companies: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }
    const company = await prisma.company.create({
      data: { name },
    });
    return NextResponse.json(company);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorCode = error?.code || 'UNKNOWN';
    console.error('Error creating company:', {
      message: errorMessage,
      code: errorCode,
      name: error?.name,
      meta: error?.meta,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return NextResponse.json(
      { error: `Failed to create company: ${errorMessage}` },
      { status: 500 }
    );
  }
}