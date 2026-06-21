import type { Business as PrismaBusiness } from "@prisma/client";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

/** Convert a Prisma Business row to the API-facing BusinessRecord shape. */
export function toBusinessRecord(b: PrismaBusiness): BusinessRecord {
  let socials: SocialLinks = {};
  if (b.socialLinks) {
    try {
      socials = JSON.parse(b.socialLinks) as SocialLinks;
    } catch {
      socials = {};
    }
  }
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    address: b.address,
    city: b.city,
    state: b.state,
    country: b.country,
    lat: b.lat,
    lng: b.lng,
    website: b.website,
    websiteStatus: b.websiteStatus,
    phone: b.phone,
    email: b.email,
    socialLinks: socials,
    dataSource: b.dataSource,
    lastUpdated: b.lastUpdated.toISOString(),
    projectId: b.projectId,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Stable dedup hash for a business record. */
export function hashBusiness(b: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
}): string {
  const base = (
    (b.name || "").toLowerCase().trim() +
    "|" +
    (b.city?.toLowerCase().trim() ?? "") +
    "|" +
    (b.lat != null ? b.lat.toFixed(3) : "") +
    "," +
    (b.lng != null ? b.lng.toFixed(3) : "")
  );
  // simple djb2 hash → base36
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = (h * 33) ^ base.charCodeAt(i);
  return (h >>> 0).toString(36);
}
