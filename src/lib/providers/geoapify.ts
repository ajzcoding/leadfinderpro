import { log } from "@/lib/logging";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

// Geoapify category codes (subset) — https://apidocs.geoapify.com/docs/places/
const CATEGORY_MAP: Record<string, string> = {
  restaurant: "catering.restaurant",
  cafe: "catering.cafe",
  bar: "catering.bar",
  hotel: "accommodation.hotel",
  shop: "commercial.shop",
  beauty: "personal_care.hairdresser",
  gym: "sport.fitness",
  health: "healthcare.hospital",
  dentist: "healthcare.dentist",
  lawyer: "professional.lawyer",
  real_estate: "real_estate",
  car_repair: "service.vehicle.car_repair",
  bank: "financial.banking",
  school: "education.school",
};

interface GeoapifyFeature {
  properties: {
    name?: string;
    categories?: string[];
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    country?: string;
    lat: number;
    lon: number;
    website?: string;
    phone?: string;
    email?: string;
    datasource?: { sourcename?: string };
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  geometry: { coordinates: [number, number] };
}

export async function searchGeoapify(params: {
  lat: number;
  lng: number;
  radius: number;
  category?: string;
  keyword?: string;
  limit?: number;
  apiKey: string;
}): Promise<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[]> {
  const { lat, lng, radius, category, keyword, limit = 50, apiKey } = params;
  const cats = category ? CATEGORY_MAP[category] : undefined;
  const filter = `circle:${lng},${lat},${radius}`;
  const u = new URL("https://api.geoapify.com/v2/places");
  if (cats) u.searchParams.set("categories", cats);
  if (keyword) u.searchParams.set("text", keyword);
  u.searchParams.set("filter", filter);
  u.searchParams.set("bias", filter);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(u, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      await log("warn", "search", `Geoapify HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { features?: GeoapifyFeature[] };
    const features = data.features ?? [];
    return features
      .filter((f) => f.properties.name)
      .map((f) => {
        const p = f.properties;
        const social: SocialLinks = {};
        if (p.facebook) social.facebook = p.facebook;
        if (p.twitter) social.twitter = p.twitter;
        if (p.instagram) social.instagram = p.instagram;
        let website = p.website ?? null;
        if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
        return {
          name: p.name!,
          category: p.categories?.[0]?.split(".").pop() ?? category ?? null,
          address: p.address_line1 ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          country: p.country ?? null,
          lat: p.lat,
          lng: p.lon,
          website,
          websiteStatus: website ? "active" : "none",
          phone: p.phone ?? null,
          email: p.email ?? null,
          socialLinks: social,
          dataSource: "geoapify",
          lastUpdated: new Date().toISOString(),
        };
      });
  } catch (err) {
    await log("error", "search", "Geoapify request failed", { error: String(err) });
    return [];
  }
}
