/**
 * 标题生成 API
 * POST /api/titles/generate — 调用模型生成标题方案
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { titles } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { getProvider, getCurrentModelName } from "@/lib/providers";
import { buildTitlesPrompt, TITLES_SYSTEM_PROMPT } from "@/lib/prompts/titles";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { topicId, topic, angle, context, analysisId } = body;

    if (!topicId || !topic) return err("请选择一个选题");

    const provider = await getProvider();
    if (!provider) return modelError();

    // 调用模型
    const prompt = buildTitlesPrompt({ topic, angle, context });
    const rawResult = await provider.generate(prompt, {
      systemPrompt: TITLES_SYSTEM_PROMPT,
      temperature: 0.85,
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
    const newTitle = {
      id: uuid(),
      topicId,
      analysisId: analysisId || null,
      inputContext: context || "",
      result: JSON.stringify(result),
      favorites: "[]",
      modelUsed: modelName,
      createdAt: new Date().toISOString(),
    };

    await db.insert(titles).values(newTitle);
    return ok({ ...newTitle, result });
  } catch (error) {
    return err(`标题生成失败: ${error}`, 500);
  }
}
