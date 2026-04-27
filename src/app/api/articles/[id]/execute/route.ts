/**
 * Pipeline 阶段执行 API
 * POST /api/articles/:id/execute
 * body: { stage: string }
 *
 * 后台任务模式：
 * 1. 立即把 step.status = "running"
 * 2. 返回 { status: "running" }
 * 3. 异步调 LLM → 写 output → status = "waiting_decision"
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps, materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and, or, like } from "drizzle-orm";
import { getProvider } from "@/lib/providers";
import {
  PIPELINE_SYSTEM_PROMPT,
  buildTopicAnalysisPrompt,
  buildMaterialSuggestionPrompt,
  buildSkeletonPrompt,
  buildDraftWritingPrompt,
  buildCoverDesignPrompt,
  parseLLMJson,
} from "@/lib/prompts/pipeline";

type RouteParams = { params: Promise<{ id: string }> };

const STAGE_ORDER = ["topic", "material", "skeleton", "draft", "layout", "cover", "ready"] as const;
type Stage = (typeof STAGE_ORDER)[number];

/** 安全解析 JSON 字符串 */
function safeJson<T = Record<string, unknown>>(str: string | null | undefined): T | null {
  if (!str || str === "{}" || str === "null") return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

/** 获取某个阶段的 step */
async function getStep(db: ReturnType<typeof getDb>, articleId: string, stage: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(articleSteps)
    .where(and(eq(articleSteps.articleId, articleId), eq(articleSteps.stage, stage as Stage)));
  return rows[0] || null;
}

/** 更新 step 字段 */
async function updateStep(
  db: ReturnType<typeof getDb>,
  articleId: string,
  stage: string,
  updates: Record<string, unknown>
) {
  if (!db) return;
  await db
    .update(articleSteps)
    .set(updates)
    .where(and(eq(articleSteps.articleId, articleId), eq(articleSteps.stage, stage as Stage)));
}

/** 核心执行逻辑，在后台异步运行 */
async function runStageExecution(articleId: string, stage: Stage) {
  const db = getDb();
  if (!db) return;

  const now = () => new Date().toISOString();

  try {
    // 获取文章信息
    const articleRows = await db.select().from(articles).where(eq(articles.id, articleId));
    if (!articleRows.length) throw new Error("文章不存在");
    const article = articleRows[0];
    const metadata = safeJson<Record<string, string>>(article.metadata) || {};
    const articleTitle = article.title;

    const provider = await getProvider();
    if (!provider) throw new Error("AI 模型未配置，请先在设置页面配置 API Key");

    let outputData: unknown = {};

    // ─── topic 阶段 ───────────────────────────────────────
    if (stage === "topic") {
      const prompt = buildTopicAnalysisPrompt({
        title: articleTitle,
        note: metadata.note || metadata.description || "",
      });
      const raw = await provider.generate(prompt, {
        systemPrompt: PIPELINE_SYSTEM_PROMPT,
        temperature: 0.8,
        maxTokens: 2000,
      });
      outputData = parseLLMJson(raw);
    }

    // ─── material 阶段 ────────────────────────────────────
    else if (stage === "material") {
      // 获取 topic 阶段的决策（用户选的角度）
      const topicStep = await getStep(db, articleId, "topic");
      let angle = topicStep?.decision || "";

      // 如果没有用户决策，取 output 的第一个角度
      if (!angle) {
        const topicOutput = safeJson<{ angles: Array<{ name: string; description: string }> }>(
          topicStep?.output
        );
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      // 从素材库模糊搜索相关素材（取前10条）
      const titleWords = articleTitle.split(/[\s，,。、]+/).filter(Boolean).slice(0, 3);
      const matchedMaterials: typeof materials.$inferSelect[] = [];

      for (const word of titleWords) {
        if (word.length < 2) continue;
        const rows = await db
          .select()
          .from(materials)
          .where(
            or(
              like(materials.content, `%${word}%`),
              like(materials.tags, `%${word}%`)
            )
          )
          .limit(5);
        for (const r of rows) {
          if (!matchedMaterials.find((m) => m.id === r.id)) {
            matchedMaterials.push(r);
          }
        }
      }

      const existingMaterials = matchedMaterials.slice(0, 10).map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        tags: m.tags || "[]",
      }));

      const prompt = buildMaterialSuggestionPrompt({
        title: articleTitle,
        angle: angle || articleTitle,
        existingMaterials,
      });
      const raw = await provider.generate(prompt, {
        systemPrompt: PIPELINE_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 2000,
      });
      const parsed = parseLLMJson<{
        usefulMaterials: unknown[];
        suggestions: unknown[];
        summary: string;
      }>(raw);
      outputData = {
        ...parsed,
        existingMaterials: existingMaterials.map((m) => ({
          id: m.id,
          content: m.content.slice(0, 100),
          type: m.type,
        })),
      };
    }

    // ─── skeleton 阶段 ────────────────────────────────────
    else if (stage === "skeleton") {
      const topicStep = await getStep(db, articleId, "topic");
      const materialStep = await getStep(db, articleId, "material");

      let angle = topicStep?.decision || "";
      if (!angle) {
        const topicOutput = safeJson<{ angles: Array<{ name: string; description: string }> }>(
          topicStep?.output
        );
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      let materialSummary = materialStep?.decision || "";
      if (!materialSummary) {
        const matOutput = safeJson<{ summary: string }>(materialStep?.output);
        materialSummary = matOutput?.summary || "";
      }

      const prompt = buildSkeletonPrompt({
        title: articleTitle,
        angle: angle || articleTitle,
        materialSummary,
      });
      const raw = await provider.generate(prompt, {
        systemPrompt: PIPELINE_SYSTEM_PROMPT,
        temperature: 0.8,
        maxTokens: 3000,
      });
      outputData = parseLLMJson(raw);
    }

    // ─── draft 阶段 ───────────────────────────────────────
    else if (stage === "draft") {
      const topicStep = await getStep(db, articleId, "topic");
      const materialStep = await getStep(db, articleId, "material");
      const skeletonStep = await getStep(db, articleId, "skeleton");

      let angle = topicStep?.decision || "";
      if (!angle) {
        const topicOutput = safeJson<{ angles: Array<{ name: string; description: string }> }>(
          topicStep?.output
        );
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      // 骨架：优先用用户决策，否则用生成的
      let skeletonText = skeletonStep?.decision || "";
      if (!skeletonText) {
        const skeletonOutput = safeJson<{
          sections: Array<{ title: string; keyPoints: string[]; estimatedWords: number }>;
          writingTip: string;
        }>(skeletonStep?.output);
        if (skeletonOutput?.sections) {
          skeletonText = skeletonOutput.sections
            .map(
              (s) =>
                `## ${s.title}\n关键点：${s.keyPoints.join("；")}\n预估字数：${s.estimatedWords}`
            )
            .join("\n\n");
          if (skeletonOutput.writingTip) {
            skeletonText += `\n\n写作提示：${skeletonOutput.writingTip}`;
          }
        }
      }

      let materialSummary = materialStep?.decision || "";
      if (!materialSummary) {
        const matOutput = safeJson<{ summary: string }>(materialStep?.output);
        materialSummary = matOutput?.summary || "";
      }

      const prompt = buildDraftWritingPrompt({
        title: articleTitle,
        angle: angle || articleTitle,
        skeleton: skeletonText || "按照正常公众号文章结构写",
        materialSummary,
      });
      const raw = await provider.generate(prompt, {
        systemPrompt: PIPELINE_SYSTEM_PROMPT,
        temperature: 0.85,
        maxTokens: 6000,
      });
      const parsed = parseLLMJson<{ content: string; wordCount: number }>(raw);
      outputData = {
        content: parsed.content || raw,
        wordCount: parsed.wordCount || (parsed.content || raw).length,
      };
    }

    // ─── layout 阶段 ──────────────────────────────────────
    else if (stage === "layout") {
      const draftStep = await getStep(db, articleId, "draft");
      const draftOutput = safeJson<{ content: string; wordCount: number }>(draftStep?.output);
      const content = draftStep?.decision || draftOutput?.content || "";
      const wordCount = draftOutput?.wordCount || content.length;

      outputData = {
        content,
        wordCount,
        layoutNote: "排版需要在排版编辑器中完成。请复制上方内容，前往 wechat-layout.hiloki.ai 进行排版。",
        layoutUrl: "https://wechat-layout.hiloki.ai",
      };
    }

    // ─── cover 阶段 ───────────────────────────────────────
    else if (stage === "cover") {
      const topicStep = await getStep(db, articleId, "topic");
      const draftStep = await getStep(db, articleId, "draft");

      let angle = topicStep?.decision || "";
      if (!angle) {
        const topicOutput = safeJson<{ angles: Array<{ name: string; description: string }> }>(
          topicStep?.output
        );
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      const draftOutput = safeJson<{ content: string }>(draftStep?.output);
      const draftContent = draftStep?.decision || draftOutput?.content || "";
      // 取前500字作为摘要
      const draftSummary = draftContent.slice(0, 500);

      const prompt = buildCoverDesignPrompt({
        title: articleTitle,
        angle: angle || articleTitle,
        draftSummary,
      });
      const raw = await provider.generate(prompt, {
        systemPrompt: PIPELINE_SYSTEM_PROMPT,
        temperature: 0.8,
        maxTokens: 2000,
      });
      outputData = parseLLMJson(raw);
    }

    // ─── ready 阶段 ───────────────────────────────────────
    else if (stage === "ready") {
      const draftStep = await getStep(db, articleId, "draft");
      const coverStep = await getStep(db, articleId, "cover");
      const draftOutput = safeJson<{ content: string; wordCount: number }>(draftStep?.output);
      const coverOutput = safeJson<{ titleOptions: unknown[]; visualDescription: string }>(
        coverStep?.output
      );

      outputData = {
        summary: "文章已完成全部制作流程，准备发布",
        finalTitle: articleTitle,
        wordCount: draftOutput?.wordCount || 0,
        hasDraft: !!draftOutput?.content,
        hasCover: !!(coverOutput?.titleOptions?.length),
        readyToPublish: true,
      };
    }

    // 写结果
    await updateStep(db, articleId, stage, {
      output: JSON.stringify(outputData),
      status: "waiting_decision",
      completedAt: now(),
    });

    // 更新 article updatedAt
    await db
      .update(articles)
      .set({ updatedAt: now() })
      .where(eq(articles.id, articleId));
  } catch (error) {
    console.error(`[Pipeline Execute] stage=${stage} articleId=${articleId}`, error);
    const errMsg = error instanceof Error ? error.message : String(error);
    await updateStep(db, articleId, stage, {
      status: "failed",
      error: errMsg,
    });
    await db
      .update(articles)
      .set({ updatedAt: now() })
      .where(eq(articles.id, articleId));
  }
}

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
    const articleRows = await db.select().from(articles).where(eq(articles.id, id));
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
