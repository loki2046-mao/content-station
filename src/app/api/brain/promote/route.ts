/**
 * 外脑提升 API
 * POST /api/brain/promote — 将 inbox_item 提升为 content_item
 * 接收: { inboxId, title, itemType, tags, relatedTopic, relatedProduct }
 * itemType 必须以 ei_ 开头
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { inboxItems, contentItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { inboxId, title, itemType, tags, relatedTopic, relatedProduct } = body;

    if (!inboxId) return err("inboxId 不能为空");
    if (!itemType) return err("itemType 不能为空");

    // 服务端强制校验 ei_ 前缀
    if (!itemType.startsWith("ei_")) {
      return err("itemType 必须以 ei_ 开头，请使用外脑类型（ei_opinion / ei_title / ei_topic / ei_product_obs / ei_quote）");
    }

    // 获取 inbox_item
    const inboxRows = await db.select().from(inboxItems).where(eq(inboxItems.id, inboxId));
    if (!inboxRows.length) return err("inbox 条目不存在", 404);
    const inbox = inboxRows[0];

    const now = new Date().toISOString();
    const newContentItem = {
      id: uuid(),
      title: title || "",
      content: inbox.rawContent,
      itemType,
      tags: JSON.stringify(tags || []),
      relatedTopic: relatedTopic || "",
      relatedProduct: relatedProduct || "",
      sourceInboxId: inboxId, // 追溯来源
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contentItems).values(newContentItem);

    // 更新 inbox_item：设置 promoted_to_id 和 status='archived'
    await db.update(inboxItems)
      .set({
        promotedToId: newContentItem.id,
        status: "archived",
        updatedAt: now,
      })
      .where(eq(inboxItems.id, inboxId));

    return ok({
      contentItem: newContentItem,
      inboxId,
    });
  } catch (error) {
    return err(`提升失败: ${error}`, 500);
  }
}
