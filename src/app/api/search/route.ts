import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSearch } from "@/lib/providers";
import { scanWebsite } from "@/lib/scan/scanner";
import { toBusinessRecord, hashBusiness } from "@/lib/mappers";
import { log } from "@/lib/logging";
import {
  sanitizeText,
  sanitizeRadius,
  sanitizeLimit,
  isValidId,
} from "@/lib/security";

export const maxDuration = 120;

/**
 * POST /api/search
 * Body: SearchParams (validated + sanitized)
 *
 * Executes a provider search, persists businesses (deduping by hash), records
 * search history, and (optionally) scans each website for public contact info.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // --- Validate + sanitize every input field ---
  const body = raw as Record<string, unknown>;
  const params = {
    country: sanitizeText(body.country),
    state: sanitizeText(body.state),
    city: sanitizeText(body.city),
    category: sanitizeText(body.category, 60),
    keyword: sanitizeText(body.keyword, 100),
    radius: sanitizeRadius(body.radius),
    provider: body.provider, // validated inside runSearch
    limit: sanitizeLimit(body.limit),
    scanWebsites: body.scanWebsites === true,
    projectId:
      typeof body.projectId === "string" && isValidId(body.projectId)
        ? body.projectId
        : null,
  };

  // Require at least one location field or a keyword.
  if (!params.country && !params.state && !params.city && !params.keyword) {
    return NextResponse.json(
      { error: "Provide at least a location or a keyword to search." },
      { status: 400 },
    );
  }

  const { records, center, provider } = await runSearch(params);
  if (!records.length) {
    const sh = await db.searchHistory.create({
      data: {
        keyword: params.keyword,
        category: params.category,
        city: params.city,
        state: params.state,
        country: params.country,
        radius: params.radius,
        provider: provider ?? null,
        totalResults: 0,
      },
    });
    return NextResponse.json({
      searchHistoryId: sh.id,
      totalResults: 0,
      businesses: [],
      center: center
        ? { lat: center.lat, lng: center.lng, displayName: center.displayName }
        : null,
    });
  }

  // Persist search history first.
  const searchHistory = await db.searchHistory.create({
    data: {
      keyword: params.keyword,
      category: params.category,
      city: params.city ?? center?.city ?? null,
      state: params.state ?? center?.state ?? null,
      country: params.country ?? center?.country ?? null,
      radius: params.radius,
      provider: provider ?? null,
      totalResults: records.length,
    },
  });

  // Upsert businesses (dedup by hashKey).
  const saved: ReturnType<typeof toBusinessRecord>[] = [];
  for (const r of records) {
    const hash = hashBusiness(r);
    const existing = await db.business.findUnique({ where: { hashKey: hash } });
    if (existing) {
      // Merge socialLinks safely (both sides are already JSON strings).
      let mergedSocials = existing.socialLinks;
      if (r.socialLinks && Object.keys(r.socialLinks).length) {
        try {
          const prev = existing.socialLinks ? JSON.parse(existing.socialLinks) : {};
          mergedSocials = JSON.stringify({ ...prev, ...r.socialLinks });
        } catch {
          mergedSocials = JSON.stringify(r.socialLinks);
        }
      }
      const updated = await db.business.update({
        where: { id: existing.id },
        data: {
          website: r.website ?? existing.website,
          websiteStatus: r.websiteStatus ?? existing.websiteStatus,
          phone: r.phone ?? existing.phone,
          email: r.email ?? existing.email,
          socialLinks: mergedSocials,
          lastUpdated: new Date(),
          projectId: params.projectId ?? existing.projectId,
          searchHistoryId: searchHistory.id,
        },
      });
      saved.push(toBusinessRecord(updated));
    } else {
      const created = await db.business.create({
        data: {
          name: r.name,
          category: r.category,
          address: r.address,
          city: r.city,
          state: r.state,
          country: r.country,
          lat: r.lat,
          lng: r.lng,
          website: r.website,
          websiteStatus: r.websiteStatus,
          phone: r.phone,
          email: r.email,
          socialLinks:
            r.socialLinks && Object.keys(r.socialLinks).length
              ? JSON.stringify(r.socialLinks)
              : null,
          dataSource: r.dataSource,
          hashKey: hash,
          projectId: params.projectId ?? null,
          searchHistoryId: searchHistory.id,
        },
      });
      saved.push(toBusinessRecord(created));
    }
  }

  // Optional website scanning (SSRF-safe URLs already enforced upstream).
  if (params.scanWebsites) {
    await log("info", "search", `Scanning ${saved.length} websites…`);
    for (const b of saved) {
      if (!b.website) continue;
      try {
        const scan = await scanWebsite(b.website);
        const socials = { ...b.socialLinks, ...scan.socials };
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
        Object.assign(b, toBusinessRecord(updated));
      } catch (err) {
        await log("warn", "scan", `Scan failed for ${b.website}`, {
          error: String(err),
        });
      }
    }
  }

  return NextResponse.json({
    searchHistoryId: searchHistory.id,
    totalResults: saved.length,
    businesses: saved,
    center: center
      ? { lat: center.lat, lng: center.lng, displayName: center.displayName }
      : null,
  });
}
