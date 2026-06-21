import { log } from "@/lib/logging";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

// TomTom category codes (subset). See TomTom Search category set.
const CATEGORY_MAP: Record<string, string> = {
  restaurant: "7315",
  cafe: "9376",
  bar: "9379",
  hotel: "9361",
  shop: "9360",
  beauty: "9362",
  gym: "7320",
  health: "7322",
  dentist: "9364",
  bank: "9363",
  school: "9373",
};

interface TomTomResult {
  poi?: { name?: string; categories?: string[]; phone?: string; url?: string; email?: string; categorySet?: { id: number }[] };
  address?: { freeformAddress?: string; municipality?: string; countrySubdivision?: string; country?: string };
  position?: { lat: number; lon: number };
}

export async function searchTomtom(params: {
  lat: number;
  lng: number;
  radius: number;
  category?: string;
  keyword?: string;
  limit?: number;
  apiKey: string;
}): Promise<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[]> {
  const { lat, lng, radius, category, keyword, limit = 50, apiKey } = params;
  const catSet = category && CATEGORY_MAP[category] ? CATEGORY_MAP[category] : undefined;
  // categorySearch endpoint expects a category in the path OR we use nearbySearch.
  const u = new URL("https://api.tomtom.com/search/2/nearbySearch/.json");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("radius", String(radius));
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("key", apiKey);
  if (catSet) u.searchParams.set("categorySet", catSet);
  if (keyword) u.searchParams.set("query", keyword);

  try {
    const res = await fetch(u, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      await log("warn", "search", `TomTom HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: TomTomResult[] };
    const results = (data.results ?? []).filter((r) => r.poi?.name);
    return results.map((r) => {
      const social: SocialLinks = {};
      let website = r.poi?.url ?? null;
      if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
      if (website) social.website = website;
      return {
        name: r.poi!.name!,
        category: r.poi?.categories?.[0] ?? category ?? null,
        address: r.address?.freeformAddress ?? null,
        city: r.address?.municipality ?? null,
        state: r.address?.countrySubdivision ?? null,
        country: r.address?.country ?? null,
        lat: r.position?.lat ?? null,
        lng: r.position?.lon ?? null,
        website,
        websiteStatus: website ? "active" : "none",
        phone: r.poi?.phone ?? null,
        email: r.poi?.email ?? null,
        socialLinks: social,
        dataSource: "tomtom",
        lastUpdated: new Date().toISOString(),
      };
    });
  } catch (err) {
    await log("error", "search", "TomTom request failed", { error: String(err) });
    return [];
  }
}
