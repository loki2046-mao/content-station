/**
 * 外部 Pipeline 触发 API
 * POST /api/external/pipeline
 *
 * 认证：Authorization: Bearer sk-station-xxx
 * 路由由 middleware 放行（/api/external/ 前缀），内部自行验证 Bearer token。
 *
 * 支持的 action：
 *   create  — 创建新文章并执行 topic 阶段
 *   execute — 执行指定阶段
 *   status  — 查询文章状态与所有 steps
 *   list    — 列出所有文章（支持 ?status= 筛选）
 *   advance — 记录 decision 并推进到下一阶段自动执行
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { err, dbError } from "@/lib/api-helpers";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { STAGE_ORDER, Stage, updateStep, runStageExecution } from "@/lib/pipeline/executor";
import { validateApiKey } from "@/app/api/settings/api-key/route";

const ALL_STAGES = STAGE_ORDER;

// ─── 认证辅助 ───────────────────────────────────────────
async function authenticate(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;
  return validateApiKey(token);
}

function unauth() {
  return NextResponse.json(
    { success: false, error: "未授权：API Key 无效或未设置" },
    { status: 401 }
  );
}

function ok(data: unknown) {
  return NextResponse.json({ success: true, data });
}

// ─── 主处理器 ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  // 认证
  if (!(await authenticate(request))) return unauth();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return err("请求体必须是合法的 JSON", 400);
  }

  const action = body.action as string;

  // ── list ─────────────────────────────────────────────
  if (action === "list") {
    const status = body.status as string | undefined;
    let query = db.select().from(articles);
    if (status) {
      query = query.where(
        eq(articles.status, status as "active" | "paused" | "completed" | "archived")
      ) as typeof query;
    }
    const rows = await query.orderBy(desc(articles.createdAt));
    return ok(rows);
  }

  // ── create ───────────────────────────────────────────
  if (action === "create") {
    const title = (body.title as string | undefined)?.trim();
    if (!title) return err("title 不能为空", 400);

    const now = new Date().toISOString();
    const articleId = crypto.randomUUID();

    const newArticle = {
      id: articleId,
      title,
      topicId: null as string | null,
      currentStage: "topic" as const,
      status: "active" as const,
      metadata: JSON.stringify(body.metadata || {}),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(articles).values(newArticle);

    // 创建全部7个 step
    const steps = ALL_STAGES.map((stage, index) => ({
      id: crypto.randomUUID(),
      articleId,
      stage,
      status: index === 0 ? ("running" as const) : ("pending" as const),
      input: "{}",
      output: "{}",
      decision: null as string | null,
      error: "",
      startedAt: index === 0 ? now : null,
      completedAt: null as string | null,
      createdAt: now,
    }));

    for (const step of steps) {
      await db.insert(articleSteps).values(step);
    }

    // 服务端同步执行 topic 阶段（外部 API 走服务端执行路径）
    try {
      await runStageExecution(articleId, "topic");
    } catch (e) {
      // 执行失败时仍返回文章信息，status 已被标为 failed
      console.error("[External API] create/topic failed", e);
    }

    const updatedSteps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, articleId));

    const topicStep = updatedSteps.find((s) => s.stage === "topic");
    let topicOutput: unknown = null;
    try {
      topicOutput = topicStep?.output ? JSON.parse(topicStep.output) : null;
    } catch {
      topicOutput = null;
    }

    return ok({
      articleId,
      article: { ...newArticle, updatedAt: topicStep?.completedAt || now },
      topicResult: topicOutput,
      topicStatus: topicStep?.status,
    });
  }

  // ── execute ──────────────────────────────────────────
  if (action === "execute") {
    const articleId = body.articleId as string | undefined;
    const stage = body.stage as string | undefined;

    if (!articleId) return err("articleId 不能为空", 400);
    if (!stage || !ALL_STAGES.includes(stage as Stage))
      return err(`无效的阶段: ${stage}`, 400);

    const targetStage = stage as Stage;

    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));
    if (!articleRows.length) return err("文章不存在", 404);

    const now = new Date().toISOString();

    await updateStep(db, articleId, targetStage, {
      status: "running",
      startedAt: now,
      output: "{}",
      error: "",
    });
    await db
      .update(articles)
      .set({ updatedAt: now })
      .where(eq(articles.id, articleId));

    let output: unknown = null;
    try {
      output = await runStageExecution(articleId, targetStage);
    } catch (e) {
      return err(`执行阶段失败: ${e}`, 500);
    }

    return ok({ status: "completed", stage: targetStage, output });
  }

  // ── status ───────────────────────────────────────────
  if (action === "status") {
    const articleId = body.articleId as string | undefined;
    if (!articleId) return err("articleId 不能为空", 400);

    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));
    if (!articleRows.length) return err("文章不存在", 404);

    const steps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, articleId));

    return ok({ article: articleRows[0], steps });
  }

  // ── advance ──────────────────────────────────────────
  if (action === "advance") {
    const articleId = body.articleId as string | undefined;
    const decision = body.decision as string | undefined;

    if (!articleId) return err("articleId 不能为空", 400);

    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));
    if (!articleRows.length) return err("文章不存在", 404);

    const article = articleRows[0];
    const currentStage = article.currentStage as Stage;
    const currentIndex = ALL_STAGES.indexOf(currentStage);
    if (currentIndex === -1) return err("当前阶段无效", 400);

    const now = new Date().toISOString();

    // 把当前 step 标为 completed，写入 decision
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
          eq(articleSteps.articleId, articleId),
          eq(articleSteps.stage, currentStage)
        )
      );

    // 确定下一阶段
    const nextStage: Stage | null =
      currentIndex < ALL_STAGES.length - 1
        ? ALL_STAGES[currentIndex + 1]
        : null;

    if (!nextStage) {
      await db
        .update(articles)
        .set({ status: "completed", updatedAt: now })
        .where(eq(articles.id, articleId));
      return ok({ advancedTo: null, message: "文章已完成全部流程" });
    }

    // 标记下一阶段为 running
    await updateStep(db, articleId, nextStage, {
      status: "running",
      startedAt: now,
      output: "{}",
      error: "",
    });
    await db
      .update(articles)
      .set({ currentStage: nextStage, updatedAt: now })
      .where(eq(articles.id, articleId));

    // 服务端同步执行下一阶段
    let output: unknown = null;
    try {
      output = await runStageExecution(articleId, nextStage);
    } catch (e) {
      return err(`执行阶段 ${nextStage} 失败: ${e}`, 500);
    }

    return ok({ advancedTo: nextStage, output });
  }

  return err(
    `不支持的 action: ${action}。支持的值：create | execute | status | list | advance`,
    400
  );
}

// 也支持 GET 做简单的 list（无 body）
export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  if (!(await authenticate(request))) return unauth();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = db.select().from(articles);
  if (status) {
    query = query.where(
      eq(articles.status, status as "active" | "paused" | "completed" | "archived")
    ) as typeof query;
  }
  const rows = await query.orderBy(desc(articles.createdAt));
  return ok(rows);
}
