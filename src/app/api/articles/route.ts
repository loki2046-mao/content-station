/**
 * 文章列表 API
 * GET  /api/articles — 获取文章列表，支持 ?status=&stage= 筛选
 * POST /api/articles — 创建新文章，自动创建全部7个stage的step记录，并自动触发topic阶段执行
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps, materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq, and, or, like } from "drizzle-orm";
import { getProvider } from "@/lib/providers";
import {
  PIPELINE_SYSTEM_PROMPT,
  buildTopicAnalysisPrompt,
  parseLLMJson,
} from "@/lib/prompts/pipeline";

const ALL_STAGES = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
type Stage = (typeof ALL_STAGES)[number];

function safeJson<T = Record<string, unknown>>(str: string | null | undefined): T | null {
  if (!str || str === "{}" || str === "null") return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

/** 后台自动执行 topic 阶段 */
async function autoRunTopicStage(articleId: string) {
  const db = getDb();
  if (!db) return;
  const now = () => new Date().toISOString();

  try {
    const articleRows = await db.select().from(articles).where(eq(articles.id, articleId));
    if (!articleRows.length) return;
    const article = articleRows[0];
    const metadata = safeJson<Record<string, string>>(article.metadata) || {};

    const provider = await getProvider();
    if (!provider) {
      // 无 provider 配置时，直接设为 waiting_decision，带提示
      await db
        .update(articleSteps)
        .set({
          status: "waiting_decision",
          output: JSON.stringify({ error: "AI 模型未配置，请先在设置页面配置 API Key", angles: [] }),
          completedAt: now(),
        })
        .where(and(eq(articleSteps.articleId, articleId), eq(articleSteps.stage, "topic" as Stage)));
      return;
    }

    const prompt = buildTopicAnalysisPrompt({
      title: article.title,
      note: metadata.note || metadata.description || "",
    });
    const raw = await provider.generate(prompt, {
      systemPrompt: PIPELINE_SYSTEM_PROMPT,
      temperature: 0.8,
      maxTokens: 2000,
    });
    const outputData = parseLLMJson(raw);

    await db
      .update(articleSteps)
      .set({
        output: JSON.stringify(outputData),
        status: "waiting_decision",
        completedAt: now(),
      })
      .where(and(eq(articleSteps.articleId, articleId), eq(articleSteps.stage, "topic" as Stage)));

    await db.update(articles).set({ updatedAt: now() }).where(eq(articles.id, articleId));
  } catch (error) {
    console.error("[Articles POST] 自动执行 topic 阶段失败:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    await db
      .update(articleSteps)
      .set({ status: "failed", error: errMsg })
      .where(and(eq(articleSteps.articleId, articleId), eq(articleSteps.stage, "topic" as Stage)));
    await db.update(articles).set({ updatedAt: now() }).where(eq(articles.id, articleId));
  }
}

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const stage = searchParams.get("stage");

    const conditions = [];
    if (status) conditions.push(eq(articles.status, status as "active" | "paused" | "completed" | "archived"));
    if (stage) conditions.push(eq(articles.currentStage, stage as Stage));

    let query = db.select().from(articles);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(articles.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取文章列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { title, topicId, metadata } = body;

    if (!title?.trim()) return err("文章标题不能为空");

    const now = new Date().toISOString();
    const articleId = crypto.randomUUID();

    const newArticle = {
      id: articleId,
      title: title.trim(),
      topicId: topicId || null,
      currentStage: "topic" as const,
      status: "active" as const,
      metadata: JSON.stringify(metadata || {}),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(articles).values(newArticle);

    // 自动创建全部7个stage的step记录
    const steps = ALL_STAGES.map((stage, index) => ({
      id: crypto.randomUUID(),
      articleId,
      stage,
      status: index === 0 ? ("running" as const) : ("pending" as const),
      input: "{}",
      output: "{}",
      decision: null,
      error: "",
      startedAt: index === 0 ? now : null,
      completedAt: null,
      createdAt: now,
    }));

    for (const step of steps) {
      await db.insert(articleSteps).values(step);
    }

    // 同步等待 topic 阶段执行完成（Vercel serverless 会杀掉 fire-and-forget）
    await autoRunTopicStage(articleId);

    // 重新获取更新后的 steps
    const updatedSteps = await db.select().from(articleSteps).where(eq(articleSteps.articleId, articleId));

    return ok({ ...newArticle, steps: updatedSteps });
  } catch (error) {
    return err(`创建文章失败: ${error}`, 500);
  }
}
