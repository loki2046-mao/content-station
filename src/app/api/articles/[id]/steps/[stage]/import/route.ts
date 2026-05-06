/**
 * 把"工具箱"产物（已有的 outline / titles 记录）一键导入到 Pipeline step 里。
 * POST /api/articles/:id/steps/:stage/import
 * body: { sourceType: "outline" | "title", sourceId: "..." }
 *
 * 设计：
 *   - skeleton 阶段：接受 outline 记录 → 把 outline.result 转成 step output schema
 *   - cover 阶段：接受 titles 记录 → 把 titles.result 转成 titleOptions
 *   - 其他阶段当前不支持导入，返回 400
 *
 * 写入后 step.status 置为 waiting_decision，用户可在 UI 上审阅并直接进入下一步。
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articles, articleSteps, outlines, titles } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, safeParseJson } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string; stage: string }> };

const SUPPORTED_STAGES = new Set(["skeleton", "cover"]);

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  const { id, stage } = await params;
  if (!SUPPORTED_STAGES.has(stage)) {
    return err(`stage ${stage} 当前不支持导入；支持的阶段：${[...SUPPORTED_STAGES].join(", ")}`);
  }

  try {
    const body = await request.json();
    const { sourceType, sourceId } = body as { sourceType?: string; sourceId?: string };
    if (!sourceType || !sourceId) return err("sourceType / sourceId 不能为空");

    // 验证文章存在
    const articleRows = await db.select().from(articles).where(eq(articles.id, id));
    if (!articleRows.length) return err("文章不存在", 404);

    let outputData: Record<string, unknown> | null = null;
    let summary = "";

    // ============ skeleton 阶段：导入 outline 记录 ============
    if (stage === "skeleton") {
      if (sourceType !== "outline") {
        return err("skeleton 阶段只能导入 outline 记录");
      }
      const rows = await db.select().from(outlines).where(eq(outlines.id, sourceId));
      if (!rows.length) return err("outline 记录不存在", 404);
      const outline = rows[0];
      const result = safeParseJson<Record<string, unknown>>(outline.result, {});
      const editedResult = outline.editedResult
        ? safeParseJson<Record<string, unknown>>(outline.editedResult, {})
        : null;
      const finalResult = editedResult && Object.keys(editedResult).length > 0 ? editedResult : result;

      // outline.result schema: { coreTension, sections: [{title, contentType, hookExamples?, suggestions?}], opening, closing, ... }
      // skeleton output schema: { sections: [{title, keyPoints, estimatedWords}], writingTip }
      const rawSections = Array.isArray(finalResult?.sections) ? (finalResult.sections as Record<string, unknown>[]) : [];
      const mappedSections = rawSections.map((s) => {
        const title = (s.title as string) || "";
        const keyPoints: string[] = [];
        if (s.contentType) keyPoints.push(`内容类型：${s.contentType as string}`);
        if (Array.isArray(s.hookExamples)) keyPoints.push(...(s.hookExamples as string[]));
        if (Array.isArray(s.suggestions)) keyPoints.push(...(s.suggestions as string[]));
        if (s.points && Array.isArray(s.points)) keyPoints.push(...(s.points as string[]));
        return {
          title,
          keyPoints: keyPoints.length ? keyPoints : ["—"],
          estimatedWords: typeof s.estimatedWords === "number" ? s.estimatedWords : 400,
        };
      });

      const writingTipParts: string[] = [];
      if (finalResult?.coreTension) writingTipParts.push(`核心矛盾：${finalResult.coreTension}`);
      if (finalResult?.opening) writingTipParts.push(`开头建议：${finalResult.opening}`);
      if (finalResult?.closing) writingTipParts.push(`结尾建议：${finalResult.closing}`);

      outputData = {
        sections: mappedSections,
        writingTip: writingTipParts.join("\n"),
        importedFrom: { sourceType: "outline", sourceId },
      };
      summary = `已从 outline 导入：${mappedSections.length} 个章节`;
    }

    // ============ cover 阶段：导入 titles 记录 ============
    if (stage === "cover") {
      if (sourceType !== "title") {
        return err("cover 阶段只能导入 title 记录");
      }
      const rows = await db.select().from(titles).where(eq(titles.id, sourceId));
      if (!rows.length) return err("titles 记录不存在", 404);
      const titleRow = rows[0];
      const result = safeParseJson<unknown>(titleRow.result, []);
      const arr = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];

      // titles.result: [{mainTitle, subtitle, coverText, shareText, style}]
      // cover output: { titleOptions: [{title, reason}] }
      const titleOptions = arr.map((t) => {
        const reasonParts: string[] = [];
        if (t.style) reasonParts.push(`风格：${t.style}`);
        if (t.subtitle) reasonParts.push(t.subtitle as string);
        if (t.coverText) reasonParts.push(`封面大字：${t.coverText}`);
        if (t.shareText) reasonParts.push(`朋友圈：${t.shareText}`);
        return {
          title: (t.mainTitle as string) || (t.title as string) || "",
          reason: reasonParts.join(" · "),
        };
      });

      outputData = {
        titleOptions,
        importedFrom: { sourceType: "title", sourceId },
      };
      summary = `已从 titles 导入：${titleOptions.length} 个标题方案`;
    }

    if (!outputData) return err("无法构造导入数据", 500);

    // 写回 articleSteps：status=waiting_decision
    const now = new Date().toISOString();
    const existingStep = await db
      .select()
      .from(articleSteps)
      .where(and(eq(articleSteps.articleId, id), eq(articleSteps.stage, stage as "skeleton" | "cover")));

    if (existingStep.length === 0) {
      // step 还没建过，先 insert
      const { v4 } = await import("uuid");
      await db.insert(articleSteps).values({
        id: v4(),
        articleId: id,
        stage: stage as "skeleton" | "cover",
        status: "waiting_decision",
        output: JSON.stringify(outputData),
        startedAt: now,
        completedAt: now,
        createdAt: now,
      });
    } else {
      await db
        .update(articleSteps)
        .set({
          status: "waiting_decision",
          output: JSON.stringify(outputData),
          completedAt: now,
          error: "",
        })
        .where(and(eq(articleSteps.articleId, id), eq(articleSteps.stage, stage as "skeleton" | "cover")));
    }

    // 更新文章 updatedAt
    await db.update(articles).set({ updatedAt: now }).where(eq(articles.id, id));

    return ok({ stage, status: "waiting_decision", summary, output: outputData });
  } catch (error) {
    return err(`导入失败: ${error}`, 500);
  }
}
