/**
 * 标题方案列表 API
 * GET /api/titles — 获取标题方案历史
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { titles } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = db.select().from(titles);
    if (topicId) {
      query = query.where(eq(titles.topicId, topicId)) as typeof query;
    }

    const rows = await query.orderBy(desc(titles.createdAt)).limit(limit);
    return ok(rows);
  } catch (error) {
    return err(`获取标题记录失败: ${error}`, 500);
  }
}
