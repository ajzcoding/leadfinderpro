import { log } from "@/lib/logging";

export interface GeoPoint {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
}

// In-memory cache of geocoded locations (keyed by query). Nominatim's usage
// policy limits to 1 request/sec, so caching the same city across searches
// avoids repeated lookups and keeps us well within the rate limit.
const geocodeCache = new Map<string, GeoPoint | null>();

/**
 * Geocode a free-form location string (city, state, country) to coordinates
 * using the free Nominatim service (OpenStreetMap). Respects Nominatim usage
 * policy: a descriptive User-Agent + single concurrent request + results
 * cached to avoid repeated lookups.
 *
 * Public, authorized data source: https://nominatim.openstreetmap.org
 */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const cacheKey = q.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
    q,
  )}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LeadFinderPro/1.0 (personal-use lead finder)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      await log("warn", "geocode", `Nominatim HTTP ${res.status} for "${q}"`);
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;
    if (!data.length) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const hit = data[0];
    const point: GeoPoint = {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      displayName: hit.display_name,
      city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
      state: hit.address?.state,
      country: hit.address?.country,
    };
    geocodeCache.set(cacheKey, point);
    return point;
  } catch (err) {
    await log("error", "geocode", `Geocode failed for "${q}"`, {
      error: String(err),
    });
    return null;
  }
}
