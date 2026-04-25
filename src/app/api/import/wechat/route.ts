/**
 * 公众号历史文章素材导入 API
 * POST /api/import/wechat
 * Query: ?overwrite=true  → 先删除 sourceType='wechat_article' 的旧数据再插入
 * Response: { inserted: number, total: number }
 */
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";

const MATERIALS_FILE = join(
  "/Users/kude/.cola/outputs/公众号历史文章素材入库",
  "all-materials.json"
);

type RawItem = {
  content: string;
  type: string;
  tags?: string[];
  sourceType?: string;
  sourceId?: string;
  sourceTitle?: string;
};

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    // 读取本地 JSON 文件
    let rawItems: RawItem[];
    try {
      const fileContent = readFileSync(MATERIALS_FILE, "utf-8");
      rawItems = JSON.parse(fileContent);
    } catch (e) {
      return err(`读取素材文件失败: ${e}`, 500);
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return err("素材文件为空或格式错误", 400);
    }

    // overwrite=true 时先清空旧的 wechat_article 数据
    const { searchParams } = new URL(request.url);
    const overwrite = searchParams.get("overwrite") === "true";
    if (overwrite) {
      await db.delete(materials).where(eq(materials.sourceType, "wechat_article"));
    }

    // 构建插入行
    const now = new Date().toISOString();
    const rows = rawItems
      .filter((item) => item.content && item.type)
      .map((item) => ({
        id: uuid(),
        content: item.content,
        type: item.type as
          | "opinion"
          | "quote"
          | "title_inspiration"
          | "example"
          | "opening"
          | "closing"
          | "title"
          | "angle"
          | "outline"
          | "general"
          | "prompt",
        tags: JSON.stringify(item.tags || []),
        topicIds: JSON.stringify([]),
        sourceType: "wechat_article",
        sourceId: item.sourceId || "",
        createdAt: now,
      }));

    // 分批插入，每批 100 条
    const BATCH_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await db.insert(materials).values(chunk);
      inserted += chunk.length;
    }

    return ok({ inserted, total: rawItems.length });
  } catch (error) {
    return err(`导入失败: ${error}`, 500);
  }
}
