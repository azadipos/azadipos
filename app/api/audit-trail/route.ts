export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const action = searchParams.get("action");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    const where: any = { companyId };
    
    if (action && action !== "all") {
      where.action = action;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    
    const [entries, total] = await Promise.all([
      prisma.auditTrail.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditTrail.count({ where }),
    ]);
    
    return NextResponse.json({ entries, total });
  } catch (error) {
    console.error("Error fetching audit trail:", error);
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 });
  }
}

// Create audit trail entry (for internal use)
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, action, entityType, entityId, description, employeeId, employeeName, authorizedById, authorizedByName, metadata } = data;
    
    if (!companyId || !action || !entityType || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const entry = await prisma.auditTrail.create({
      data: {
        companyId,
        action,
        entityType,
        entityId,
        description,
        employeeId,
        employeeName,
        authorizedById,
        authorizedByName,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    
    return NextResponse.json(entry);
  } catch (error) {
    console.error("Error creating audit trail entry:", error);
    return NextResponse.json({ error: "Failed to create audit trail entry" }, { status: 500 });
  }
}

// Delete audit trail entries
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const id = searchParams.get("id");
    const beforeDate = searchParams.get("beforeDate");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    // Delete single entry
    if (id) {
      await prisma.auditTrail.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: "Entry deleted" });
    }
    
    // Delete entries before a date (bulk cleanup)
    if (beforeDate) {
      const result = await prisma.auditTrail.deleteMany({
        where: {
          companyId,
          createdAt: { lt: new Date(beforeDate) },
        },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }
    
    return NextResponse.json({ error: "Provide id or beforeDate" }, { status: 400 });
  } catch (error) {
    console.error("Error deleting audit trail:", error);
    return NextResponse.json({ error: "Failed to delete audit trail" }, { status: 500 });
  }
}
