import { geocode, type GeoPoint } from "@/lib/providers/geocode";
import { searchOverpass } from "@/lib/providers/osm";
import { searchGeoapify } from "@/lib/providers/geoapify";
import { searchFoursquare } from "@/lib/providers/foursquare";
import { searchTomtom } from "@/lib/providers/tomtom";
import { getApiKey, isProviderEnabled } from "@/lib/settings-store";
import { log } from "@/lib/logging";
import type { BusinessRecord, ProviderId, SearchParams } from "@/lib/types";

export type RawBusiness = Omit<
  BusinessRecord,
  "id" | "createdAt" | "updatedAt" | "projectId"
>;

export interface SearchProgressEvent {
  stage: "geocoding" | "fetching" | "scanning" | "done" | "error";
  message: string;
  count?: number;
}

/**
 * Resolve the user's location fields (city/state/country) into a coordinate
 * center for radius-based provider queries. Falls back gracefully.
 */
export async function resolveCenter(
  params: SearchParams,
): Promise<{ point: GeoPoint | null; query: string }> {
  const parts = [params.city, params.state, params.country].filter(Boolean);
  const query = parts.join(", ");
  if (!query) return { point: null, query: "" };
  const point = await geocode(query);
  return { point, query };
}

function dedupe(records: RawBusiness[]): RawBusiness[] {
  const seen = new Set<string>();
  const out: RawBusiness[] = [];
  for (const r of records) {
    const key =
      (r.name || "").toLowerCase().trim() +
      "|" +
      (r.lat?.toFixed(3) ?? "") +
      "," +
      (r.lng?.toFixed(3) ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Execute a business search via the selected (or best-available) provider.
 * Returns normalized raw business records ready for persistence.
 *
 * Provider selection order:
 *  1. Explicit `provider` param if enabled + (keyless OR has key)
 *  2. OpenStreetMap (free, keyless) as the default
 */
export async function runSearch(
  params: SearchParams,
  onProgress?: (e: SearchProgressEvent) => void,
): Promise<{ records: RawBusiness[]; center: GeoPoint | null; provider: ProviderId }> {
  const radius = params.radius && params.radius > 0 ? params.radius : 5000;
  const requested = (params.provider ?? "openstreetmap") as ProviderId;

  // Decide which provider to actually use based on config + keys.
  let provider: ProviderId = requested;
  const enabled = await isProviderEnabled(requested);
  const key = ["geoapify", "foursquare", "tomtom"].includes(requested)
    ? await getApiKey(requested)
    : null;
  if (["geoapify", "foursquare", "tomtom"].includes(requested) && (!enabled || !key)) {
    await log(
      "warn",
      "search",
      `Requested provider "${requested}" not configured/enabled — falling back to OpenStreetMap`,
      { requested },
    );
    provider = "openstreetmap";
  }

  onProgress?.({ stage: "geocoding", message: "Resolving location…" });
  const { point } = await resolveCenter(params);
  if (!point) {
    onProgress?.({ stage: "error", message: "Could not resolve the provided location." });
    return { records: [], center: null, provider };
  }

  onProgress?.({ stage: "fetching", message: `Querying ${provider}…` });
  let records: RawBusiness[] = [];
  try {
    if (provider === "openstreetmap") {
      records = await searchOverpass({
        lat: point.lat,
        lng: point.lng,
        radius,
        category: params.category,
        keyword: params.keyword,
        limit: params.limit,
      });
    } else if (provider === "geoapify" && key) {
      records = await searchGeoapify({
        lat: point.lat,
        lng: point.lng,
        radius,
        category: params.category,
        keyword: params.keyword,
        limit: params.limit,
        apiKey: key,
      });
    } else if (provider === "foursquare" && key) {
      records = await searchFoursquare({
        lat: point.lat,
        lng: point.lng,
        radius,
        category: params.category,
        keyword: params.keyword,
        limit: params.limit,
        apiKey: key,
      });
    } else if (provider === "tomtom" && key) {
      records = await searchTomtom({
        lat: point.lat,
        lng: point.lng,
        radius,
        category: params.category,
        keyword: params.keyword,
        limit: params.limit,
        apiKey: key,
      });
    }
  } catch (err) {
    onProgress?.({
      stage: "error",
      message: `Provider request failed: ${String(err)}`,
    });
    await log("error", "search", "Provider request failed", { provider, error: String(err) });
  }

  records = dedupe(records);
  onProgress?.({
    stage: "fetching",
    message: `Found ${records.length} businesses`,
    count: records.length,
  });
  return { records, center: point, provider };
}

/** Connectivity test for the Settings page. */
export async function testProvider(
  provider: ProviderId,
  apiKey?: string | null,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (provider === "openstreetmap") {
      const res = await fetch("https://overpass-api.de/api/status", {
        headers: { "User-Agent": "LeadFinderPro/1.0" },
        cache: "no-store",
      });
      return { ok: res.ok, message: res.ok ? "Overpass reachable" : `HTTP ${res.status}` };
    }
    if (provider === "nominatim") {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&q=Berlin&limit=1",
        { headers: { "User-Agent": "LeadFinderPro/1.0" }, cache: "no-store" },
      );
      return { ok: res.ok, message: res.ok ? "Nominatim reachable" : `HTTP ${res.status}` };
    }
    if (!apiKey) return { ok: false, message: "No API key set" };
    if (provider === "geoapify") {
      const res = await fetch(
        `https://api.geoapify.com/v2/places?limit=1&apiKey=${apiKey}&filter=circle:13.405,52.52,1000`,
        { cache: "no-store" },
      );
      return { ok: res.ok, message: res.ok ? "Geoapify key valid" : `HTTP ${res.status}` };
    }
    if (provider === "foursquare") {
      const res = await fetch(
        "https://api.foursquare.com/v3/places/search?limit=1&ll=52.52,13.405",
        { headers: { Authorization: apiKey }, cache: "no-store" },
      );
      return { ok: res.ok, message: res.ok ? "Foursquare key valid" : `HTTP ${res.status}` };
    }
    if (provider === "tomtom") {
      const res = await fetch(
        `https://api.tomtom.com/search/2/nearbySearch/.json?lat=52.52&lon=13.405&limit=1&key=${apiKey}`,
        { cache: "no-store" },
      );
      return { ok: res.ok, message: res.ok ? "TomTom key valid" : `HTTP ${res.status}` };
    }
    return { ok: false, message: "Unknown provider" };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}
