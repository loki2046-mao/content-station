/**
 * 热点 API
 * GET  /api/hotspots — 获取热点列表，支持 ?source=&status=&q=&limit=&days= 筛选
 * POST /api/hotspots — 批量写入热点，或按 Cola 选题来源立即抓取
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { hotspotItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, like, eq, and, gte } from "drizzle-orm";
import { saveHotspots } from "@/lib/hotspots/store";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "100");
    const days = parseInt(searchParams.get("days") || "7");

    const conditions = [];

    if (source) conditions.push(eq(hotspotItems.source, source));
    if (status) conditions.push(eq(hotspotItems.status, status));
    if (q) conditions.push(like(hotspotItems.title, `%${q}%`));

    // 按天数筛选
    const since = new Date();
    since.setDate(since.getDate() - days);
    conditions.push(gte(hotspotItems.fetchedAt, since.toISOString()));

    let query = db.select().from(hotspotItems);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(hotspotItems.fetchedAt)).limit(limit);
    return ok(rows);
  } catch (error) {
    return err(`获取热点列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const result = await saveHotspots(db, body);

    if (result.total === 0) {
      return err("没有要写入的热点数据。传入 items 数组或设置 autoFetch: true");
    }

    return ok(result);
  } catch (error) {
    return err(`写入热点失败: ${error}`, 500);
  }
}
