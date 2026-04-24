/**
 * 骨架生成 API（后台任务模式）
 * POST /api/outlines/generate
 *
 * 流程：
 * 1. 先插入 status="generating" 的记录
 * 2. 正常 await 模型生成
 * 3. 成功后更新 status="done" + result；失败则 status="error"
 * 4. 前端通过轮询 /api/outlines/status?id=xxx 获取结果
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { outlines } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";
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

    const modelName = await getCurrentModelName();

    // Step 1: 插入 generating 记录
    const id = uuid();
    await db.insert(outlines).values({
      id,
      topicId,
      analysisId: analysisId || null,
      result: "{}",
      editedResult: null,
      modelUsed: modelName,
      status: "generating",
      error: "",
      createdAt: new Date().toISOString(),
    });

    // Step 2: 正常 await 模型
    try {
      const prompt = buildOutlinePrompt({ topic, angle });
      const rawResult = await provider.generate(prompt, {
        systemPrompt: OUTLINE_SYSTEM_PROMPT,
        temperature: 0.75,
      });

      const jsonStr = extractJson(rawResult);
      const result = JSON.parse(jsonStr);

      // Step 3: 成功 → 更新 done
      await db.update(outlines).set({
        result: JSON.stringify(result),
        status: "done",
      }).where(eq(outlines.id, id));

      return ok({ id, status: "done", result });
    } catch (e) {
      // Step 3: 失败 → 更新 error
      await db.update(outlines).set({
        status: "error",
        error: String(e),
      }).where(eq(outlines.id, id));

      return ok({ id, status: "error", error: String(e) });
    }
  } catch (error) {
    return err(`骨架生成失败: ${error}`, 500);
  }
}
