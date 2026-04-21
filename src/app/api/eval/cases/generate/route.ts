/**
 * AI 生成测试 Case
 * POST /api/eval/cases/generate
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalCases } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { getProvider } from "@/lib/providers";

const CASE_SYSTEM_PROMPT = `你是一位专业的 AI 产品测评专家。根据测评目标、模型类型和测评维度，生成若干具体的测试 Case。
每个 Case 包含：title（测试标题）、description（具体测试任务，描述清晰、可直接执行）、difficulty（easy/medium/hard）。
输出 JSON 数组格式。`;

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId, goalType, modelType, dimensions, count = 5 } = body;

    if (!projectId) return err("项目 ID 不能为空");

    const provider = await getProvider();
    if (!provider) return modelError();

    const userPrompt = `测评目标：${goalType || "综合测评"}
模型类型：${modelType || "text"}
测评维度：${Array.isArray(dimensions) ? dimensions.join("、") : (dimensions || "综合")}
请生成 ${count} 个测试 Case，以 JSON 数组格式输出。`;

    const rawResult = await provider.generate(userPrompt, {
      systemPrompt: CASE_SYSTEM_PROMPT,
      temperature: 0.8,
    });

    const jsonStr = extractJson(rawResult);
    let result: Array<{ title: string; description: string; difficulty: string }>;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return err(`模型返回结果解析失败: ${rawResult.slice(0, 500)}`, 500);
    }

    if (!Array.isArray(result)) return err("模型返回格式错误，期望数组", 500);

    const now = new Date().toISOString();
    const newCases = result.map((c) => ({
      id: uuid(),
      projectId,
      dimensionId: "",
      title: c.title || "未命名 Case",
      description: c.description || "",
      difficulty: (["easy", "medium", "hard"].includes(c.difficulty) ? c.difficulty : "medium") as "easy" | "medium" | "hard",
      status: "draft" as const,
      createdAt: now,
    }));

    for (const newCase of newCases) {
      await db.insert(evalCases).values(newCase);
    }

    return ok(newCases);
  } catch (error) {
    return err(`生成 Case 失败: ${error}`, 500);
  }
}
