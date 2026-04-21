/**
 * 维度库 API
 * GET  /api/eval/dimensions — 获取维度列表（支持 ?model_type= 筛选）
 * POST /api/eval/dimensions — 创建自定义维度
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalDimensions } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const modelType = searchParams.get("model_type");

    let query = db.select().from(evalDimensions);
    if (modelType) {
      query = query.where(eq(evalDimensions.modelType, modelType)) as typeof query;
    }

    const rows = await query.orderBy(desc(evalDimensions.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取维度列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { name, modelType, isTemplate, templateName } = body;

    if (!name) return err("维度名称不能为空");

    const newDimension = {
      id: uuid(),
      name,
      modelType: modelType || "text",
      isTemplate: isTemplate ? 1 : 0,
      templateName: templateName || "",
      createdAt: new Date().toISOString(),
    };

    await db.insert(evalDimensions).values(newDimension);
    return ok(newDimension);
  } catch (error) {
    return err(`创建维度失败: ${error}`, 500);
  }
}
