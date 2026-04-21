/**
 * 测试 Case API
 * GET  /api/eval/cases — 获取 Case 列表（支持 ?project_id= 筛选）
 * POST /api/eval/cases — 创建 Case
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalCases } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    let query = db.select().from(evalCases);
    if (projectId) {
      query = query.where(eq(evalCases.projectId, projectId)) as typeof query;
    }

    const rows = await query.orderBy(desc(evalCases.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取 Case 列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId, dimensionId, title, description, difficulty, status } = body;

    if (!projectId) return err("项目 ID 不能为空");
    if (!title) return err("Case 标题不能为空");

    const newCase = {
      id: uuid(),
      projectId,
      dimensionId: dimensionId || "",
      title,
      description: description || "",
      difficulty: (difficulty || "medium") as "easy" | "medium" | "hard",
      status: (status || "draft") as "draft" | "active",
      createdAt: new Date().toISOString(),
    };

    await db.insert(evalCases).values(newCase);
    return ok(newCase);
  } catch (error) {
    return err(`创建 Case 失败: ${error}`, 500);
  }
}
