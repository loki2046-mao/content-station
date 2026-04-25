/**
 * 素材批量导入 API
 * POST /api/materials/batch — 批量新建素材（一次性写入）
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const items: Array<{
      content: string;
      type: string;
      tags?: string[];
      sourceType?: string;
      sourceId?: string;
      sourceTitle?: string;
    }> = Array.isArray(body) ? body : body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return err("请传入素材数组");
    }

    const now = new Date().toISOString();
    const rows = items
      .filter((item) => item.content && item.type)
      .map((item) => ({
        id: uuid(),
        content: item.content,
        type: item.type as "opinion" | "quote" | "title_inspiration" | "example" | "opening" | "closing" | "title" | "angle" | "outline" | "general" | "prompt",
        tags: JSON.stringify(item.tags || []),
        topicIds: JSON.stringify([]),
        sourceType: item.sourceType || "",
        sourceId: item.sourceId || "",
        createdAt: now,
      }));

    // 分批插入，每批100条，避免SQLite单次写入过大
    const BATCH_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await db.insert(materials).values(chunk);
      inserted += chunk.length;
    }

    return ok({ inserted, total: items.length, skipped: items.length - inserted });
  } catch (error) {
    return err(`批量导入失败: ${error}`, 500);
  }
}
