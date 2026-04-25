/**
 * 素材库 API
 * GET    /api/materials — 获取素材列表
 * POST   /api/materials — 新建素材
 * DELETE /api/materials?source=wechat_article — 按来源清空素材（不传source则清空全部）
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, like, eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const q = searchParams.get("q");
    const tag = searchParams.get("tag");
    const limit = parseInt(searchParams.get("limit") || "50");

    const conditions = [];
    if (type) conditions.push(eq(materials.type, type as "opinion" | "quote" | "title_inspiration" | "example" | "opening" | "closing" | "title" | "angle" | "outline" | "general" | "prompt"));
    if (q) conditions.push(like(materials.content, `%${q}%`));

    let query = db.select().from(materials);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(materials.createdAt)).limit(limit);

    // 标签筛选在应用层
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
    return err(`获取素材列表失败: ${error}`, 500);
  }
}

export async function DELETE(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    if (source) {
      await db.delete(materials).where(eq(materials.sourceType, source));
    } else {
      await db.delete(materials);
    }
    return ok({ deleted: true, source: source || "all" });
  } catch (error) {
    return err(`清空素材失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { content, type, tags: materialTags, topicIds, sourceType, sourceId } = body;

    if (!content) return err("素材内容不能为空");
    if (!type) return err("请选择素材类型");

    const newMaterial = {
      id: uuid(),
      content,
      type,
      tags: JSON.stringify(materialTags || []),
      topicIds: JSON.stringify(topicIds || []),
      sourceType: sourceType || "",
      sourceId: sourceId || "",
      createdAt: new Date().toISOString(),
    };

    await db.insert(materials).values(newMaterial);
    return ok(newMaterial);
  } catch (error) {
    return err(`创建素材失败: ${error}`, 500);
  }
}
