/**
 * Security helpers: input validation, sanitization, and SSRF protection.
 *
 * Every value that crosses a trust boundary (HTTP body, query string, external
 * URL) is validated and bounded here before being used in DB queries or
 * outbound network requests.
 */

// Allow-list of characters for free-text search inputs. Strips control chars,
// null bytes, and anything that could break out of Overpass QL / SQL.
const SAFE_TEXT_RE = /^[\p{L}\p{N}\s.,'&\-()/+]+$/u;

/** Sanitize + bound a free-text string. Returns null if empty or invalid. */
export function sanitizeText(
  value: unknown,
  maxLen = 120,
): string | null {
  if (typeof value !== "string") return null;
  // Strip null bytes & control characters first.
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "") // strip angle brackets (basic XSS hardening)
    .trim()
    .slice(0, maxLen);
  if (!cleaned) return null;
  if (!SAFE_TEXT_RE.test(cleaned)) {
    // Fall back to stripping anything outside the allow-list.
    const stripped = cleaned.replace(/[^\p{L}\p{N}\s.,'&\-()/+]/gu, "").trim();
    return stripped || null;
  }
  return cleaned;
}

/** Validate a provider id against the known allow-list. */
export function isValidProvider(v: unknown): v is
  | "openstreetmap"
  | "nominatim"
  | "geoapify"
  | "foursquare"
  | "tomtom"
  | "googlemaps" {
  return (
    typeof v === "string" &&
    ["openstreetmap", "nominatim", "geoapify", "foursquare", "tomtom", "googlemaps"].includes(v)
  );
}

/** Validate + bound a radius (meters). Default 5000, clamped to [500, 50000]. */
export function sanitizeRadius(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 5000;
  return Math.min(50000, Math.max(500, Math.floor(n)));
}

/** Validate + bound a results limit. Default 60, clamped to [1, 200]. */
export function sanitizeLimit(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return 60;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

/**
 * Validate that a string is a safe http(s) URL pointing at a public host.
 * Used to prevent SSRF (e.g. scanning http://localhost or http://169.254.169.254).
 *
 * Returns a normalized URL string, or null if the URL is not safe.
 */
export function safePublicUrl(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  // Only allow http/https schemes.
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  // Block obvious internal / loopback / metadata addresses (SSRF protection).
  if (
    host === "localhost" ||
    host === "" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "metadata.google.internal" || // GCP metadata
    host === "169.254.169.254" // AWS/Azure metadata
  ) {
    return null;
  }
  // Block IPv4 loopback / private ranges.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (
      a === 10 || // private 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // private 172.16.0.0/12
      (a === 192 && b === 168) || // private 192.168.0.0/16
      a === 127 || // loopback 127.0.0.0/8
      (a === 169 && b === 254) || // link-local 169.254.0.0/16
      (a === 0) || // 0.0.0.0/8
      (a >= 224) // multicast / reserved
    ) {
      return null;
    }
  }
  // Block IPv6 loopback / link-local / unique-local.
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return null;
  }
  return u.toString();
}

/**
 * Validate an API key format. We don't enforce provider-specific patterns
 * (they vary widely) but we do enforce a sane length range and reject control
 * characters / whitespace, which would indicate a paste error or injection.
 */
export function sanitizeApiKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[\u0000-\u001F\u007F\s]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length < 8 || cleaned.length > 512) return null;
  // Allow alphanumerics + common key punctuation.
  if (!/^[A-Za-z0-9_\-./+=:@]+$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Generic action allow-list for the settings endpoint.
 */
export function isValidSettingsAction(v: unknown): v is "save" | "test" | "delete" | "toggle" {
  return v === "save" || v === "test" || v === "delete" || v === "toggle";
}

/** Validate a CUID-shaped id (used for business/project/history ids). */
export function isValidId(v: unknown): boolean {
  return typeof v === "string" && /^[a-z0-9]{20,30}$/i.test(v);
}

/** Validate an export format. */
export function isValidExportFormat(v: unknown): v is "csv" | "xlsx" | "json" {
  return v === "csv" || v === "xlsx" || v === "json";
}
