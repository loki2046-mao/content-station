/**
 * 设置 API
 * GET   /api/settings — 获取所有配置
 * PATCH /api/settings — 更新配置
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { settings, tags } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function GET() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const settingRows = await db.select().from(settings);
    const tagRows = await db.select().from(tags);

    // 把 settings 转成 key-value 对象
    const config: Record<string, unknown> = {};
    for (const row of settingRows) {
      try {
        config[row.key] = JSON.parse(row.value || '""');
      } catch {
        config[row.key] = row.value;
      }
    }

    return ok({ settings: config, tags: tagRows });
  } catch (error) {
    return err(`获取设置失败: ${error}`, 500);
  }
}

export async function PATCH(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();

    // 更新 settings
    if (body.settings) {
      for (const [key, value] of Object.entries(body.settings)) {
        const jsonValue = JSON.stringify(value);
        // upsert: 先尝试更新，如果不存在则插入
        const existing = await db.select().from(settings).where(eq(settings.key, key));
        if (existing.length > 0) {
          await db.update(settings).set({ value: jsonValue }).where(eq(settings.key, key));
        } else {
          await db.insert(settings).values({ key, value: jsonValue });
        }
      }
    }

    // 管理标签
    if (body.addTag) {
      const tag = body.addTag;
      await db.insert(tags).values({
        id: tag.id || uuid(),
        name: tag.name,
        color: tag.color || "#B8623C",
        category: tag.category || "custom",
      });
    }

    if (body.updateTag) {
      const tag = body.updateTag;
      await db
        .update(tags)
        .set({ name: tag.name, color: tag.color, category: tag.category })
        .where(eq(tags.id, tag.id));
    }

    if (body.deleteTagId) {
      await db.delete(tags).where(eq(tags.id, body.deleteTagId));
    }

    // 返回最新配置
    const settingRows = await db.select().from(settings);
    const tagRows = await db.select().from(tags);

    const config: Record<string, unknown> = {};
    for (const row of settingRows) {
      try {
        config[row.key] = JSON.parse(row.value || '""');
      } catch {
        config[row.key] = row.value;
      }
    }

    return ok({ settings: config, tags: tagRows });
  } catch (error) {
    return err(`更新设置失败: ${error}`, 500);
  }
}
