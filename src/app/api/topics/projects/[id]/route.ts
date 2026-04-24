/**
 * 单个推演项目 API
 * GET    /api/topics/projects/[id] — 获取项目详情
 * PATCH  /api/topics/projects/[id] — 更新项目（标题/描述/状态）
 * DELETE /api/topics/projects/[id] — 删除项目（级联删除卡片和结论）
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { topicProjects, topicCards, topicSummaries } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    const rows = await db.select().from(topicProjects).where(eq(topicProjects.id, id));
    if (!rows.length) return err("项目不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`获取项目失败: ${error}`, 500);
  }
}

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
    const { title, description, status } = body;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (status !== undefined) updates.status = status;

    await db.update(topicProjects).set(updates).where(eq(topicProjects.id, id));
    const rows = await db.select().from(topicProjects).where(eq(topicProjects.id, id));
    if (!rows.length) return err("项目不存在", 404);
    return ok(rows[0]);
  } catch (error) {
    return err(`更新项目失败: ${error}`, 500);
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
    // 级联删除
    await db.delete(topicCards).where(eq(topicCards.projectId, id));
    await db.delete(topicSummaries).where(eq(topicSummaries.projectId, id));
    await db.delete(topicProjects).where(eq(topicProjects.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除项目失败: ${error}`, 500);
  }
}
