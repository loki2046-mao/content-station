/**
 * 推进文章到下一阶段
 * POST /api/articles/:id/advance
 * body: { decision?: string, skipTo?: string }
 *
 * 逻辑：
 * 1. 把当前stage的step标为completed，记录decision和completedAt
 * 2. 确定下一个stage（顺序或skipTo）
 * 3. 把下一个stage的step标为running，记录startedAt
 * 4. 更新article的currentStage
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

const STAGE_ORDER = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
type Stage = typeof STAGE_ORDER[number];

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { decision, skipTo } = body as { decision?: string; skipTo?: string };

    // 获取当前文章
    const articleRows = await db.select().from(articles).where(eq(articles.id, id));
    if (articleRows.length === 0) return err("文章不存在", 404);
    const article = articleRows[0];

    const currentStage = article.currentStage as Stage;
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    if (currentIndex === -1) return err("当前阶段无效", 400);

    // 确定下一个阶段
    let nextStage: Stage | null = null;
    if (skipTo && STAGE_ORDER.includes(skipTo as Stage)) {
      nextStage = skipTo as Stage;
    } else {
      nextStage = currentIndex < STAGE_ORDER.length - 1
        ? STAGE_ORDER[currentIndex + 1]
        : null;
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
      .where(
        and(
          eq(articleSteps.articleId, id),
          eq(articleSteps.stage, currentStage)
        )
      );

    // 如果有下一个阶段，把它标为running
    if (nextStage) {
      await db
        .update(articleSteps)
        .set({ status: "running", startedAt: now })
        .where(
          and(
            eq(articleSteps.articleId, id),
            eq(articleSteps.stage, nextStage)
          )
        );

      // 更新article的currentStage
      await db
        .update(articles)
        .set({ currentStage: nextStage, updatedAt: now })
        .where(eq(articles.id, id));
    } else {
      // 已经是最后阶段，标记文章为completed
      await db
        .update(articles)
        .set({ status: "completed", updatedAt: now })
        .where(eq(articles.id, id));
    }

    // 返回更新后的文章和steps
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
