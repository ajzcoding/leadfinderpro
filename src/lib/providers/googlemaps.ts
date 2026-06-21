import { log } from "@/lib/logging";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

// Google Places API (New) Nearby Search type mappings.
// https://developers.google.com/maps/documentation/places/web-service/place-types
const CATEGORY_MAP: Record<string, string[]> = {
  restaurant: ["restaurant"],
  cafe: ["cafe"],
  bar: ["bar", "liquor_store"],
  hotel: ["hotel", "lodging"],
  shop: ["clothing_store", "electronics_store", "furniture_store", "hardware_store", "store"],
  beauty: ["hair_care", "beauty_salon", "spa"],
  gym: ["gym", "fitness_center"],
  health: ["hospital", "doctor", "health", "pharmacy"],
  dentist: ["dentist"],
  lawyer: ["lawyer"],
  real_estate: ["real_estate_agency"],
  car_repair: ["car_repair", "car_dealer"],
  bank: ["bank", "atm"],
  school: ["school", "university", "primary_school", "secondary_school"],
  it_services: ["electronics_store"],
  marketing: ["advertising_agency"],
  photographer: ["photographer"],
  plumber: ["plumber"],
  electrician: ["electrician"],
  florist: ["florist"],
};

interface GooglePlace {
  id: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  googleMapsUri?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
  error?: { message?: string };
}

/**
 * Google Maps Places API (New) — Nearby Search.
 * Requires an API key with the Places API (New) enabled.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/search-nearby
 *
 * NOTE: This uses only the official, authorized Google Places API. It does NOT
 * scrape Google Maps. Usage is billed by Google per request.
 */
export async function searchGoogleMaps(params: {
  lat: number;
  lng: number;
  radius: number; // meters, max 50000
  category?: string;
  keyword?: string;
  limit?: number;
  apiKey: string;
}): Promise<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt" | "projectId">[]> {
  const { lat, lng, radius, category, keyword, limit = 60, apiKey } = params;
  const includedTypes = category ? CATEGORY_MAP[category] : undefined;

  // The Nearby Search endpoint accepts a JSON body with location + radius.
  // textQuery is not supported by Nearby Search — keyword is applied via
  // `includedTypes` when no explicit category, or ignored otherwise (Google's
  // Nearby Search does not accept a free-text query).
  const body: Record<string, unknown> = {
    includedTypes: includedTypes ?? [],
    maxResultCount: Math.min(limit, 20),
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radius, 50000),
      },
    },
    languageCode: "en",
  };

  const u = new URL("https://places.googleapis.com/v1/places:searchNearby");

  try {
    const res = await fetch(u, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.rating,places.googleMapsUri",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as GooglePlacesResponse;
        if (errBody.error?.message) msg = `${msg}: ${errBody.error.message}`;
      } catch {
        /* ignore */
      }
      await log("warn", "search", `Google Places HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as GooglePlacesResponse;
    const places = data.places ?? [];

    // If a keyword was supplied but no category, filter client-side by name.
    const filtered = keyword
      ? places.filter((p) =>
          p.displayName?.text?.toLowerCase().includes(keyword.toLowerCase()),
        )
      : places;

    return filtered
      .filter((p) => p.displayName?.text)
      .map((p) => {
        const socials: SocialLinks = {};
        if (p.googleMapsUri) socials.website = p.googleMapsUri;
        let website = p.websiteUri ?? null;
        if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
        return {
          name: p.displayName!.text!,
          category: p.primaryTypeDisplayName?.text ?? category ?? null,
          address: p.formattedAddress ?? null,
          city: null,
          state: null,
          country: null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
          website,
          websiteStatus: website ? "active" : "none",
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
          email: null,
          socialLinks: socials,
          dataSource: "googlemaps",
          lastUpdated: new Date().toISOString(),
        };
      });
  } catch (err) {
    await log("error", "search", "Google Places request failed", {
      error: String(err),
    });
    return [];
  }
}
