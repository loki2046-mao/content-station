/**
 * 素材详情 API
 * PATCH  /api/materials/:id — 更新素材
 * DELETE /api/materials/:id — 删除素材
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.content !== undefined) updates.content = body.content;
    if (body.type !== undefined) updates.type = body.type;
    if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
    if (body.topicIds !== undefined) updates.topicIds = JSON.stringify(body.topicIds);

    await db.update(materials).set(updates).where(eq(materials.id, id));
    const rows = await db.select().from(materials).where(eq(materials.id, id));
    return ok(rows[0]);
  } catch (error) {
    return err(`更新素材失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(materials).where(eq(materials.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除素材失败: ${error}`, 500);
  }
}
