import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/history  → list search history (optionally with business counts)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "100", 10));
  const rows = await db.searchHistory.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { _count: { select: { businesses: true } } },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      category: r.category,
      city: r.city,
      state: r.state,
      country: r.country,
      radius: r.radius,
      provider: r.provider,
      totalResults: r.totalResults,
      businessCount: r._count.businesses,
      date: r.date.toISOString(),
    })),
  );
}

/** DELETE /api/history?id=<id>  (also clears the searchHistoryId link on businesses) */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    await db.business.updateMany({
      where: { searchHistoryId: id },
      data: { searchHistoryId: null },
    });
    await db.searchHistory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  // clear all
  await db.business.updateMany({ data: { searchHistoryId: null } });
  await db.searchHistory.deleteMany();
  return NextResponse.json({ ok: true });
}
