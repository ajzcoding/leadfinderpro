import { NextRequest, NextResponse } from "next/server";
import { getLogs } from "@/lib/logging";

/** GET /api/logs?level=&limit= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = (searchParams.get("level") ?? undefined) as
    | "info"
    | "warn"
    | "error"
    | undefined;
  const limit = Math.min(500, parseInt(searchParams.get("limit") ?? "150", 10));
  const rows = await getLogs(limit, level);
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      level: r.level,
      category: r.category,
      message: r.message,
      meta: r.meta,
      timestamp: r.timestamp.toISOString(),
    })),
  );
}
