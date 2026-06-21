import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBusinessRecord } from "@/lib/mappers";
import { isValidId, sanitizeText } from "@/lib/security";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * GET /api/project            → list all projects (with business counts)
 * GET /api/project?id=<id>    → one project + its businesses
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
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
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = sanitizeText(body.name, 120);
  if (!name) {
    return NextResponse.json({ error: "name required (1–120 chars)" }, { status: 400 });
  }
  const description = sanitizeText(body.description, 500);
  const color =
    typeof body.color === "string" && HEX_COLOR_RE.test(body.color) ? body.color : null;

  const project = await db.project.create({
    data: { name, description, color },
  });
  return NextResponse.json(project);
}

/** PATCH /api/project  { id, name?, description?, color? } */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = body.id;
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = sanitizeText(body.name, 120);
    if (!name) return NextResponse.json({ error: "name must be 1–120 chars" }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) {
    data.description = sanitizeText(body.description, 500);
  }
  if (body.color !== undefined) {
    data.color =
      typeof body.color === "string" && HEX_COLOR_RE.test(body.color) ? body.color : null;
  }
  const updated = await db.project.update({ where: { id }, data });
  return NextResponse.json(updated);
}

/** DELETE /api/project?id=<id> */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !isValidId(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }
  // Unlink businesses then delete project
  await db.business.updateMany({ where: { projectId: id }, data: { projectId: null } });
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
