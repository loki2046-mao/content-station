/**
 * 骨架生成 API
 * POST /api/outlines/generate — 调用模型生成文章骨架
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { outlines } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { getProvider, getCurrentModelName } from "@/lib/providers";
import { buildOutlinePrompt, OUTLINE_SYSTEM_PROMPT } from "@/lib/prompts/outline";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { topicId, topic, angle, analysisId } = body;

    if (!topicId || !topic) return err("请选择一个选题");

    const provider = await getProvider();
    if (!provider) return modelError();

    const prompt = buildOutlinePrompt({ topic, angle });
    const rawResult = await provider.generate(prompt, {
      systemPrompt: OUTLINE_SYSTEM_PROMPT,
      temperature: 0.75,
    });

    const jsonStr = extractJson(rawResult);
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      return err(`模型返回的结果无法解析为JSON: ${rawResult.slice(0, 500)}`, 500);
    }

    const modelName = await getCurrentModelName();
    const newOutline = {
      id: uuid(),
      topicId,
      analysisId: analysisId || null,
      result: JSON.stringify(result),
      editedResult: null,
      modelUsed: modelName,
      createdAt: new Date().toISOString(),
    };

    await db.insert(outlines).values(newOutline);
    return ok({ ...newOutline, result });
  } catch (error) {
    return err(`骨架生成失败: ${error}`, 500);
  }
}
