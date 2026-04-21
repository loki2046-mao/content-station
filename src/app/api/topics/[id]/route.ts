/**
 * 选题详情 API
 * GET    /api/topics/:id — 获取选题详情
 * PATCH  /api/topics/:id — 更新选题
 * DELETE /api/topics/:id — 删除选题
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { topics } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const rows = await db.select().from(topics).where(eq(topics.id, id));
    if (rows.length === 0) return err("选题不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`获取选题详情失败: ${error}`, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.source !== undefined) updates.source = body.source;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.status !== undefined) updates.status = body.status;
    if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
    updates.updatedAt = new Date().toISOString();

    await db.update(topics).set(updates).where(eq(topics.id, id));

    const rows = await db.select().from(topics).where(eq(topics.id, id));
    return ok(rows[0]);
  } catch (error) {
    return err(`更新选题失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(topics).where(eq(topics.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除选题失败: ${error}`, 500);
  }
}
