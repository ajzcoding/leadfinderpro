import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";
import { scanWebsite } from "@/lib/scan/scanner";
import type { ResultFilter } from "@/lib/types";

function buildWhere(filter: ResultFilter = {}) {
  const where: Record<string, unknown> = { AND: [] as unknown[] };
  const and: unknown[] = [];
  if (filter.websiteAvailable === true) and.push({ website: { not: null } });
  if (filter.websiteAvailable === false) and.push({ website: null });
  if (filter.emailAvailable === true) and.push({ email: { not: null } });
  if (filter.emailAvailable === false) and.push({ email: null });
  if (filter.phoneAvailable === true) and.push({ phone: { not: null } });
  if (filter.phoneAvailable === false) and.push({ phone: null });
  if (filter.category) and.push({ category: filter.category });
  if (filter.city) and.push({ city: filter.city });
  if (filter.state) and.push({ state: filter.state });
  if (filter.projectId) and.push({ projectId: filter.projectId });
  if (filter.searchHistoryId) and.push({ searchHistoryId: filter.searchHistoryId });
  if (filter.search) {
    and.push({
      OR: [
        { name: { contains: filter.search } },
        { address: { contains: filter.search } },
        { email: { contains: filter.search } },
      ],
    });
  }
  where.AND = and;
  return where;
}

/**
 * GET /api/business?filter=<json>&page=&pageSize=
 * Returns a paginated list of businesses matching the filter.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)),
  );
  const projectId = searchParams.get("projectId");
  const searchHistoryId = searchParams.get("searchHistoryId");

  const filter: ResultFilter = {};
  const fa = searchParams.get("websiteAvailable");
  if (fa === "true") filter.websiteAvailable = true;
  if (fa === "false") filter.websiteAvailable = false;
  const ea = searchParams.get("emailAvailable");
  if (ea === "true") filter.emailAvailable = true;
  if (ea === "false") filter.emailAvailable = false;
  const pa = searchParams.get("phoneAvailable");
  if (pa === "true") filter.phoneAvailable = true;
  if (pa === "false") filter.phoneAvailable = false;
  if (searchParams.get("category")) filter.category = searchParams.get("category");
  if (searchParams.get("city")) filter.city = searchParams.get("city");
  if (searchParams.get("state")) filter.state = searchParams.get("state");
  if (searchParams.get("search")) filter.search = searchParams.get("search");
  if (projectId) filter.projectId = projectId;
  if (searchHistoryId) filter.searchHistoryId = searchHistoryId;

  const where = buildWhere(filter);
  const [total, rows] = await Promise.all([
    db.business.count({ where }),
    db.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    businesses: rows.map(toBusinessRecord),
  });
}

/**
 * PATCH /api/business
 * Body: { id, projectId?, websiteStatus?, email?, phone?, socialLinks? }
 * Update a business (assign to project, manual edits, etc.)
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body as {
    id: string;
    projectId?: string | null;
    websiteStatus?: string;
    email?: string;
    phone?: string;
    socialLinks?: Record<string, string>;
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (rest.projectId !== undefined) data.projectId = rest.projectId || null;
  if (rest.websiteStatus !== undefined) data.websiteStatus = rest.websiteStatus;
  if (rest.email !== undefined) data.email = rest.email;
  if (rest.phone !== undefined) data.phone = rest.phone;
  if (rest.socialLinks !== undefined) data.socialLinks = JSON.stringify(rest.socialLinks);
  const updated = await db.business.update({ where: { id }, data });
  return NextResponse.json(toBusinessRecord(updated));
}

/**
 * DELETE /api/business?id=<id>
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.business.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/business  { action: "scan", id }
 * Re-scan a single business website for public contact info.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "scan" && body.id) {
    const b = await db.business.findUnique({ where: { id: body.id } });
    if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!b.website)
      return NextResponse.json({ error: "no website to scan" }, { status: 400 });
    const scan = await scanWebsite(b.website);
    const existingSocials = b.socialLinks ? JSON.parse(b.socialLinks) : {};
    const socials = { ...existingSocials, ...scan.socials };
    const updated = await db.business.update({
      where: { id: b.id },
      data: {
        websiteStatus: scan.active ? "active" : "inactive",
        email: b.email ?? scan.emails[0] ?? null,
        phone: b.phone ?? scan.phones[0] ?? null,
        socialLinks: Object.keys(socials).length ? JSON.stringify(socials) : null,
        lastUpdated: new Date(),
      },
    });
    return NextResponse.json(toBusinessRecord(updated));
  }
  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
