/**
 * 项目关联维度 API
 * GET /api/eval/project-dimensions?project_id=xxx — 获取项目关联的维度列表
 * POST /api/eval/project-dimensions — 为项目关联维度
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalProjectDimensions, evalDimensions } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    if (!projectId) return err("project_id 不能为空");

    // 查项目关联的维度 ID
    const links = await db
      .select()
      .from(evalProjectDimensions)
      .where(eq(evalProjectDimensions.projectId, projectId));

    if (!links.length) return ok([]);

    const dimIds = links.map((l) => l.dimensionId);
    const dims = await db
      .select()
      .from(evalDimensions)
      .where(inArray(evalDimensions.id, dimIds));

    return ok(dims);
  } catch (error) {
    return err(`获取项目维度失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId, dimensionId } = body;
    if (!projectId) return err("projectId 不能为空");
    if (!dimensionId) return err("dimensionId 不能为空");

    const newLink = { id: uuid(), projectId, dimensionId };
    await db.insert(evalProjectDimensions).values(newLink);
    return ok(newLink);
  } catch (error) {
    return err(`关联维度失败: ${error}`, 500);
  }
}
