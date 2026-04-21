/**
 * Prompt API
 * GET  /api/eval/prompts — 获取 Prompt 列表（支持 ?case_id= 筛选）
 * POST /api/eval/prompts — 创建 Prompt
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalPrompts } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("case_id");

    let query = db.select().from(evalPrompts);
    if (caseId) {
      query = query.where(eq(evalPrompts.caseId, caseId)) as typeof query;
    }

    const rows = await query.orderBy(desc(evalPrompts.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取 Prompt 列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { caseId, modelTarget, content, difficulty, isSaved } = body;

    if (!caseId) return err("Case ID 不能为空");
    if (!content) return err("Prompt 内容不能为空");

    const newPrompt = {
      id: uuid(),
      caseId,
      modelTarget: modelTarget || "",
      content,
      difficulty: difficulty || "medium",
      isSaved: isSaved ? 1 : 0,
      createdAt: new Date().toISOString(),
    };

    await db.insert(evalPrompts).values(newPrompt);
    return ok(newPrompt);
  } catch (error) {
    return err(`创建 Prompt 失败: ${error}`, 500);
  }
}
