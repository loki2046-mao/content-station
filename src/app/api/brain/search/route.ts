/**
 * 外脑全局搜索 API
 * GET /api/brain/search?q=xxx
 * 同时搜 inbox_items.raw_content 和 content_items（title+content）
 * 合并返回，区分来源
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { inboxItems, contentItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { like, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || !q.trim()) return err("搜索关键词不能为空");
    const keyword = q.trim();

    // 搜索收件箱
    const inboxResults = await db
      .select()
      .from(inboxItems)
      .where(like(inboxItems.rawContent, `%${keyword}%`))
      .orderBy(desc(inboxItems.createdAt))
      .limit(20);

    // 搜索内容库（title + content）
    const contentResults = await db
      .select()
      .from(contentItems)
      .where(
        or(
          like(contentItems.title, `%${keyword}%`),
          like(contentItems.content, `%${keyword}%`)
        )
      )
      .orderBy(desc(contentItems.createdAt))
      .limit(20);

    return ok({
      inbox: inboxResults,
      content: contentResults,
      total: inboxResults.length + contentResults.length,
    });
  } catch (error) {
    return err(`搜索失败: ${error}`, 500);
  }
}
