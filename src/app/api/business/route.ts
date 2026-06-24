import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";
import { scanWebsite } from "@/lib/scan/scanner";
import {
  isValidId,
  sanitizeText,
  safePublicUrl,
  readJsonBody,
} from "@/lib/security";
import type { ResultFilter } from "@/lib/types";

const ALLOWED_STATUS = ["active", "inactive", "none", "unknown"] as const;

function buildWhere(filter: ResultFilter = {}) {
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
  return { AND: and };
}

/**
 * GET /api/business?page=&pageSize=&<filters>
 * Returns a paginated list of businesses matching the filter.
 * All query params are validated + bounded.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50),
  );

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

  // Validate ids before using them in queries.
  const projectId = searchParams.get("projectId");
  if (projectId && isValidId(projectId)) filter.projectId = projectId;
  const searchHistoryId = searchParams.get("searchHistoryId");
  if (searchHistoryId && isValidId(searchHistoryId)) filter.searchHistoryId = searchHistoryId;

  // Sanitize free-text filters.
  filter.category = sanitizeText(searchParams.get("category"), 60) ?? null;
  filter.city = sanitizeText(searchParams.get("city"), 120) ?? null;
  filter.state = sanitizeText(searchParams.get("state"), 120) ?? null;
  filter.search = sanitizeText(searchParams.get("search"), 100) ?? null;

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
  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body;
  const id = body.id;
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.projectId !== undefined) {
    // null or a valid id only
    data.projectId =
      body.projectId === null || body.projectId === ""
        ? null
        : typeof body.projectId === "string" && isValidId(body.projectId)
          ? body.projectId
          : undefined;
    if (data.projectId === undefined) {
      return NextResponse.json({ error: "invalid projectId" }, { status: 400 });
    }
  }
  if (body.websiteStatus !== undefined) {
    if (!ALLOWED_STATUS.includes(body.websiteStatus as (typeof ALLOWED_STATUS)[number])) {
      return NextResponse.json({ error: "invalid websiteStatus" }, { status: 400 });
    }
    data.websiteStatus = body.websiteStatus;
  }
  if (body.email !== undefined) {
    const email = sanitizeText(body.email, 254);
    data.email = email && email.includes("@") ? email : null;
  }
  if (body.phone !== undefined) {
    data.phone = sanitizeText(body.phone, 40);
  }
  if (body.socialLinks !== undefined) {
    if (typeof body.socialLinks !== "object" || body.socialLinks === null) {
      return NextResponse.json({ error: "socialLinks must be an object" }, { status: 400 });
    }
    // Validate each social link is a safe http(s) URL.
    const socials = body.socialLinks as Record<string, unknown>;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(socials)) {
      if (typeof k !== "string" || k.length > 30) continue;
      const url = safePublicUrl(String(v));
      if (url) cleaned[k] = url;
    }
    data.socialLinks = Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
  }

  try {
    const updated = await db.business.update({ where: { id }, data });
    return NextResponse.json(toBusinessRecord(updated));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

/** DELETE /api/business?id=<id> */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !isValidId(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }
  try {
    await db.business.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/business  { action: "scan", id }
 * Re-scan a single business website for public contact info.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.body;
  if (body.action !== "scan" || typeof body.id !== "string" || !isValidId(body.id)) {
    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  }
  const b = await db.business.findUnique({ where: { id: body.id } });
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Re-validate the stored website URL (SSRF safety) before scanning.
  const safeUrl = safePublicUrl(b.website ?? "");
  if (!safeUrl) {
    return NextResponse.json({ error: "no safe website to scan" }, { status: 400 });
  }
  const scan = await scanWebsite(safeUrl);
  let existingSocials: Record<string, string> = {};
  if (b.socialLinks) {
    try {
      existingSocials = JSON.parse(b.socialLinks) as Record<string, string>;
    } catch {
      existingSocials = {};
    }
  }
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
