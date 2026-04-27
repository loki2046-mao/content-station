/**
 * 文章详情 API
 * GET    /api/articles/:id — 获取文章详情（含所有steps）
 * PUT    /api/articles/:id — 更新文章信息
 * DELETE /api/articles/:id — 删除文章及其steps
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
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
    const rows = await db.select().from(articles).where(eq(articles.id, id));
    if (rows.length === 0) return err("文章不存在", 404);

    const steps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, id));

    return ok({ ...rows[0], steps });
  } catch (error) {
    return err(`获取文章详情失败: ${error}`, 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.topicId !== undefined) updates.topicId = body.topicId;
    if (body.status !== undefined) updates.status = body.status;
    if (body.currentStage !== undefined) updates.currentStage = body.currentStage;
    if (body.metadata !== undefined) updates.metadata = JSON.stringify(body.metadata);
    updates.updatedAt = new Date().toISOString();

    await db.update(articles).set(updates).where(eq(articles.id, id));

    const rows = await db.select().from(articles).where(eq(articles.id, id));
    if (rows.length === 0) return err("文章不存在", 404);

    const steps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, id));

    return ok({ ...rows[0], steps });
  } catch (error) {
    return err(`更新文章失败: ${error}`, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(articleSteps).where(eq(articleSteps.articleId, id));
    await db.delete(articles).where(eq(articles.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除文章失败: ${error}`, 500);
  }
}
