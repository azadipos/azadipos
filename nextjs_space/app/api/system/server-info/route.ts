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
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  return NextResponse.json({
    status: "running",
    version,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    uptimeSeconds: Math.floor(uptime),
    hostname: os.hostname(),
    platform: os.platform(),
    memoryUsage: {
      total: Math.round(os.totalmem() / 1024 / 1024),
      free: Math.round(os.freemem() / 1024 / 1024),
      used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
    },
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
  });
}
