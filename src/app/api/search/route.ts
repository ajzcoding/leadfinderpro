import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSearch } from "@/lib/providers";
import { scanWebsite } from "@/lib/scan/scanner";
import { toBusinessRecord, hashBusiness } from "@/lib/mappers";
import { log } from "@/lib/logging";
import type { SearchParams } from "@/lib/types";

export const maxDuration = 120;

/**
 * POST /api/search
 * Body: SearchParams
 *
 * Executes a provider search, persists businesses (deduping by hash), records
 * search history, and (optionally) scans each website for public contact info.
 */
export async function POST(req: NextRequest) {
  let body: SearchParams;
  try {
    body = (await req.json()) as SearchParams;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { records, center, provider } = await runSearch(body);
  if (!records.length) {
    // Still log an empty search to history for completeness.
    const sh = await db.searchHistory.create({
      data: {
        keyword: body.keyword ?? null,
        category: body.category ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        country: body.country ?? null,
        radius: body.radius ?? null,
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
      keyword: body.keyword ?? null,
      category: body.category ?? null,
      city: body.city ?? center?.city ?? null,
      state: body.state ?? center?.state ?? null,
      country: body.country ?? center?.country ?? null,
      radius: body.radius ?? null,
      provider: provider ?? null,
      totalResults: records.length,
    },
  });

  // Upsert businesses (dedup by hashKey). On conflict, refresh contact fields
  // if we have new data and optionally re-link to the new search history.
  const saved: ReturnType<typeof toBusinessRecord>[] = [];
  for (const r of records) {
    const hash = hashBusiness(r);
    const existing = await db.business.findUnique({ where: { hashKey: hash } });
    if (existing) {
      const updated = await db.business.update({
        where: { id: existing.id },
        data: {
          website: r.website ?? existing.website,
          websiteStatus: r.websiteStatus ?? existing.websiteStatus,
          phone: r.phone ?? existing.phone,
          email: r.email ?? existing.email,
          socialLinks: r.socialLinks && Object.keys(r.socialLinks).length
            ? JSON.stringify({ ...JSON.parse(existing.socialLinks ?? "{}"), ...r.socialLinks })
            : existing.socialLinks,
          lastUpdated: new Date(),
          projectId: body.projectId ?? existing.projectId,
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
          socialLinks: r.socialLinks && Object.keys(r.socialLinks).length
            ? JSON.stringify(r.socialLinks)
            : null,
          dataSource: r.dataSource,
          hashKey: hash,
          projectId: body.projectId ?? null,
          searchHistoryId: searchHistory.id,
        },
      });
      saved.push(toBusinessRecord(created));
    }
  }

  // Optional website scanning.
  if (body.scanWebsites) {
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
        await log("warn", "scan", `Scan failed for ${b.website}`, { error: String(err) });
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
