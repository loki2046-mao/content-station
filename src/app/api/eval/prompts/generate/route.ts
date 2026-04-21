/**
 * AI 生成 Prompt
 * POST /api/eval/prompts/generate
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalCases, evalPrompts } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { getProvider } from "@/lib/providers";
import { eq } from "drizzle-orm";

const PROMPT_SYSTEM_PROMPT = `你是一位专业的 AI 测评工程师。根据测试 Case，为指定目标模型生成适配的测试 Prompt。
Prompt 要具体、可执行，针对该模型的特点优化表达。
输出包含：content（完整 prompt 文本）、model_target、difficulty。
输出 JSON 对象格式。`;

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { caseId, modelTarget } = body;

    if (!caseId) return err("Case ID 不能为空");

    // 获取 Case 信息
    const caseRows = await db
      .select()
      .from(evalCases)
      .where(eq(evalCases.id, caseId))
      .limit(1);

    if (!caseRows.length) return err("Case 不存在", 404);
    const evalCase = caseRows[0];

    const provider = await getProvider();
    if (!provider) return modelError();

    const userPrompt = `测试 Case 标题：${evalCase.title}
测试任务描述：${evalCase.description}
难度：${evalCase.difficulty}
目标模型：${modelTarget || "通用"}
请生成适配该 Case 的测试 Prompt，以 JSON 对象格式输出。`;

    const rawResult = await provider.generate(userPrompt, {
      systemPrompt: PROMPT_SYSTEM_PROMPT,
      temperature: 0.75,
    });

    const jsonStr = extractJson(rawResult);
    let result: { content: string; model_target: string; difficulty: string };
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return err(`模型返回结果解析失败: ${rawResult.slice(0, 500)}`, 500);
    }

    const newPrompt = {
      id: uuid(),
      caseId,
      modelTarget: result.model_target || modelTarget || "",
      content: result.content || rawResult,
      difficulty: result.difficulty || evalCase.difficulty,
      isSaved: 0,
      createdAt: new Date().toISOString(),
    };

    await db.insert(evalPrompts).values(newPrompt);
    return ok(newPrompt);
  } catch (error) {
    return err(`生成 Prompt 失败: ${error}`, 500);
  }
}
