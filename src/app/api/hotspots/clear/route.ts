/**
 * 清理热点 API
 * POST /api/hotspots/clear — 清除 N 天前的已处理热点（dismissed + adopted 超过指定天数的）
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { hotspotItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { and, lte, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    let days = 7;
    try {
      const body = await request.json();
      if (body.days) days = parseInt(body.days);
    } catch {
      // 默认 7 天
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    // 删除已处理（dismissed/adopted）且超过 N 天的热点
    await db
      .delete(hotspotItems)
      .where(
        and(
          inArray(hotspotItems.status, ["dismissed", "adopted"]),
          lte(hotspotItems.fetchedAt, cutoffStr)
        )
      );

    return ok({ cleared: true, days });
  } catch (error) {
    return err(`清理热点失败: ${error}`, 500);
  }
}
