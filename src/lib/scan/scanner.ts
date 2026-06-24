import { log } from "@/lib/logging";
import { safePublicUrl, safeFetchText } from "@/lib/security";
import type { SocialLinks } from "@/lib/types";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// International-friendly phone regex (matches +, spaces, dashes, parens, 7-20 digits)
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const SOCIAL_HOSTS: { key: keyof SocialLinks; host: string }[] = [
  { key: "facebook", host: "facebook.com" },
  { key: "twitter", host: "twitter.com" },
  { key: "instagram", host: "instagram.com" },
  { key: "linkedin", host: "linkedin.com" },
  { key: "youtube", host: "youtube.com" },
  { key: "tiktok", host: "tiktok.com" },
];

const SCAN_TIMEOUT_MS = 8000;

interface RobotsCache {
  [origin: string]: { rules: { allow: string[]; disallow: string[] }; fetchedAt: number };
}
const robotsCache: RobotsCache = {};
const ROBOTS_TTL = 10 * 60 * 1000;

/** Fetch + parse robots.txt for an origin. Returns allow/disallow path prefixes. */
async function getRobots(origin: string): Promise<{ allow: string[]; disallow: string[] }> {
  const cached = robotsCache[origin];
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL) return cached.rules;
  const rules = { allow: [] as string[], disallow: [] as string[] };
  // Use safeFetchText for SSRF-proof redirects + response size cap.
  const fetched = await safeFetchText(origin + "/robots.txt", {
    timeoutMs: SCAN_TIMEOUT_MS,
    acceptTypes: ["text/plain"],
  });
  if (fetched) {
    let applies = true;
    for (const line of fetched.text.split("\n")) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      const m = l.match(/^(User-agent|Allow|Disallow):\s*(.*)$/i);
      if (!m) continue;
      const [, key, val] = m;
      if (key.toLowerCase() === "user-agent") {
        applies = val === "*" || val.toLowerCase().includes("leadfinder");
      } else if (applies) {
        if (key.toLowerCase() === "allow") rules.allow.push(val);
        if (key.toLowerCase() === "disallow") rules.disallow.push(val);
      }
    }
  }
  robotsCache[origin] = { rules, fetchedAt: Date.now() };
  return rules;
}

function pathAllowed(path: string, rules: { allow: string[]; disallow: string[] }): boolean {
  for (const d of rules.disallow) {
    if (d === "") continue;
    if (path.startsWith(d)) {
      // overridden by a more specific allow?
      for (const a of rules.allow) if (path.startsWith(a) && a.length >= d.length) return true;
      return false;
    }
  }
  return true;
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    // filter obvious junk / image-extension false positives
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e)) continue;
    if (e.includes("@sentry") || e.includes("@example.")) continue;
    found.add(e);
  }
  return [...found];
}

function extractPhones(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(PHONE_RE)) {
    let p = m[0].trim();
    const digits = p.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    p = p.replace(/[().]/g, "").replace(/\s+/g, " ").trim();
    found.add(p);
  }
  return [...found];
}

function extractSocials(html: string, baseUrl: string): SocialLinks {
  const out: SocialLinks = {};
  try {
    const dom = new RegExp(`href=["']([^"']+)["']`, "gi");
    const hrefs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = dom.exec(html)) !== null) hrefs.push(m[1]);
    for (const href of hrefs) {
      let abs: string;
      try {
        abs = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
      const lower = abs.toLowerCase();
      for (const s of SOCIAL_HOSTS) {
        if (lower.includes(s.host) && !out[s.key]) {
          out[s.key] = abs;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function fetchPage(url: string): Promise<string | null> {
  // safeFetchText handles SSRF-proof redirect validation, response size cap,
  // content-type filtering, and timeout — all in one place.
  const fetched = await safeFetchText(url, {
    timeoutMs: SCAN_TIMEOUT_MS,
    acceptTypes: ["text/html", "xhtml"],
  });
  return fetched?.text ?? null;
}

export interface ScanResult {
  active: boolean;
  emails: string[];
  phones: string[];
  socials: SocialLinks;
  finalUrl: string | null;
}

/**
 * Scan a business website for publicly-visible contact information.
 * Respects robots.txt and standard fetch etiquette (single UA, short timeout).
 */
export async function scanWebsite(rawUrl: string): Promise<ScanResult> {
  const result: ScanResult = {
    active: false,
    emails: [],
    phones: [],
    socials: {},
    finalUrl: null,
  };
  // SSRF protection: only scan public http(s) URLs (blocks loopback, private
  // ranges, link-local, and cloud metadata endpoints).
  const safeUrl = safePublicUrl(rawUrl);
  if (!safeUrl) {
    await log("warn", "scan", `Refused to scan non-public URL: ${rawUrl}`);
    return result;
  }
  let url: URL;
  try {
    url = new URL(safeUrl);
  } catch {
    return result;
  }
  const origin = url.origin;
  const robots = await getRobots(origin);

  const paths = ["/", "/contact", "/contact-us", "/about", "/about-us"];
  const emails = new Set<string>();
  const phones = new Set<string>();
  let socials: SocialLinks = {};
  let anyPage = false;

  for (const p of paths) {
    if (!pathAllowed(p, robots)) continue;
    const target = origin + p;
    const html = await fetchPage(target);
    if (!html) continue;
    anyPage = true;
    if (!result.finalUrl) result.finalUrl = target;
    for (const e of extractEmails(html)) emails.add(e);
    for (const ph of extractPhones(html)) phones.add(ph);
    socials = { ...socials, ...extractSocials(html, target) };
    // Small delay between page fetches to be polite.
    await new Promise((r) => setTimeout(r, 250));
  }

  result.active = anyPage;
  result.emails = [...emails].slice(0, 10);
  result.phones = [...phones].slice(0, 10);
  result.socials = socials;
  await log("info", "scan", `Scanned ${origin}`, {
    active: result.active,
    emails: result.emails.length,
    phones: result.phones.length,
  });
  return result;
}
