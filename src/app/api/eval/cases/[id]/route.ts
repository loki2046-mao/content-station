/**
 * 测试 Case 详情 API
 * DELETE /api/eval/cases/[id] — 删除 Case
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { evalCases, evalPrompts, evalTestResults } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;

    // 先级联删除该 Case 下的 Prompt 和 TestResult
    await db.delete(evalTestResults).where(eq(evalTestResults.caseId, id));
    await db.delete(evalPrompts).where(eq(evalPrompts.caseId, id));
    await db.delete(evalCases).where(eq(evalCases.id, id));

    return ok({ id, deleted: true });
  } catch (error) {
    return err(`删除 Case 失败: ${error}`, 500);
  }
}
