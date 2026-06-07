export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// In-memory store for terminal heartbeats
// In production, this persists as long as the server process runs
interface TerminalInfo {
  terminalId: string;
  name: string;
  ip: string;
  status: string;
  lastSeen: number;
  shiftOpen: boolean;
  employeeName?: string;
  version?: string;
}

const terminals: Map<string, TerminalInfo> = new Map();

// Clean up terminals not seen in 2 minutes
function cleanStale() {
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const [id, info] of terminals) {
    if (info.lastSeen < cutoff) {
      terminals.delete(id);
    }
  }
}

// POST - terminal sends heartbeat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { terminalId, name, status, shiftOpen, employeeName, version } = body;

    if (!terminalId) {
      return NextResponse.json({ error: "terminalId required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    terminals.set(terminalId, {
      terminalId,
      name: name || `Terminal ${terminalId}`,
      ip: typeof ip === "string" ? ip : ip,
      status: status || "online",
      lastSeen: Date.now(),
      shiftOpen: shiftOpen || false,
      employeeName: employeeName || undefined,
      version: version || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET - server fetches list of connected terminals
export async function GET() {
  cleanStale();

  const now = Date.now();
  const list = Array.from(terminals.values()).map((t) => ({
    ...t,
    isOnline: now - t.lastSeen < 60000, // online if seen in last 60s
    lastSeenAgo: Math.round((now - t.lastSeen) / 1000), // seconds ago
  }));

  // Sort: online first, then by name
  list.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    terminalCount: list.length,
    onlineCount: list.filter((t) => t.isOnline).length,
    terminals: list,
  });
}
