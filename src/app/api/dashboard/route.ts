import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [
    totalBusinesses,
    websitesFound,
    websitesNotFound,
    emailsFound,
    phonesFound,
    savedProjects,
    recentSearches,
  ] = await Promise.all([
    db.business.count(),
    db.business.count({ where: { website: { not: null } } }),
    db.business.count({ where: { website: null } }),
    db.business.count({ where: { email: { not: null } } }),
    db.business.count({ where: { phone: { not: null } } }),
    db.project.count(),
    db.searchHistory.count(),
  ]);

  const recentSearchList = await db.searchHistory.findMany({
    orderBy: { date: "desc" },
    take: 8,
  });
  const recentProjects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 6,
    include: { _count: { select: { businesses: true } } },
  });

  return NextResponse.json({
    totalBusinesses,
    websitesFound,
    websitesNotFound,
    emailsFound,
    phonesFound,
    savedProjects,
    recentSearches,
    recentSearchList: recentSearchList.map((s) => ({
      id: s.id,
      keyword: s.keyword,
      category: s.category,
      city: s.city,
      state: s.state,
      country: s.country,
      provider: s.provider,
      totalResults: s.totalResults,
      date: s.date.toISOString(),
    })),
    recentProjects: recentProjects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      businessCount: p._count.businesses,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}
