import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";

/**
 * GET /api/project            → list all projects (with business counts)
 * GET /api/project?id=<id>    → one project + its businesses
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const project = await db.project.findUnique({
      where: { id },
      include: { businesses: { orderBy: { createdAt: "desc" } } },
    });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      businesses: project.businesses.map(toBusinessRecord),
    });
  }
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { businesses: true } } },
  });
  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      businessCount: p._count.businesses,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  );
}

/** POST /api/project  { name, description?, color? } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await db.project.create({
    data: {
      name: String(body.name).slice(0, 120),
      description: body.description ? String(body.description) : null,
      color: body.color ?? null,
    },
  });
  return NextResponse.json(project);
}

/** PATCH /api/project  { id, name?, description?, color? } */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (rest.name !== undefined) data.name = String(rest.name).slice(0, 120);
  if (rest.description !== undefined) data.description = rest.description;
  if (rest.color !== undefined) data.color = rest.color;
  const updated = await db.project.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/** DELETE /api/project?id=<id> */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  // Unlink businesses then delete project
  await db.business.updateMany({ where: { projectId: id }, data: { projectId: null } });
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
