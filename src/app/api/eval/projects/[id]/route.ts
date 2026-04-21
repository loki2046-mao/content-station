/**
 * 测评项目详情 API
 * GET /api/eval/projects/[id] — 获取单个项目详情（含 Case 列表）
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { evalProjects, evalCases } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    const rows = await db
      .select()
      .from(evalProjects)
      .where(eq(evalProjects.id, id))
      .limit(1);

    if (!rows.length) return err("项目不存在", 404);

    const cases = await db
      .select()
      .from(evalCases)
      .where(eq(evalCases.projectId, id))
      .orderBy(desc(evalCases.createdAt));

    return ok({ project: rows[0], cases });
  } catch (error) {
    return err(`获取项目详情失败: ${error}`, 500);
  }
}
