/**
 * 卡片排序 API
 * POST /api/topics/cards/reorder — 批量更新 sort_order
 * body: { updates: [{ id: string, sortOrder: number }] }
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { topicCards } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || !updates.length) return err("updates 数组不能为空");

    const now = Date.now();
    for (const item of updates) {
      if (!item.id || item.sortOrder === undefined) continue;
      await db
        .update(topicCards)
        .set({ sortOrder: item.sortOrder, updatedAt: now })
        .where(eq(topicCards.id, item.id));
    }

    return ok({ updated: updates.length });
  } catch (error) {
    return err(`更新排序失败: ${error}`, 500);
  }
}
