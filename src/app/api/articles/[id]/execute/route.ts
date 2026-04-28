/**
 * Pipeline 阶段执行 API
 * POST /api/articles/:id/execute
 * body: { stage: string }
 *
 * 后台任务模式：
 * 1. 立即把 step.status = "running"
 * 2. 同步等待 LLM 执行完成 → 写 output → status = "waiting_decision"
 * 3. 返回 { status: "completed" }
 *
 * 核心执行逻辑已抽取到 src/lib/pipeline/executor.ts
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";
import {
  STAGE_ORDER,
  Stage,
  updateStep,
  runStageExecution,
} from "@/lib/pipeline/executor";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { stage } = body as { stage?: string };

    if (!stage || !STAGE_ORDER.includes(stage as Stage)) {
      return err(`无效的阶段: ${stage}`, 400);
    }

    const targetStage = stage as Stage;

    // 验证文章存在
    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id));
    if (!articleRows.length) return err("文章不存在", 404);

    const now = new Date().toISOString();

    // 把目标 step 标为 running
    await updateStep(db, id, targetStage, {
      status: "running",
      startedAt: now,
      output: "{}",
      error: "",
    });

    // 更新 article updatedAt
    await db
      .update(articles)
      .set({ updatedAt: now })
      .where(eq(articles.id, id));

    // 同步等待执行完成（Vercel serverless 会杀掉 fire-and-forget 的异步任务）
    await runStageExecution(id, targetStage);

    return ok({ status: "completed", stage: targetStage });
  } catch (error) {
    return err(`执行阶段失败: ${error}`, 500);
  }
}
