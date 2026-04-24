/**
 * 将测试结果一键转为内容素材
 * POST /api/eval/convert-to-material
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import {
  evalTestResults,
  evalCases,
  evalProjects,
  contentMaterials,
} from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, extractJson } from "@/lib/api-helpers";
import { getProvider } from "@/lib/providers";
import { eq } from "drizzle-orm";

const AI_TITLE_PROMPT = `你是一位资深公众号编辑，擅长从 AI 测评结论中提炼爆款标题方向。

请根据以下测评信息，生成 3 个适合公众号的标题方向。
要求：
- 面向普通读者，简洁有力，能激发点击欲
- 可以用疑问句、对比句、结论句等多种句式
- 不要太技术化，要贴近读者痛点或好奇心
- 直接输出 JSON 数组，元素为字符串

示例格式：["标题方向1", "标题方向2", "标题方向3"]`;

const AI_ANGLE_PROMPT = `你是一位公众号内容策划，擅长从 AI 测评结果中找到有价值的写作角度。

请根据以下测评信息，给出 3 个适合写成公众号文章的写作角度。
要求：
- 每个角度1-2句话，说明这篇文章想讲什么、为什么值得写
- 角度要差异化，覆盖不同读者需求（如：科普/对比/教程/观点/避坑）
- 直接输出 JSON 数组，元素为字符串

示例格式：["角度1描述", "角度2描述", "角度3描述"]`;

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { resultId } = body;

    if (!resultId) return err("resultId 不能为空");

    // 查询 test_result
    const resultRows = await db
      .select()
      .from(evalTestResults)
      .where(eq(evalTestResults.id, resultId))
      .limit(1);

    if (!resultRows.length) return err("测试记录不存在", 404);
    const result = resultRows[0];

    // 检查是否已经转过
    const existingMaterial = await db
      .select()
      .from(contentMaterials)
      .where(eq(contentMaterials.sourceId, resultId))
      .limit(1);

    if (existingMaterial.length > 0) {
      return ok({ materialId: existingMaterial[0].id, alreadyExists: true });
    }

    // 查询关联 Case
    const caseRows = await db
      .select()
      .from(evalCases)
      .where(eq(evalCases.id, result.caseId))
      .limit(1);
    const evalCase = caseRows[0] || null;

    // 查询关联 Project
    let project = null;
    if (evalCase?.projectId) {
      const projectRows = await db
        .select()
        .from(evalProjects)
        .where(eq(evalProjects.id, evalCase.projectId))
        .limit(1);
      project = projectRows[0] || null;
    }

    // 构建上下文摘要
    const contextSummary = [
      project ? `测评项目：${project.name}` : "",
      project?.goalType ? `测评目标：${project.goalType}` : "",
      evalCase ? `测试任务：${evalCase.title}` : "",
      evalCase?.description ? `任务描述：${evalCase.description}` : "",
      result.modelUsed ? `测试模型：${result.modelUsed}` : "",
      result.rating ? `测评结果：${result.rating}` : "",
      result.highlights ? `亮点：${result.highlights}` : "",
      result.issues ? `问题：${result.issues}` : "",
      result.extractableInsight ? `可提炼观点：${result.extractableInsight}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // AI 生成 title_directions 和 article_angles（provider 未配置也不阻断）
    let titleDirections: string[] = [];
    let articleAngles: string[] = [];

    const provider = await getProvider();
    if (provider) {
      try {
        const [titleRaw, angleRaw] = await Promise.all([
          provider.generate(contextSummary, {
            systemPrompt: AI_TITLE_PROMPT,
            temperature: 0.85,
          }),
          provider.generate(contextSummary, {
            systemPrompt: AI_ANGLE_PROMPT,
            temperature: 0.85,
          }),
        ]);

        try {
          titleDirections = JSON.parse(extractJson(titleRaw));
        } catch {
          console.warn("[convert-to-material] 标题方向解析失败:", titleRaw.slice(0, 200));
        }

        try {
          articleAngles = JSON.parse(extractJson(angleRaw));
        } catch {
          console.warn("[convert-to-material] 写作角度解析失败:", angleRaw.slice(0, 200));
        }
      } catch (aiError) {
        console.warn("[convert-to-material] AI 生成失败，跳过:", aiError);
      }
    }

    // 写入 content_materials
    const now = new Date().toISOString();
    const newMaterial = {
      id: uuid(),
      sourceType: "eval_result" as const,
      sourceId: resultId,
      testSubject: result.modelUsed || "",
      evalGoal: project?.goalType || "",
      evalDimension: evalCase?.dimensionId || "",
      taskDescription: evalCase ? `${evalCase.title}${evalCase.description ? "：" + evalCase.description : ""}` : "",
      resultSummary: result.rating || "",
      highlights: result.highlights || "",
      issues: result.issues || "",
      extractableInsight: result.extractableInsight || "",
      titleDirections: JSON.stringify(titleDirections),
      articleAngles: JSON.stringify(articleAngles),
      createdAt: now,
    };

    await db.insert(contentMaterials).values(newMaterial);

    return ok({ materialId: newMaterial.id, alreadyExists: false, titleDirections, articleAngles });
  } catch (error) {
    return err(`转换素材失败: ${error}`, 500);
  }
}
