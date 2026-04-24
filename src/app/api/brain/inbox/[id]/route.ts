/**
 * 外脑收件箱单条 API
 * GET    /api/brain/inbox/:id — 获取单条
 * PATCH  /api/brain/inbox/:id — 更新 status / quickType / suggestedType / suggestedTags
 * DELETE /api/brain/inbox/:id — 删除
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { inboxItems } from "@/lib/db/schema";
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
    const rows = await db.select().from(inboxItems).where(eq(inboxItems.id, id));
    if (!rows.length) return err("条目不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`获取条目失败: ${error}`, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.quickType !== undefined) updates.quickType = body.quickType;
    if (body.suggestedType !== undefined) updates.suggestedType = body.suggestedType;
    if (body.suggestedTags !== undefined) {
      updates.suggestedTags = Array.isArray(body.suggestedTags)
        ? JSON.stringify(body.suggestedTags)
        : body.suggestedTags;
    }
    if (body.rawContent !== undefined) updates.rawContent = body.rawContent;

    await db.update(inboxItems).set(updates).where(eq(inboxItems.id, id));
    const rows = await db.select().from(inboxItems).where(eq(inboxItems.id, id));
    if (!rows.length) return err("条目不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`更新条目失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(inboxItems).where(eq(inboxItems.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除条目失败: ${error}`, 500);
  }
}
