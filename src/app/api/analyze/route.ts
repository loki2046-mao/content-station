/**
 * 切口分析 API
 * POST /api/analyze — 调用模型生成切口分析
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { getProvider, getCurrentModelName } from "@/lib/providers";
import { buildAnalyzePrompt, ANALYZE_SYSTEM_PROMPT } from "@/lib/prompts/analyze";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { topicId, inputText } = body;

    if (!inputText) return err("请输入要分析的话题");

    // 获取模型 provider
    const provider = await getProvider();
    if (!provider) return modelError();

    // 调用模型
    const prompt = buildAnalyzePrompt(inputText);
    const rawResult = await provider.generate(prompt, {
      systemPrompt: ANALYZE_SYSTEM_PROMPT,
      temperature: 0.8,
    });

    // 提取并解析 JSON
    const jsonStr = extractJson(rawResult);
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return err(`模型返回的结果无法解析为JSON: ${rawResult.slice(0, 500)}`, 500);
    }

    // 存入数据库
    const modelName = await getCurrentModelName();
    const newAnalysis = {
      id: uuid(),
      topicId: topicId || null,
      inputText,
      result: JSON.stringify(result),
      modelUsed: modelName,
      isFavorited: false,
      createdAt: new Date().toISOString(),
    };

    await db.insert(analyses).values(newAnalysis);
    return ok({ ...newAnalysis, result });
  } catch (error) {
    return err(`切口分析失败: ${error}`, 500);
  }
}
