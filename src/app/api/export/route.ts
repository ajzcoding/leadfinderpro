import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";
import { toCsv, toJson, toXlsx, exportFilename } from "@/lib/export/exporters";

function buildWhere(q: URLSearchParams) {
  const AND: unknown[] = [];
  if (q.get("projectId")) AND.push({ projectId: q.get("projectId") });
  if (q.get("searchHistoryId")) AND.push({ searchHistoryId: q.get("searchHistoryId") });
  const fa = q.get("websiteAvailable");
  if (fa === "true") AND.push({ website: { not: null } });
  if (fa === "false") AND.push({ website: null });
  const ea = q.get("emailAvailable");
  if (ea === "true") AND.push({ email: { not: null } });
  if (ea === "false") AND.push({ email: null });
  const pa = q.get("phoneAvailable");
  if (pa === "true") AND.push({ phone: { not: null } });
  if (pa === "false") AND.push({ phone: null });
  if (q.get("category")) AND.push({ category: q.get("category") });
  if (q.get("city")) AND.push({ city: q.get("city") });
  if (q.get("state")) AND.push({ state: q.get("state") });
  if (q.get("search"))
    AND.push({
      OR: [
        { name: { contains: q.get("search")! } },
        { address: { contains: q.get("search")! } },
        { email: { contains: q.get("search")! } },
      ],
    });
  return { AND };
}

/**
 * GET /api/export?history=1                         → export history JSON
 * GET /api/export?format=csv|xlsx|json&<filters>    → file download
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // --- Export history list ---
  if (searchParams.get("history")) {
    const rows = await db.exportHistory.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        format: r.format,
        count: r.count,
        filename: r.filename,
        filter: r.filter,
        projectId: r.projectId,
        date: r.date.toISOString(),
      })),
    );
  }

  // --- File download ---
  const format = (searchParams.get("format") ?? "csv") as "csv" | "xlsx" | "json";
  if (!["csv", "xlsx", "json"].includes(format)) {
    return NextResponse.json({ error: "unsupported format" }, { status: 400 });
  }
  const where = buildWhere(searchParams);
  const rows = await db.business.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const records = rows.map(toBusinessRecord);
  const filename = exportFilename(format);

  await db.exportHistory.create({
    data: {
      format,
      count: records.length,
      filename,
      filter: JSON.stringify({
        projectId: searchParams.get("projectId"),
        searchHistoryId: searchParams.get("searchHistoryId"),
        websiteAvailable: searchParams.get("websiteAvailable"),
        emailAvailable: searchParams.get("emailAvailable"),
        phoneAvailable: searchParams.get("phoneAvailable"),
        category: searchParams.get("category"),
        city: searchParams.get("city"),
        state: searchParams.get("state"),
        search: searchParams.get("search"),
      }),
      projectId: searchParams.get("projectId"),
    },
  });

  if (format === "json") {
    return new NextResponse(toJson(records), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  if (format === "csv") {
    return new NextResponse(toCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const buf = toXlsx(records);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
