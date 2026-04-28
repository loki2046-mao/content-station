/**
 * Pipeline 执行引擎
 * 抽取自 src/app/api/articles/[id]/execute/route.ts
 * 供内部 API 和外部 API 共同复用
 */
import { getDb } from "@/lib/db";
import { articles, articleSteps, materials } from "@/lib/db/schema";
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

export const STAGE_ORDER = [
  "topic",
  "material",
  "skeleton",
  "draft",
  "layout",
  "cover",
  "ready",
] as const;
export type Stage = (typeof STAGE_ORDER)[number];

/** 安全解析 JSON 字符串 */
export function safeJson<T = Record<string, unknown>>(
  str: string | null | undefined
): T | null {
  if (!str || str === "{}" || str === "null") return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/** 获取某个阶段的 step */
export async function getStep(
  db: ReturnType<typeof getDb>,
  articleId: string,
  stage: string
) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(articleSteps)
    .where(
      and(
        eq(articleSteps.articleId, articleId),
        eq(articleSteps.stage, stage as Stage)
      )
    );
  return rows[0] || null;
}

/** 更新 step 字段 */
export async function updateStep(
  db: ReturnType<typeof getDb>,
  articleId: string,
  stage: string,
  updates: Record<string, unknown>
) {
  if (!db) return;
  await db
    .update(articleSteps)
    .set(updates)
    .where(
      and(
        eq(articleSteps.articleId, articleId),
        eq(articleSteps.stage, stage as Stage)
      )
    );
}

/** 核心执行逻辑，同步等待完成 */
export async function runStageExecution(articleId: string, stage: Stage) {
  const db = getDb();
  if (!db) return;

  const now = () => new Date().toISOString();

  try {
    // 获取文章信息
    const articleRows = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));
    if (!articleRows.length) throw new Error("文章不存在");
    const article = articleRows[0];
    const metadata =
      safeJson<Record<string, string>>(article.metadata) || {};
    const articleTitle = article.title;

    const provider = await getProvider();
    if (!provider)
      throw new Error("AI 模型未配置，请先在设置页面配置 API Key");

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
      const topicStep = await getStep(db, articleId, "topic");
      let angle = topicStep?.decision || "";

      if (!angle) {
        const topicOutput = safeJson<{
          angles: Array<{ name: string; description: string }>;
        }>(topicStep?.output);
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      const titleWords = articleTitle
        .split(/[\s，,。、]+/)
        .filter(Boolean)
        .slice(0, 3);
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
        const topicOutput = safeJson<{
          angles: Array<{ name: string; description: string }>;
        }>(topicStep?.output);
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
        const topicOutput = safeJson<{
          angles: Array<{ name: string; description: string }>;
        }>(topicStep?.output);
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      let skeletonText = skeletonStep?.decision || "";
      if (!skeletonText) {
        const skeletonOutput = safeJson<{
          sections: Array<{
            title: string;
            keyPoints: string[];
            estimatedWords: number;
          }>;
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
        wordCount:
          parsed.wordCount || (parsed.content || raw).length,
      };
    }

    // ─── layout 阶段 ──────────────────────────────────────
    else if (stage === "layout") {
      const draftStep = await getStep(db, articleId, "draft");
      const draftOutput = safeJson<{ content: string; wordCount: number }>(
        draftStep?.output
      );
      const content = draftStep?.decision || draftOutput?.content || "";
      const wordCount = draftOutput?.wordCount || content.length;

      outputData = {
        content,
        wordCount,
        layoutNote:
          "排版需要在排版编辑器中完成。请复制上方内容，前往 wechat-layout.hiloki.ai 进行排版。",
        layoutUrl: "https://wechat-layout.hiloki.ai",
      };
    }

    // ─── cover 阶段 ───────────────────────────────────────
    else if (stage === "cover") {
      const topicStep = await getStep(db, articleId, "topic");
      const draftStep = await getStep(db, articleId, "draft");

      let angle = topicStep?.decision || "";
      if (!angle) {
        const topicOutput = safeJson<{
          angles: Array<{ name: string; description: string }>;
        }>(topicStep?.output);
        if (topicOutput?.angles?.length) {
          const first = topicOutput.angles[0];
          angle = `${first.name}：${first.description}`;
        }
      }

      const draftOutput = safeJson<{ content: string }>(draftStep?.output);
      const draftContent =
        draftStep?.decision || draftOutput?.content || "";
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
      const draftOutput = safeJson<{ content: string; wordCount: number }>(
        draftStep?.output
      );
      const coverOutput = safeJson<{
        titleOptions: unknown[];
        visualDescription: string;
      }>(coverStep?.output);

      outputData = {
        summary: "文章已完成全部制作流程，准备发布",
        finalTitle: articleTitle,
        wordCount: draftOutput?.wordCount || 0,
        hasDraft: !!draftOutput?.content,
        hasCover: !!coverOutput?.titleOptions?.length,
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

    return outputData;
  } catch (error) {
    console.error(
      `[Pipeline Execute] stage=${stage} articleId=${articleId}`,
      error
    );
    const errMsg =
      error instanceof Error ? error.message : String(error);
    await updateStep(db, articleId, stage, {
      status: "failed",
      error: errMsg,
    });
    await db
      .update(articles)
      .set({ updatedAt: now() })
      .where(eq(articles.id, articleId));
    throw error;
  }
}
