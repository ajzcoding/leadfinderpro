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

// ===========================================================================
// Rate limiting (in-memory, sliding window)
// ===========================================================================

interface RateBucket {
  /** timestamps (ms) of requests in the current window */
  hits: number[];
}

const rateBuckets = new Map<string, RateBucket>();

/**
 * Returns true if the key is within its rate limit; false if exceeded.
 * Uses a sliding window: requests older than `windowMs` are pruned.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { hits: [] };
  // Prune old hits outside the window.
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= maxRequests) {
    const oldest = bucket.hits[0];
    return { ok: false, retryAfterMs: windowMs - (now - oldest) };
  }
  bucket.hits.push(now);
  rateBuckets.set(key, bucket);
  return { ok: true, retryAfterMs: 0 };
}

// ===========================================================================
// Request body size validation
// ===========================================================================

/** Maximum accepted JSON body size (in bytes). */
export const MAX_BODY_BYTES = 16 * 1024; // 16 KB — generous for search params

/**
 * Read + validate a JSON request body. Returns parsed JSON or an error
 * response tuple. Enforces a max body size to prevent memory exhaustion.
 */
export async function readJsonBody<T = unknown>(
  req: Request,
): Promise<
  | { ok: true; body: T }
  | { ok: false; status: number; error: string }
> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request body too large" };
  }
  let text: string;
  try {
    // Read with a size cap as defense-in-depth (content-length can be absent/spoofed).
    const reader = req.body?.getReader();
    if (!reader) {
      text = await req.text();
    } else {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
          reader.cancel();
          return { ok: false, status: 413, error: "Request body too large" };
        }
        chunks.push(value);
      }
      text = new TextDecoder().decode(Buffer.concat(chunks));
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid request body" };
  }
  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

// ===========================================================================
// Safe HTTP fetch (SSRF-proof redirect handling + response size cap)
// ===========================================================================

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB cap on response bodies
const MAX_REDIRECTS = 4;

/**
 * Fetch a URL safely: validates the initial URL AND every redirect target
 * with safePublicUrl (prevents SSRF via redirect to internal addresses),
 * and caps the response body size to prevent memory exhaustion.
 *
 * Returns the response body text + final URL, or null on any failure.
 */
export async function safeFetchText(
  rawUrl: string,
  opts?: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    acceptTypes?: string[]; // e.g. ["text/html"]; if set, response CT must match
  },
): Promise<{ text: string; finalUrl: string } | null> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  let currentUrl = safePublicUrl(rawUrl);
  if (!currentUrl) return null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: opts?.method ?? "GET",
        headers: {
          "User-Agent": "LeadFinderProBot/1.0 (+personal-use)",
          Accept: opts?.acceptTypes?.join(",") ?? "*/*",
          ...(opts?.headers ?? {}),
        },
        redirect: "manual", // we handle redirects ourselves to validate each target
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null;
    }

    // Handle redirects manually so we can validate the target.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        return null;
      }
      // Validate the redirect target is a public URL (SSRF protection).
      const validated = safePublicUrl(nextUrl);
      if (!validated) return null;
      currentUrl = validated;
      continue;
    }

    if (!res.ok) return null;

    // Validate content-type if an accept list was provided.
    if (opts?.acceptTypes?.length) {
      const ct = res.headers.get("content-type") ?? "";
      if (!opts.acceptTypes.some((t) => ct.includes(t))) return null;
    }

    // Cap response body size. Read in chunks and abort if it exceeds the limit.
    try {
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        if (text.length > MAX_RESPONSE_BYTES) return null;
        return { text, finalUrl: currentUrl };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const text = new TextDecoder().decode(Buffer.concat(chunks));
      return { text, finalUrl: currentUrl };
    } catch {
      return null;
    }
  }
  return null; // too many redirects
}

// ===========================================================================
// Sensitive-data redaction for logs
// ===========================================================================

// Patterns that look like API keys / tokens / credentials.
const SENSITIVE_PATTERNS: RegExp[] = [
  // Google API keys: AIza followed by 35 chars
  /AIza[0-9A-Za-z_\-]{20,}/g,
  // Generic long alphanumeric tokens (32+ chars, no spaces)
  /[A-Za-z0-9_\-]{32,}/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
  // Passwords in URLs: user:pass@host
  /:\/\/[^/\s]+:[^/\s]+@/g,
  // Authorization headers
  /["']?(authorization|api[-_]?key|secret|token|password)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-\.]{8,}["']?/gi,
];

/**
 * Redact API-key-like and credential-like substrings from a value before it
 * gets written to the log table. Recursively processes objects/arrays.
 */
export function redactSensitive(value: unknown): unknown {
  if (typeof value === "string") {
    let v = value;
    for (const re of SENSITIVE_PATTERNS) {
      v = v.replace(re, "[REDACTED]");
    }
    return v;
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Also redact known-sensitive keys entirely.
      const lower = k.toLowerCase();
      if (
        lower.includes("key") ||
        lower.includes("token") ||
        lower.includes("secret") ||
        lower.includes("password") ||
        lower.includes("auth")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out;
  }
  return value;
}

