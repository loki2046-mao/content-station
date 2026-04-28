/**
 * 一键自动推进 API
 * POST /api/articles/:id/auto-advance
 *
 * 逻辑：
 * 1. 获取文章所有 steps
 * 2. 找到第一个 status 不是 completed/skipped 的阶段
 * 3. 如果该阶段是 waiting_decision → 自动确认（advance），返回 advancedFrom
 * 4. 如果该阶段是 pending/failed → 执行它（runStageExecution），返回 executed
 * 5. 如果该阶段是 running → 返回 running（前端继续轮询）
 * 6. 如果所有阶段都 completed → 标记文章完成，返回 allDone
 *
 * 前端轮询调用此接口，每次推进一步，直到 allDone 或 failed
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";
import {
  STAGE_ORDER,
  Stage,
  updateStep,
  runStageExecution,
} from "@/lib/pipeline/executor";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    // 获取文章
    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id));
    if (!articleRows.length) return err("文章不存在", 404);
    const article = articleRows[0];

    if (article.status === "completed") {
      return ok({ action: "allDone", stage: "ready", message: "文章已完成全部流程" });
    }

    // 获取所有 steps
    const steps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, id));
    const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));

    // 找到第一个未完成的阶段
    let targetStage: Stage | null = null;
    for (const stage of STAGE_ORDER) {
      const step = stepsMap[stage];
      const status = step?.status || "pending";
      if (status !== "completed" && status !== "skipped") {
        targetStage = stage;
        break;
      }
    }

    // 所有阶段都完成了
    if (!targetStage) {
      const now = new Date().toISOString();
      await db
        .update(articles)
        .set({ status: "completed", updatedAt: now })
        .where(eq(articles.id, id));
      return ok({ action: "allDone", stage: "ready", message: "文章已完成全部流程" });
    }

    const step = stepsMap[targetStage];
    const stepStatus = step?.status || "pending";

    // 如果当前阶段正在执行中
    if (stepStatus === "running") {
      return ok({
        action: "running",
        stage: targetStage,
        message: `${targetStage} 阶段正在执行中...`,
      });
    }

    // 如果当前阶段等待决策 → 自动确认并推进
    if (stepStatus === "waiting_decision") {
      const now = new Date().toISOString();
      const currentIndex = STAGE_ORDER.indexOf(targetStage);
      const nextStage =
        currentIndex < STAGE_ORDER.length - 1
          ? STAGE_ORDER[currentIndex + 1]
          : null;

      // 标记当前 step 为 completed
      await db
        .update(articleSteps)
        .set({ status: "completed", completedAt: now })
        .where(
          and(
            eq(articleSteps.articleId, id),
            eq(articleSteps.stage, targetStage)
          )
        );

      if (nextStage) {
        // 设置下一阶段为 running
        await db
          .update(articleSteps)
          .set({ status: "running", startedAt: now, output: "{}", error: "" })
          .where(
            and(
              eq(articleSteps.articleId, id),
              eq(articleSteps.stage, nextStage)
            )
          );
        await db
          .update(articles)
          .set({ currentStage: nextStage, updatedAt: now })
          .where(eq(articles.id, id));

        // 同步执行下一阶段（Vercel serverless 需要同步等待）
        try {
          await runStageExecution(id, nextStage);
          return ok({
            action: "executed",
            stage: nextStage,
            message: `${nextStage} 阶段执行完成`,
          });
        } catch (error) {
          const errMsg =
            error instanceof Error ? error.message : String(error);
          return ok({
            action: "failed",
            stage: nextStage,
            error: errMsg,
            message: `${nextStage} 阶段执行失败: ${errMsg}`,
          });
        }
      } else {
        // 没有下一阶段，文章完成
        await db
          .update(articles)
          .set({ status: "completed", updatedAt: now })
          .where(eq(articles.id, id));
        return ok({
          action: "allDone",
          stage: targetStage,
          message: "文章已完成全部流程",
        });
      }
    }

    // pending 或 failed → 执行它
    if (stepStatus === "pending" || stepStatus === "failed") {
      const now = new Date().toISOString();

      // 确保 article.currentStage 指向目标阶段
      await db
        .update(articles)
        .set({ currentStage: targetStage, updatedAt: now })
        .where(eq(articles.id, id));

      // 标记为 running
      await updateStep(db, id, targetStage, {
        status: "running",
        startedAt: now,
        output: "{}",
        error: "",
      });

      // 同步执行
      try {
        await runStageExecution(id, targetStage);
        return ok({
          action: "executed",
          stage: targetStage,
          message: `${targetStage} 阶段执行完成`,
        });
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        return ok({
          action: "failed",
          stage: targetStage,
          error: errMsg,
          message: `${targetStage} 阶段执行失败: ${errMsg}`,
        });
      }
    }

    return err(`未知的步骤状态: ${stepStatus}`, 400);
  } catch (error) {
    return err(`自动推进失败: ${error}`, 500);
  }
}
