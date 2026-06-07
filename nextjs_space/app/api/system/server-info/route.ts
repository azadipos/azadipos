export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";

export async function GET() {
  // Read version from package.json
  let version = "1.0.0";
  try {
    const pkgPaths = [
      path.join(process.cwd(), "package.json"),
      path.join(__dirname, "../../../../package.json"),
    ];
    for (const p of pkgPaths) {
      if (fs.existsSync(p)) {
        const pkg = JSON.parse(fs.readFileSync(p, "utf-8"));
        version = pkg.version || version;
        break;
      }
    }
  } catch {
    // ignore
  }

  const uptime = process.uptime();

  // Get LAN IP addresses
  const interfaces = os.networkInterfaces();
  const lanIPs: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        lanIPs.push(iface.address);
      }
    }
  }

  // Parse DATABASE_URL for connection info (mask password)
  let connectionInfo: { host: string; port: string; database: string; username: string; password: string; connectionString: string } | null = null;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const url = new URL(dbUrl);
      connectionInfo = {
        host: url.hostname,
        port: url.port || "5432",
        database: url.pathname.replace(/^\//, ""),
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        connectionString: dbUrl,
      };
    } catch {
      // ignore parse errors
    }
  }

  return NextResponse.json({
    status: "running",
    version,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    uptimeSeconds: Math.floor(uptime),
    hostname: os.hostname(),
    platform: os.platform(),
    memoryUsage: {
      totalMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMB: Math.round(os.freemem() / 1024 / 1024),
      usedMB: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
      totalGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
    },
    lanIPs,
    connectionInfo,
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
  });
}
