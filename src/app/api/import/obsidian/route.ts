/**
 * Obsidian 笔记素材导入 API
 * POST /api/import/obsidian
 * Body: { items: RawItem[], overwrite?: boolean }
 * Response: { inserted: number, total: number }
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";

type RawItem = {
  content: string;
  type: string;
  tags?: string[];
  sourceType?: string;
  sourceId?: string;
  sourceTitle?: string;
};

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const rawItems: RawItem[] = body.items;
    const overwrite: boolean = body.overwrite ?? false;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return err("素材数据为空或格式错误", 400);
    }

    if (overwrite) {
      await db.delete(materials).where(eq(materials.sourceType, "obsidian"));
    }

    const now = new Date().toISOString();
    const rows = rawItems
      .filter((item) => item.content && item.type)
      .map((item) => ({
        id: uuid(),
        content: item.content,
        type: item.type as
          | "opinion"
          | "quote"
          | "title_inspiration"
          | "example"
          | "opening"
          | "closing"
          | "title"
          | "angle"
          | "outline"
          | "general"
          | "prompt",
        tags: JSON.stringify(item.tags || []),
        topicIds: JSON.stringify([]),
        sourceType: "obsidian",
        sourceId: item.sourceId || "",
        createdAt: now,
      }));

    const BATCH_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await db.insert(materials).values(chunk);
      inserted += chunk.length;
    }

    return ok({ inserted, total: rawItems.length });
  } catch (error) {
    return err(`导入失败: ${error}`, 500);
  }
}
