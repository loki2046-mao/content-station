/**
 * 文章步骤状态写入 API
 * PATCH /api/articles/:id/steps/:stage
 * body: { status: "waiting_decision" | "running" | "failed", output?: string, error?: string }
 *
 * 前端LLM调用完成后用此接口把结果写回数据库，不调LLM。
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string; stage: string }> };

const VALID_STAGES = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
const VALID_STATUSES = ["running", "waiting_decision", "failed"] as const;

type Stage = (typeof VALID_STAGES)[number];
type StepStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  const { id, stage } = await params;

  if (!VALID_STAGES.includes(stage as Stage)) {
    return err(`无效的阶段: ${stage}`, 400);
  }

  try {
    const body = await request.json();
    const { status, output, error: stepError } = body as {
      status?: StepStatus;
      output?: string;
      error?: string;
    };

    if (!status || !VALID_STATUSES.includes(status)) {
      return err(`无效的状态: ${status}，允许值: ${VALID_STATUSES.join(", ")}`, 400);
    }

    // 验证文章存在
    const articleRows = await db.select().from(articles).where(eq(articles.id, id));
    if (!articleRows.length) return err("文章不存在", 404);

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { status };

    if (output !== undefined) updates.output = output;
    if (stepError !== undefined) updates.error = stepError;
    if (status === "running") updates.startedAt = now;
    if (status === "waiting_decision") updates.completedAt = now;

    await db
      .update(articleSteps)
      .set(updates)
      .where(and(eq(articleSteps.articleId, id), eq(articleSteps.stage, stage as Stage)));

    // 更新 article updatedAt
    await db.update(articles).set({ updatedAt: now }).where(eq(articles.id, id));

    return ok({ stage, status });
  } catch (error) {
    return err(`更新步骤失败: ${error}`, 500);
  }
}
