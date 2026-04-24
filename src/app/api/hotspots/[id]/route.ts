/**
 * 单个热点 API
 * PATCH  /api/hotspots/:id — 更新状态（reviewed/dismissed）
 * DELETE /api/hotspots/:id — 删除热点
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { hotspotItems } from "@/lib/db/schema";
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

    if (body.status !== undefined) updates.status = body.status;
    if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
    if (body.summary !== undefined) updates.summary = body.summary;

    if (Object.keys(updates).length === 0) {
      return err("没有可更新的字段");
    }

    await db.update(hotspotItems).set(updates).where(eq(hotspotItems.id, id));

    const rows = await db.select().from(hotspotItems).where(eq(hotspotItems.id, id));
    if (rows.length === 0) return err("热点不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`更新热点失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(hotspotItems).where(eq(hotspotItems.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除热点失败: ${error}`, 500);
  }
}
