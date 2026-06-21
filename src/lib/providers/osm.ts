import { log } from "@/lib/logging";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

// Map app category slugs → OSM tag filters used in the Overpass query.
const CATEGORY_OSM: Record<string, string[]> = {
  restaurant: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'],
  cafe: ['["amenity"="cafe"]'],
  bar: ['["amenity"="bar"]', '["amenity"="pub"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="hostel"]', '["tourism"="guest_house"]'],
  shop: ['["shop"]'],
  beauty: ['["shop"="hairdresser"]', '["shop"="beauty"]'],
  gym: ['["leisure"="fitness_centre"]', '["sport"="fitness"]'],
  health: ['["amenity"="hospital"]', '["amenity"="clinic"]', '["amenity"="doctors"]', '["healthcare"]'],
  dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  lawyer: ['["office"="lawyer"]'],
  real_estate: ['["office"="estate_agent"]'],
  car_repair: ['["shop"="car_repair"]', '["amenity"="car_repair"]'],
  bank: ['["amenity"="bank"]'],
  school: ['["amenity"="school"]', '["amenity"="college"]', '["amenity"="kindergarten"]'],
  it_services: ['["office"="it"]', '["office"="computer"]'],
  marketing: ['["office"="advertising_agency"]', '["office"="marketing"]'],
  photographer: ['["craft"="photographer"]', '["shop"="photo"]'],
  plumber: ['["craft"="plumber"]'],
  electrician: ['["craft"="electrician"]'],
  florist: ['["shop"="florist"]'],
};

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function extractSocial(tags: Record<string, string>): SocialLinks {
  const out: SocialLinks = {};
  if (tags["contact:facebook"]) out.facebook = tags["contact:facebook"];
  if (tags["contact:twitter"]) out.twitter = tags["contact:twitter"];
  if (tags["contact:instagram"]) out.instagram = tags["contact:instagram"];
  if (tags["contact:linkedin"]) out.linkedin = tags["contact:linkedin"];
  if (tags["contact:youtube"]) out.youtube = tags["contact:youtube"];
  if (tags["contact:tiktok"]) out.tiktok = tags["contact:tiktok"];
  // Some entries put bare URLs in tags like "facebook", "twitter", etc.
  for (const k of ["facebook", "twitter", "instagram", "linkedin", "youtube"]) {
    if (tags[k] && !out[k as keyof SocialLinks]) {
      const v = tags[k];
      if (v.startsWith("http")) (out as Record<string, string | undefined>)[k] = v;
    }
  }
  return out;
}

function normalizeUrl(raw?: string): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Query the OpenStreetMap Overpass API for businesses around a point.
 * Public, authorized data source (ODbL licensed). No API key required.
 */
export async function searchOverpass(params: {
  lat: number;
  lng: number;
  radius: number; // meters
  category?: string;
  keyword?: string;
  limit?: number;
}): Promise<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[]> {
  const { lat, lng, radius, category, keyword, limit = 60 } = params;
  const tagFilters = category ? CATEGORY_OSM[category] ?? null : null;

  // Build the Overpass QL body.
  const around = `(around:${radius},${lat},${lng})`;
  const selectors: string[] = [];

  if (tagFilters) {
    for (const f of tagFilters) {
      selectors.push(`node${f}${around};`);
      selectors.push(`way${f}${around};`);
    }
  } else {
    // No explicit category → broad search by keyword in name, or all amenity/shop.
    if (keyword) {
      const kw = keyword.replace(/"/g, "");
      selectors.push(`node["name"~"${kw}",i]${around};`);
      selectors.push(`way["name"~"${kw}",i]${around};`);
    } else {
      selectors.push(`node["amenity"]${around};`);
      selectors.push(`way["amenity"]${around};`);
    }
  }

  const query = `[out:json][timeout:25];(${selectors.join("")});out center tags ${limit};`;

  // Public Overpass mirrors. The official endpoint is heavily rate-limited, so
  // we round-robin across several community mirrors + retry once on 429.
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let data: { elements?: OverpassElement[] } | null = null;
  let lastErr: unknown = null;
  // First pass: try each endpoint once. Second pass: a single retry after a
  // short backoff (helps recover from transient 429s).
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "LeadFinderPro/1.0 (personal-use lead finder)",
          },
          body: "data=" + encodeURIComponent(query),
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          lastErr = new Error(`Overpass ${ep} HTTP ${res.status}`);
          continue;
        }
        data = (await res.json()) as { elements?: OverpassElement[] };
        break;
      } catch (err) {
        lastErr = err;
        continue;
      }
    }
  }
  if (!data) {
    await log("error", "search", "Overpass request failed", { error: String(lastErr) });
    return [];
  }

  const elements = data.elements ?? [];
  const seen = new Set<string>();
  const results: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const elat = el.lat ?? el.center?.lat;
    const elng = el.lon ?? el.center?.lon;
    if (elat == null || elng == null) continue;

    const dedupeKey = `${name}|${elat.toFixed(4)}|${elng.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const website = normalizeUrl(tags.website ?? tags["contact:website"] ?? tags.url);
    const phone = tags["phone"] ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;
    const email = tags["email"] ?? tags["contact:email"] ?? null;

    results.push({
      name,
      category: tags.amenity ?? tags.shop ?? tags.tourism ?? tags.office ?? tags.craft ?? category ?? null,
      address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim() || null,
      city: tags["addr:city"] ?? null,
      state: tags["addr:state"] ?? null,
      country: tags["addr:country"] ?? null,
      lat: elat,
      lng: elng,
      website,
      websiteStatus: website ? "active" : "none", // verified later by scanner
      phone: phone ?? null,
      email: email ?? null,
      socialLinks: extractSocial(tags),
      dataSource: "openstreetmap",
      lastUpdated: new Date().toISOString(),
    });
    if (results.length >= limit) break;
  }

  return results;
}
