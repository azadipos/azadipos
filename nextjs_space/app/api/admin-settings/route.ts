export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    let settings = await prisma.adminSettings.findUnique({
      where: { companyId },
    });
    
    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          companyId,
          masterCode: "999999", // Default master code
        },
      });
    }
    
    return NextResponse.json({
      id: settings.id,
      companyId: settings.companyId,
      hasPassword: !!settings.adminPassword,
      isLocked: settings.isLocked,
    });
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// Set or update admin password
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { companyId, password, masterCode, action } = data;
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    
    let settings = await prisma.adminSettings.findUnique({
      where: { companyId },
    });
    
    if (!settings) {
      settings = await prisma.adminSettings.create({
        data: {
          companyId,
          masterCode: "999999",
        },
      });
    }
    
    // Action: verify password
    if (action === "verify") {
      if (!password) {
        return NextResponse.json({ error: "Password required" }, { status: 400 });
      }
      
      // Check master code first
      if (password === settings.masterCode) {
        return NextResponse.json({ success: true, usedMasterCode: true });
      }
      
      // Check admin password
      if (!settings.adminPassword) {
        return NextResponse.json({ success: true }); // No password set
      }
      
      const isValid = await bcrypt.compare(password, settings.adminPassword);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
      
      return NextResponse.json({ success: true });
    }
    
    // Action: set new password
    if (action === "setPassword") {
      if (!password || password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await prisma.adminSettings.update({
        where: { companyId },
        data: { 
          adminPassword: hashedPassword,
          isLocked: true,
        },
      });
      
      return NextResponse.json({ success: true, message: "Password set successfully" });
    }
    
    // Action: update master code (requires current master code)
    if (action === "updateMasterCode") {
      const { currentMasterCode, newMasterCode } = data;
      
      if (currentMasterCode !== settings.masterCode) {
        return NextResponse.json({ error: "Invalid current master code" }, { status: 401 });
      }
      
      if (!newMasterCode || newMasterCode.length < 6) {
        return NextResponse.json({ error: "Master code must be at least 6 characters" }, { status: 400 });
      }
      
      await prisma.adminSettings.update({
        where: { companyId },
        data: { masterCode: newMasterCode },
      });
      
      return NextResponse.json({ success: true, message: "Master code updated" });
    }
    
    // Action: remove password (requires master code)
    if (action === "removePassword") {
      if (masterCode !== settings.masterCode) {
        return NextResponse.json({ error: "Invalid master code" }, { status: 401 });
      }
      
      await prisma.adminSettings.update({
        where: { companyId },
        data: { 
          adminPassword: null,
          isLocked: false,
        },
      });
      
      return NextResponse.json({ success: true, message: "Password removed" });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating admin settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
