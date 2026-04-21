/**
 * 选题池 API
 * GET  /api/topics — 获取选题列表，支持 ?status=&tag=&q= 筛选
 * POST /api/topics — 新建选题
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topics } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, like, eq, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "50");

    // 构建查询条件
    const conditions = [];
    if (status) conditions.push(eq(topics.status, status as "unprocessed" | "analyzed" | "drafted" | "published" | "paused"));
    if (q) conditions.push(like(topics.title, `%${q}%`));

    let query = db.select().from(topics);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(topics.createdAt)).limit(limit);

    // 如果有 tag 筛选，在应用层过滤（JSON 字段）
    let result = rows;
    if (tag) {
      result = rows.filter((r) => {
        try {
          const tags = JSON.parse(r.tags || "[]");
          return tags.includes(tag);
        } catch {
          return false;
        }
      });
    }

    return ok(result);
  } catch (error) {
    return err(`获取选题列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { title, source, summary, status, tags: topicTags } = body;

    if (!title) return err("选题标题不能为空");

    const now = new Date().toISOString();
    const newTopic = {
      id: uuid(),
      title,
      source: source || "",
      summary: summary || "",
      status: status || "unprocessed",
      tags: JSON.stringify(topicTags || []),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(topics).values(newTopic);
    return ok(newTopic);
  } catch (error) {
    return err(`创建选题失败: ${error}`, 500);
  }
}
