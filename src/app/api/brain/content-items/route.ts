/**
 * 外脑内容库 API
 * GET  /api/brain/content-items — 获取列表，支持 ?type= ?q= 筛选
 * POST /api/brain/content-items — 手动新建（不经过 inbox）
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { contentItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq, like, and, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "100");

    const conditions = [];
    if (type && type !== "all") {
      conditions.push(eq(contentItems.itemType, type));
    }
    if (q) {
      conditions.push(
        or(
          like(contentItems.title, `%${q}%`),
          like(contentItems.content, `%${q}%`)
        )
      );
    }

    let query = db.select().from(contentItems);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(contentItems.createdAt)).limit(limit);
    return ok(rows);
  } catch (error) {
    return err(`获取内容库失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { title, content, itemType, tags, relatedTopic, relatedProduct } = body;

    if (!content || !content.trim()) return err("内容不能为空");
    if (!itemType) return err("itemType 不能为空");
    if (!itemType.startsWith("ei_")) {
      return err("itemType 必须以 ei_ 开头");
    }

    const now = new Date().toISOString();
    const newItem = {
      id: uuid(),
      title: title || "",
      content: content.trim(),
      itemType,
      tags: JSON.stringify(tags || []),
      relatedTopic: relatedTopic || "",
      relatedProduct: relatedProduct || "",
      sourceInboxId: "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contentItems).values(newItem);
    return ok(newItem);
  } catch (error) {
    return err(`创建内容项失败: ${error}`, 500);
  }
}
