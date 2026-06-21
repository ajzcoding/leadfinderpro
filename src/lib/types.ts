// Shared types for Lead Finder Pro (used across frontend + backend)

export type ProviderId =
  | "openstreetmap"
  | "nominatim"
  | "geoapify"
  | "foursquare"
  | "tomtom";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  requiresKey: boolean;
  description: string;
  docsUrl: string;
  free: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openstreetmap",
    name: "OpenStreetMap (Overpass)",
    requiresKey: false,
    free: true,
    description:
      "Free, open data from OpenStreetMap via the Overpass API. No API key required. Best default source for business discovery.",
    docsUrl: "https://wiki.openstreetmap.org/wiki/Overpass_API",
  },
  {
    id: "nominatim",
    name: "Nominatim Geocoder",
    requiresKey: false,
    free: true,
    description:
      "Free geocoding service used to resolve city/state names into coordinates for area-based searches. No key required.",
    docsUrl: "https://nominatim.org/release-docs/latest/api/Overview/",
  },
  {
    id: "geoapify",
    name: "Geoapify Places",
    requiresKey: true,
    free: true,
    description:
      "Places API with generous free tier. Provides category-based business search with rich metadata.",
    docsUrl: "https://apidocs.geoapify.com/docs/places/",
  },
  {
    id: "foursquare",
    name: "Foursquare Places",
    requiresKey: true,
    free: true,
    description:
      "Foursquare Places API with detailed venue data including categories, contact info, and ratings.",
    docsUrl: "https://docs.foursquare.com/developer/reference/places-api",
  },
  {
    id: "tomtom",
    name: "TomTom Search",
    requiresKey: true,
    free: true,
    description:
      "TomTom Search API for category-based POI (points of interest) discovery with global coverage.",
    docsUrl: "https://developer.tomtom.com/search-api/documentation/search-information/poi-search",
  },
];

export interface SearchParams {
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  keyword?: string;
  radius?: number; // meters
  provider?: ProviderId;
  limit?: number;
  scanWebsites?: boolean;
  projectId?: string | null;
}

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
}

export interface BusinessRecord {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  websiteStatus: string;
  phone: string | null;
  email: string | null;
  socialLinks: SocialLinks;
  dataSource: string;
  lastUpdated: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalBusinesses: number;
  websitesFound: number;
  websitesNotFound: number;
  emailsFound: number;
  phonesFound: number;
  recentSearches: number;
  savedProjects: number;
}

export interface ResultFilter {
  websiteAvailable?: boolean | null;
  emailAvailable?: boolean | null;
  phoneAvailable?: boolean | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  projectId?: string | null;
  searchHistoryId?: string | null;
  search?: string | null;
}

export interface AppLog {
  id: string;
  level: "info" | "warn" | "error";
  category: string | null;
  message: string;
  meta: unknown;
  timestamp: string;
}

// Common business categories offered as quick-pick in the Search UI.
// These map loosely to OSM tags + generic industry labels.
export const CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: "Restaurants & Cafes", value: "restaurant" },
  { label: "Hotels & Accommodation", value: "hotel" },
  { label: "Cafes", value: "cafe" },
  { label: "Bars & Pubs", value: "bar" },
  { label: "Retail Shops", value: "shop" },
  { label: "Hair & Beauty Salons", value: "beauty" },
  { label: "Gyms & Fitness", value: "gym" },
  { label: "Healthcare & Clinics", value: "health" },
  { label: "Dentists", value: "dentist" },
  { label: "Lawyers & Legal", value: "lawyer" },
  { label: "Real Estate", value: "real_estate" },
  { label: "Auto Repair", value: "car_repair" },
  { label: "Banks & Finance", value: "bank" },
  { label: "Schools & Education", value: "school" },
  { label: "IT & Web Services", value: "it_services" },
  { label: "Marketing Agencies", value: "marketing" },
  { label: "Photographers", value: "photographer" },
  { label: "Plumbers", value: "plumber" },
  { label: "Electricians", value: "electrician" },
  { label: "Florists", value: "florist" },
];
