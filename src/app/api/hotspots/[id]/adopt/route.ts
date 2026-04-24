/**
 * 热点采纳 API
 * POST /api/hotspots/:id/adopt — 将热点转为选题
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { hotspotItems, topics } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    // 获取热点详情
    const rows = await db.select().from(hotspotItems).where(eq(hotspotItems.id, id));
    if (rows.length === 0) return err("热点不存在", 404);

    const hotspot = rows[0];

    if (hotspot.status === "adopted" && hotspot.adoptedTopicId) {
      return err("该热点已被采纳为选题");
    }

    // 可选：从 body 读取额外信息
    let extraTags: string[] = [];
    let customTitle: string | undefined;
    try {
      const body = await request.json();
      extraTags = body.tags || [];
      customTitle = body.title;
    } catch {
      // body 为空也没关系
    }

    const now = new Date().toISOString();

    // 构建选题标签：来源标签 + 热点原有标签 + 额外标签
    const hotspotTags: string[] = (() => {
      try {
        return JSON.parse(hotspot.tags || "[]");
      } catch {
        return [];
      }
    })();
    const allTags = [...new Set(["热点采纳", hotspot.source, ...hotspotTags, ...extraTags])];

    // 创建选题
    const topicId = uuid();
    const newTopic = {
      id: topicId,
      title: customTitle || hotspot.title,
      source: hotspot.url || `hotspot:${hotspot.source}`,
      summary: hotspot.summary || "",
      status: "unprocessed" as const,
      tags: JSON.stringify(allTags),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(topics).values(newTopic);

    // 更新热点状态
    await db
      .update(hotspotItems)
      .set({ status: "adopted", adoptedTopicId: topicId })
      .where(eq(hotspotItems.id, id));

    return ok({ hotspotId: id, topicId, topic: newTopic });
  } catch (error) {
    return err(`采纳热点失败: ${error}`, 500);
  }
}
