/**
 * 推进文章到下一阶段
 * POST /api/articles/:id/advance
 * body: { decision?: string, skipTo?: string }
 *
 * 逻辑：
 * 1. 把当前stage的step标为completed，记录decision和completedAt
 * 2. 确定下一个stage（顺序或skipTo）
 * 3. 把下一个stage的step标为running
 * 4. 更新article的currentStage
 *
 * 注意：不再自动调LLM，由前端浏览器接收响应后自行发起下一阶段LLM调用
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

const STAGE_ORDER = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
type Stage = (typeof STAGE_ORDER)[number];

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { decision, skipTo } = body as { decision?: string; skipTo?: string };

    const articleRows = await db.select().from(articles).where(eq(articles.id, id));
    if (articleRows.length === 0) return err("文章不存在", 404);
    const article = articleRows[0];

    const currentStage = article.currentStage as Stage;
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    if (currentIndex === -1) return err("当前阶段无效", 400);

    let nextStage: Stage | null = null;
    if (skipTo && STAGE_ORDER.includes(skipTo as Stage)) {
      nextStage = skipTo as Stage;
    } else {
      nextStage = currentIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIndex + 1] : null;
    }

    const now = new Date().toISOString();

    // 把当前step标为completed
    const currentStepUpdates: Record<string, unknown> = {
      status: "completed",
      completedAt: now,
    };
    if (decision !== undefined) currentStepUpdates.decision = decision;

    await db
      .update(articleSteps)
      .set(currentStepUpdates)
      .where(and(eq(articleSteps.articleId, id), eq(articleSteps.stage, currentStage)));

    if (nextStage) {
      // 把下一步标为 running（前端会在收到响应后立即发起LLM调用）
      await db
        .update(articleSteps)
        .set({ status: "running", startedAt: now, output: "{}", error: "" })
        .where(and(eq(articleSteps.articleId, id), eq(articleSteps.stage, nextStage)));

      await db
        .update(articles)
        .set({ currentStage: nextStage, updatedAt: now })
        .where(eq(articles.id, id));
    } else {
      // 没有下一阶段，文章完成
      await db
        .update(articles)
        .set({ status: "completed", updatedAt: now })
        .where(eq(articles.id, id));
    }

    const updatedArticle = await db.select().from(articles).where(eq(articles.id, id));
    const steps = await db.select().from(articleSteps).where(eq(articleSteps.articleId, id));

    return ok({
      article: updatedArticle[0],
      steps,
      advancedTo: nextStage,
    });
  } catch (error) {
    return err(`推进阶段失败: ${error}`, 500);
  }
}
