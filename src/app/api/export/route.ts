import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";
import { toCsv, toJson, toXlsx, exportFilename } from "@/lib/export/exporters";
import {
  isValidExportFormat,
  isValidId,
  sanitizeText,
} from "@/lib/security";

function buildWhere(q: URLSearchParams) {
  const AND: unknown[] = [];
  const projectId = q.get("projectId");
  if (projectId && isValidId(projectId)) AND.push({ projectId });
  const searchHistoryId = q.get("searchHistoryId");
  if (searchHistoryId && isValidId(searchHistoryId)) AND.push({ searchHistoryId });
  const fa = q.get("websiteAvailable");
  if (fa === "true") AND.push({ website: { not: null } });
  if (fa === "false") AND.push({ website: null });
  const ea = q.get("emailAvailable");
  if (ea === "true") AND.push({ email: { not: null } });
  if (ea === "false") AND.push({ email: null });
  const pa = q.get("phoneAvailable");
  if (pa === "true") AND.push({ phone: { not: null } });
  if (pa === "false") AND.push({ phone: null });
  const category = sanitizeText(q.get("category"), 60);
  if (category) AND.push({ category });
  const city = sanitizeText(q.get("city"), 120);
  if (city) AND.push({ city });
  const state = sanitizeText(q.get("state"), 120);
  if (state) AND.push({ state });
  const search = sanitizeText(q.get("search"), 100);
  if (search)
    AND.push({
      OR: [
        { name: { contains: search } },
        { address: { contains: search } },
        { email: { contains: search } },
      ],
    });
  return { AND };
}

/**
 * GET /api/export?history=1                         → export history JSON
 * GET /api/export?format=csv|xlsx|json&<filters>    → file download
 *
 * The download filename is ALWAYS server-generated (timestamped) — user input
 * never influences the path or Content-Disposition header, preventing path
 * traversal / header injection.
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
  const formatParam = searchParams.get("format") ?? "csv";
  if (!isValidExportFormat(formatParam)) {
    return NextResponse.json({ error: "unsupported format" }, { status: 400 });
  }
  const format = formatParam;

  const where = buildWhere(searchParams);
  const rows = await db.business.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const records = rows.map(toBusinessRecord);
  // Filename is fully server-controlled (no user input) → safe to use verbatim.
  const filename = exportFilename(format);
  // Double-check filename has no path separators (defense in depth).
  if (/[\\/]/.test(filename)) {
    return NextResponse.json({ error: "filename error" }, { status: 500 });
  }

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
      projectId:
        searchParams.get("projectId") && isValidId(searchParams.get("projectId")!)
          ? searchParams.get("projectId")
          : null,
    },
  });

  // Safe Content-Disposition: only the server-generated filename, quoted.
  const cd = `attachment; filename="${filename}"`;
  if (format === "json") {
    return new NextResponse(toJson(records), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": cd,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (format === "csv") {
    return new NextResponse(toCsv(records), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": cd,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const buf = toXlsx(records);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": cd,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
