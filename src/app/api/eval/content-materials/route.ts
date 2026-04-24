/**
 * 测评素材列表
 * GET /api/eval/content-materials — 查询 content_materials 表
 * 支持 ?source_type=eval_result 筛选
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { contentMaterials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get("source_type");

    let rows;
    if (sourceType) {
      rows = await db
        .select()
        .from(contentMaterials)
        .where(eq(contentMaterials.sourceType, sourceType as "eval_result" | "eval_insight" | "manual"))
        .orderBy(desc(contentMaterials.createdAt));
    } else {
      rows = await db
        .select()
        .from(contentMaterials)
        .orderBy(desc(contentMaterials.createdAt))
        .limit(200);
    }

    // 解析 JSON 字段
    const parsed = rows.map((r) => ({
      ...r,
      titleDirections: safeParseJsonArr(r.titleDirections),
      articleAngles: safeParseJsonArr(r.articleAngles),
    }));

    return ok(parsed);
  } catch (error) {
    return err(`获取测评素材失败: ${error}`, 500);
  }
}

function safeParseJsonArr(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
