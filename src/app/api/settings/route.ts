import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { testProvider } from "@/lib/providers";
import { recordTestResult } from "@/lib/settings-store";
import { PROVIDERS, type ProviderId } from "@/lib/types";

/**
 * GET /api/settings → list provider configs (API key masked)
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
        // mask: never return the raw key to the client
        apiKeyMasked: row?.apiKey ? maskKey(row.apiKey) : null,
        enabled: row?.enabled ?? p.free, // free providers default to enabled
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
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const provider = body.provider as ProviderId;
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

  if (body.action === "save") {
    const existing = await db.setting.findUnique({ where: { provider } });
    if (existing) {
      const updated = await db.setting.update({
        where: { provider },
        data: { apiKey: body.apiKey ?? null, enabled: body.enabled ?? existing.enabled },
      });
      return NextResponse.json({ ok: true, provider: updated.provider });
    }
    const created = await db.setting.create({
      data: { provider, apiKey: body.apiKey ?? null, enabled: body.enabled ?? true },
    });
    return NextResponse.json({ ok: true, provider: created.provider });
  }

  if (body.action === "delete") {
    await db.setting.deleteMany({ where: { provider } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle") {
    const existing = await db.setting.findUnique({ where: { provider } });
    if (existing) {
      await db.setting.update({
        where: { provider },
        data: { enabled: body.enabled ?? !existing.enabled },
      });
    } else {
      await db.setting.create({
        data: { provider, apiKey: null, enabled: body.enabled ?? true },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "test") {
    // For keyed providers, test with the provided key OR the stored one.
    let key = body.apiKey as string | undefined;
    if (!key) {
      const row = await db.setting.findUnique({ where: { provider } });
      key = row?.apiKey ?? undefined;
    }
    const result = await testProvider(provider, key ?? null);
    await recordTestResult(provider, result.ok, result.message);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
