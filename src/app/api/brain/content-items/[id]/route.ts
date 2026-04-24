/**
 * 外脑内容库单条 API
 * PATCH  /api/brain/content-items/:id — 更新
 * DELETE /api/brain/content-items/:id — 删除
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { contentItems } from "@/lib/db/schema";
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
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.itemType !== undefined) {
      if (!body.itemType.startsWith("ei_")) {
        return err("itemType 必须以 ei_ 开头");
      }
      updates.itemType = body.itemType;
    }
    if (body.tags !== undefined) {
      updates.tags = Array.isArray(body.tags)
        ? JSON.stringify(body.tags)
        : body.tags;
    }
    if (body.relatedTopic !== undefined) updates.relatedTopic = body.relatedTopic;
    if (body.relatedProduct !== undefined) updates.relatedProduct = body.relatedProduct;
    if (body.status !== undefined) updates.status = body.status;

    await db.update(contentItems).set(updates).where(eq(contentItems.id, id));
    const rows = await db.select().from(contentItems).where(eq(contentItems.id, id));
    if (!rows.length) return err("条目不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`更新内容项失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(contentItems).where(eq(contentItems.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除内容项失败: ${error}`, 500);
  }
}
