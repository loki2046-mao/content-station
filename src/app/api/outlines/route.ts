/**
 * 骨架列表 API
 * GET /api/outlines — 获取骨架历史
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { outlines } from "@/lib/db/schema";
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

    let query = db.select().from(outlines);
    if (topicId) {
      query = query.where(eq(outlines.topicId, topicId)) as typeof query;
    }

    const rows = await query.orderBy(desc(outlines.createdAt)).limit(limit);
    return ok(rows);
  } catch (error) {
    return err(`获取骨架记录失败: ${error}`, 500);
  }
}
