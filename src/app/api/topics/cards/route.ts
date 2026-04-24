/**
 * 推演卡片列表 API
 * GET  /api/topics/cards?projectId=xxx — 获取项目下所有卡片
 * POST /api/topics/cards — 新增单张卡片
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topicCards } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return err("缺少 projectId 参数");

    const rows = await db
      .select()
      .from(topicCards)
      .where(eq(topicCards.projectId, projectId))
      .orderBy(asc(topicCards.sortOrder), asc(topicCards.createdAt));

    return ok(rows);
  } catch (error) {
    return err(`获取卡片列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId, zoneType, title, content, cardStatus, sourceType, isPinned, sortOrder } = body;

    if (!projectId) return err("缺少 projectId");
    if (!zoneType) return err("缺少 zoneType");
    if (!title || !title.trim()) return err("卡片标题不能为空");

    const now = Date.now();
    const newCard = {
      id: uuid(),
      projectId,
      zoneType,
      title: title.trim(),
      content: content?.trim() || null,
      cardStatus: cardStatus || "active",
      sourceType: sourceType || "manual",
      isPinned: isPinned ? 1 : 0,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(topicCards).values(newCard);
    return ok(newCard);
  } catch (error) {
    return err(`创建卡片失败: ${error}`, 500);
  }
}
