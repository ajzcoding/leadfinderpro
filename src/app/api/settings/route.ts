import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testProvider } from "@/lib/providers";
import { recordTestResult } from "@/lib/settings-store";
import { PROVIDERS, type ProviderId } from "@/lib/types";
import {
  isValidProvider,
  isValidSettingsAction,
  sanitizeApiKey,
} from "@/lib/security";

/**
 * GET /api/settings → list provider configs (API key masked)
 *
 * API keys are NEVER returned to the client in plaintext — only a masked
 * preview (first 4 + •••• + last 4). The full key lives only in SQLite.
 */
export async function GET() {
  const rows = await db.setting.findMany();
  const byProvider: Record<string, (typeof rows)[number]> = {};
  for (const r of rows) byProvider[r.provider] = r;
  return NextResponse.json(
    PROVIDERS.map((p) => {
      const row = byProvider[p.id];
      return {
        provider: p.id,
        name: p.name,
        requiresKey: p.requiresKey,
        free: p.free,
        description: p.description,
        docsUrl: p.docsUrl,
        hasKey: !!row?.apiKey,
        apiKeyMasked: row?.apiKey ? maskKey(row.apiKey) : null,
        enabled: row?.enabled ?? p.free,
        lastTested: row?.lastTested?.toISOString() ?? null,
        lastTestResult: row?.lastTestResult ?? null,
      };
    }),
  );
}

function maskKey(k: string): string {
  if (k.length <= 8) return "•".repeat(k.length);
  return k.slice(0, 4) + "•".repeat(Math.max(4, k.length - 8)) + k.slice(-4);
}

/**
 * POST /api/settings
 * { provider, action: "save"|"test"|"delete"|"toggle", apiKey?, enabled? }
 *
 * All inputs validated + bounded. API keys are sanitized to a strict
 * character set + length range before storage.
 */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const provider = body.provider;
  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  const action = body.action;
  if (!isValidSettingsAction(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const p = provider as ProviderId;

  if (action === "save") {
    // API key: validate format if provided. null/empty clears it.
    let apiKey: string | null = null;
    if (body.apiKey != null && body.apiKey !== "") {
      apiKey = sanitizeApiKey(body.apiKey);
      if (!apiKey) {
        return NextResponse.json(
          { error: "API key format is invalid (8–512 chars, alphanumerics + _-.+=:@)." },
          { status: 400 },
        );
      }
    }
    const enabled = body.enabled === true;
    const existing = await db.setting.findUnique({ where: { provider: p } });
    if (existing) {
      const updated = await db.setting.update({
        where: { provider: p },
        data: {
          apiKey: apiKey ?? existing.apiKey,
          enabled: body.enabled === undefined ? existing.enabled : enabled,
        },
      });
      return NextResponse.json({ ok: true, provider: updated.provider });
    }
    const created = await db.setting.create({
      data: { provider: p, apiKey, enabled: body.enabled === undefined ? true : enabled },
    });
    return NextResponse.json({ ok: true, provider: created.provider });
  }

  if (action === "delete") {
    await db.setting.deleteMany({ where: { provider: p } });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle") {
    const enabled = body.enabled === true;
    const existing = await db.setting.findUnique({ where: { provider: p } });
    if (existing) {
      await db.setting.update({
        where: { provider: p },
        data: { enabled: body.enabled === undefined ? !existing.enabled : enabled },
      });
    } else {
      await db.setting.create({
        data: { provider: p, apiKey: null, enabled: body.enabled === undefined ? true : enabled },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // action === "test"
  let key: string | null = null;
  if (body.apiKey != null && body.apiKey !== "") {
    key = sanitizeApiKey(body.apiKey);
    if (!key) {
      return NextResponse.json({ ok: false, message: "Invalid API key format" }, { status: 400 });
    }
  }
  if (!key) {
    const row = await db.setting.findUnique({ where: { provider: p } });
    key = row?.apiKey ?? null;
  }
  const result = await testProvider(p, key);
  await recordTestResult(p, result.ok, result.message);
  return NextResponse.json(result);
}
