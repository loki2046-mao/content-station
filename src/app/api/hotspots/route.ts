/**
 * 热点 API
 * GET  /api/hotspots — 获取热点列表，支持 ?source=&status=&q=&limit=&days= 筛选
 * POST /api/hotspots — 批量写入热点（供外部调用，如 Cola cron 或手动触发）
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { hotspotItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, like, eq, and, gte } from "drizzle-orm";
import { fetchAllHotspots } from "@/lib/hotspots/fetchers";

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
    const { items, autoFetch } = body;

    const now = new Date().toISOString();
    let toInsert: Array<{
      id: string;
      source: string;
      title: string;
      url: string;
      heatScore: number;
      summary: string;
      author: string;
      tags: string;
      status: string;
      fetchedAt: string;
      createdAt: string;
    }> = [];

    // 模式一：外部推送 items 数组
    if (items && Array.isArray(items)) {
      toInsert = items.map(
        (item: {
          title: string;
          url?: string;
          heat_score?: number;
          heatScore?: number;
          summary?: string;
          author?: string;
          source: string;
          tags?: string[];
        }) => ({
          id: uuid(),
          source: item.source || "unknown",
          title: item.title,
          url: item.url || "",
          heatScore: item.heat_score ?? item.heatScore ?? 0,
          summary: item.summary || "",
          author: item.author || "",
          tags: JSON.stringify(item.tags || []),
          status: "new",
          fetchedAt: now,
          createdAt: now,
        })
      );
    }

    // 模式二：自动抓取（调用内置 fetcher）
    if (autoFetch) {
      const fetched = await fetchAllHotspots();
      const autoItems = fetched.map((entry) => ({
        id: uuid(),
        source: entry.source,
        title: entry.title,
        url: entry.url || "",
        heatScore: entry.heatScore || 0,
        summary: entry.summary || "",
        author: entry.author || "",
        tags: JSON.stringify(entry.tags || []),
        status: "new",
        fetchedAt: now,
        createdAt: now,
      }));
      toInsert.push(...autoItems);
    }

    if (toInsert.length === 0) {
      return err("没有要写入的热点数据。传入 items 数组或设置 autoFetch: true");
    }

    // 去重：跳过标题完全一致且来源相同的最近条目
    const existingRows = await db
      .select({ title: hotspotItems.title, source: hotspotItems.source })
      .from(hotspotItems)
      .where(gte(hotspotItems.fetchedAt, new Date(Date.now() - 3 * 86400000).toISOString()));

    const existingSet = new Set(existingRows.map((r) => `${r.source}::${r.title}`));
    const deduped = toInsert.filter((item) => !existingSet.has(`${item.source}::${item.title}`));

    if (deduped.length > 0) {
      // 分批插入，每批 50 条
      for (let i = 0; i < deduped.length; i += 50) {
        const batch = deduped.slice(i, i + 50);
        await db.insert(hotspotItems).values(batch);
      }
    }

    return ok({
      total: toInsert.length,
      inserted: deduped.length,
      duplicates: toInsert.length - deduped.length,
    });
  } catch (error) {
    return err(`写入热点失败: ${error}`, 500);
  }
}
