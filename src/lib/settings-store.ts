import { db } from "@/lib/db";
import type { ProviderId } from "@/lib/types";

/**
 * Read all provider settings as a map keyed by provider id.
 * Missing providers are treated as "not configured".
 */
export async function getSettingsMap(): Promise<
  Record<string, { apiKey: string | null; enabled: boolean; lastTested: string | null; lastTestResult: string | null }>
> {
  const rows = await db.setting.findMany();
  const map: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) map[r.provider] = r;
  return map;
}

/** Get a single provider's API key if enabled & present. */
export async function getApiKey(provider: ProviderId): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { provider } });
  if (!row || !row.enabled || !row.apiKey) return null;
  return row.apiKey;
}

export async function isProviderEnabled(provider: ProviderId): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { provider } });
  if (!row) return provider === "openstreetmap" || provider === "nominatim"; // free defaults on
  return row.enabled;
}

export async function setProviderConfig(
  provider: ProviderId,
  data: { apiKey?: string | null; enabled?: boolean },
) {
  const existing = await db.setting.findUnique({ where: { provider } });
  if (existing) {
    return db.setting.update({
      where: { provider },
      data: {
        apiKey: data.apiKey !== undefined ? data.apiKey : existing.apiKey,
        enabled: data.enabled !== undefined ? data.enabled : existing.enabled,
      },
    });
  }
  return db.setting.create({
    data: {
      provider,
      apiKey: data.apiKey ?? null,
      enabled: data.enabled ?? true,
    },
  });
}

export async function recordTestResult(
  provider: ProviderId,
  ok: boolean,
  message?: string,
) {
  const existing = await db.setting.findUnique({ where: { provider } });
  const result = ok ? "success" : `error:${message ?? "failed"}`;
  if (existing) {
    return db.setting.update({
      where: { provider },
      data: { lastTested: new Date(), lastTestResult: result },
    });
  }
  return db.setting.create({
    data: {
      provider,
      apiKey: null,
      enabled: true,
      lastTested: new Date(),
      lastTestResult: result,
    },
  });
}
