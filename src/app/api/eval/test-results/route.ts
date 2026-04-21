/**
 * 测试结果 API
 * GET  /api/eval/test-results — 获取结果列表（支持 ?project_id= / ?case_id= 筛选）
 * POST /api/eval/test-results — 创建测试结果
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalTestResults, evalCases } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("case_id");
    const projectId = searchParams.get("project_id");

    if (caseId) {
      const rows = await db
        .select()
        .from(evalTestResults)
        .where(eq(evalTestResults.caseId, caseId))
        .orderBy(desc(evalTestResults.createdAt));
      return ok(rows);
    }

    if (projectId) {
      // 先找出这个项目下所有 case 的 ID
      const projectCases = await db
        .select({ id: evalCases.id })
        .from(evalCases)
        .where(eq(evalCases.projectId, projectId));

      const caseIds = projectCases.map((c) => c.id);
      if (!caseIds.length) return ok([]);

      const rows = await db
        .select()
        .from(evalTestResults)
        .where(inArray(evalTestResults.caseId, caseIds))
        .orderBy(desc(evalTestResults.createdAt));
      return ok(rows);
    }

    const rows = await db
      .select()
      .from(evalTestResults)
      .orderBy(desc(evalTestResults.createdAt))
      .limit(100);
    return ok(rows);
  } catch (error) {
    return err(`获取测试结果失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const {
      promptId,
      caseId,
      modelUsed,
      outputUrl,
      rating,
      highlights,
      issues,
      worthWriting,
      extractableInsight,
    } = body;

    if (!caseId) return err("Case ID 不能为空");

    const now = new Date().toISOString();
    const newResult = {
      id: uuid(),
      promptId: promptId || "",
      caseId,
      modelUsed: modelUsed || "",
      testedAt: now,
      outputUrl: outputUrl || "",
      rating: (rating || "success") as "success" | "fail" | "crash" | "exceed",
      highlights: highlights || "",
      issues: issues || "",
      worthWriting: worthWriting ? 1 : 0,
      extractableInsight: extractableInsight || "",
      createdAt: now,
    };

    await db.insert(evalTestResults).values(newResult);
    return ok(newResult);
  } catch (error) {
    return err(`创建测试结果失败: ${error}`, 500);
  }
}
