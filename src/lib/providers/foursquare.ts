import { log } from "@/lib/logging";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

// Foursquare category ids (subset). See https://docs.foursquare.com/docs/categories
const CATEGORY_MAP: Record<string, string> = {
  restaurant: "13065", // restaurant
  cafe: "13032", // cafe
  bar: "13003", // bar
  hotel: "19014", // hotel
  shop: "17000", // retail
  beauty: "11062", // salon
  gym: "18021", // gym
  health: "15000", // health
  dentist: "11018", // dentist
  bank: "11000", // bank
  school: "12000", // education
};

interface FoursquareResult {
  fsq_id: string;
  name: string;
  categories?: { name: string; id: string }[];
  location?: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  website?: string;
  tel?: string;
  email?: string;
  social_media?: { facebook_id?: string; twitter?: string; instagram?: string };
}

export async function searchFoursquare(params: {
  lat: number;
  lng: number;
  radius: number;
  category?: string;
  keyword?: string;
  limit?: number;
  apiKey: string;
}): Promise<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[]> {
  const { lat, lng, radius, category, keyword, limit = 50, apiKey } = params;
  const u = new URL("https://api.foursquare.com/v3/places/search");
  u.searchParams.set("ll", `${lat},${lng}`);
  u.searchParams.set("radius", String(radius));
  u.searchParams.set("limit", String(limit));
  if (category && CATEGORY_MAP[category]) {
    u.searchParams.set("categories", CATEGORY_MAP[category]);
  }
  if (keyword) u.searchParams.set("query", keyword);

  try {
    const res = await fetch(u, {
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      await log("warn", "search", `Foursquare HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: FoursquareResult[] };
    const results = data.results ?? [];
    return results.map((r) => {
      const social: SocialLinks = {};
      if (r.social_media?.facebook_id) social.facebook = `https://facebook.com/${r.social_media.facebook_id}`;
      if (r.social_media?.twitter) social.twitter = r.social_media.twitter;
      if (r.social_media?.instagram) social.instagram = r.social_media.instagram;
      let website = r.website ?? null;
      if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
      const latv = r.geocodes?.main?.latitude ?? r.location?.lat;
      const lngv = r.geocodes?.main?.longitude ?? r.location?.lng;
      return {
        name: r.name,
        category: r.categories?.[0]?.name ?? category ?? null,
        address: r.location?.address ?? null,
        city: r.location?.locality ?? null,
        state: r.location?.region ?? null,
        country: r.location?.country ?? null,
        lat: latv ?? null,
        lng: lngv ?? null,
        website,
        websiteStatus: website ? "active" : "none",
        phone: r.tel ?? null,
        email: r.email ?? null,
        socialLinks: social,
        dataSource: "foursquare",
        lastUpdated: new Date().toISOString(),
      };
    });
  } catch (err) {
    await log("error", "search", "Foursquare request failed", { error: String(err) });
    return [];
  }
}
