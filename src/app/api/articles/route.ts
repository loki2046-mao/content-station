/**
 * 文章列表 API
 * GET  /api/articles — 获取文章列表，支持 ?status=&stage= 筛选
 * POST /api/articles — 创建新文章，自动创建全部7个stage的step记录
 *                      注意：不再自动调LLM，由前端浏览器直接调用阿里API
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq, and } from "drizzle-orm";

const ALL_STAGES = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
type Stage = (typeof ALL_STAGES)[number];

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
    // topic step 设为 running（前端收到响应后立即发起LLM调用）
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

    // 不再服务端调LLM，由前端浏览器直接调用阿里API
    // 重新获取 steps
    const updatedSteps = await db.select().from(articleSteps).where(eq(articleSteps.articleId, articleId));

    return ok({ ...newArticle, steps: updatedSteps });
  } catch (error) {
    return err(`创建文章失败: ${error}`, 500);
  }
}
