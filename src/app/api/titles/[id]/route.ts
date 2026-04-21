/**
 * 标题方案详情 API
 * PATCH /api/titles/:id — 更新收藏状态
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { titles } from "@/lib/db/schema";
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

    if (body.favorites !== undefined) {
      updates.favorites = JSON.stringify(body.favorites);
    }

    await db.update(titles).set(updates).where(eq(titles.id, id));
    const rows = await db.select().from(titles).where(eq(titles.id, id));
    return ok(rows[0]);
  } catch (error) {
    return err(`更新标题方案失败: ${error}`, 500);
  }
}
