import { log } from "@/lib/logging";

export interface GeoPoint {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Geocode a free-form location string (city, state, country) to coordinates
 * using the free Nominatim service (OpenStreetMap). Respects Nominatim usage
 * policy: a descriptive User-Agent + single concurrent request.
 *
 * Public, authorized data source: https://nominatim.openstreetmap.org
 */
export async function geocode(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
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
    });
    if (!res.ok) {
      await log("warn", "geocode", `Nominatim HTTP ${res.status} for "${q}"`);
      return null;
    }
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;
    if (!data.length) return null;
    const hit = data[0];
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      displayName: hit.display_name,
      city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
      state: hit.address?.state,
      country: hit.address?.country,
    };
  } catch (err) {
    await log("error", "geocode", `Geocode failed for "${q}"`, {
      error: String(err),
    });
    return null;
  }
}
