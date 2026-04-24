/**
 * 单张推演卡片 API
 * PATCH  /api/topics/cards/[id] — 更新卡片（标题/内容/状态/置顶）
 * DELETE /api/topics/cards/[id] — 删除卡片
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { topicCards } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, cardStatus, isPinned, sortOrder } = body;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content?.trim() || null;
    if (cardStatus !== undefined) updates.cardStatus = cardStatus;
    if (isPinned !== undefined) updates.isPinned = isPinned ? 1 : 0;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    await db.update(topicCards).set(updates).where(eq(topicCards.id, id));
    const rows = await db.select().from(topicCards).where(eq(topicCards.id, id));
    if (!rows.length) return err("卡片不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`更新卡片失败: ${error}`, 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    await db.delete(topicCards).where(eq(topicCards.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除卡片失败: ${error}`, 500);
  }
}
