/**
 * 外脑收件箱 API
 * GET  /api/brain/inbox — 获取 inbox_items 列表，支持 ?status= 筛选
 * POST /api/brain/inbox — 新建 inbox_item，自动分类
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { inboxItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";
import { classify } from "@/lib/idea-classifier";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = db.select().from(inboxItems);
    if (status) {
      query = query.where(eq(inboxItems.status, status)) as typeof query;
    }

    const rows = await query.orderBy(desc(inboxItems.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取收件箱失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { rawContent, sourceType, quickType } = body;

    if (!rawContent || !rawContent.trim()) return err("内容不能为空");

    const { suggestedType, suggestedTags } = classify(rawContent);

    const now = new Date().toISOString();
    const newItem = {
      id: uuid(),
      rawContent: rawContent.trim(),
      sourceType: sourceType || "web",
      quickType: quickType || "",
      suggestedType,
      suggestedTags: JSON.stringify(suggestedTags),
      status: "inbox",
      promotedToId: "",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(inboxItems).values(newItem);
    return ok(newItem);
  } catch (error) {
    return err(`创建收件箱条目失败: ${error}`, 500);
  }
}
