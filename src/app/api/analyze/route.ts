/**
 * 切口分析 API（后台任务模式）
 * POST /api/analyze
 *
 * 流程：
 * 1. 先插入 status="generating" 的记录到数据库
 * 2. 正常 await 模型生成（Vercel function 即使客户端断开也会执行到完成）
 * 3. 成功后更新 status="done" + result；失败则 status="error"
 * 4. 前端发出 fetch 后不等 response，而是通过轮询 /api/analyze/status?id=xxx 获取结果
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { analyses, topics } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";
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

    // 获取模型 provider（提前检查，避免插入无效记录）
    const provider = await getProvider();
    if (!provider) return modelError();

    const modelName = await getCurrentModelName();

    // Step 1: 插入 generating 记录
    const id = uuid();
    await db.insert(analyses).values({
      id,
      topicId: topicId || null,
      inputText,
      result: "[]",
      modelUsed: modelName,
      isFavorited: false,
      status: "generating",
      error: "",
      createdAt: new Date().toISOString(),
    });

    // Step 2: 正常 await 模型（函数会执行到完成，即使客户端断开）
    try {
      const prompt = buildAnalyzePrompt(inputText);
      const rawResult = await provider.generate(prompt, {
        systemPrompt: ANALYZE_SYSTEM_PROMPT,
        temperature: 0.8,
      });

      const jsonStr = extractJson(rawResult);
      const result = JSON.parse(jsonStr);

      // Step 3: 成功 → 更新 done
      await db.update(analyses).set({
        result: JSON.stringify(result),
        status: "done",
      }).where(eq(analyses.id, id));

      // 自动更新关联选题状态为 "analyzed"
      if (topicId) {
        const rows = await db.select().from(topics).where(eq(topics.id, topicId));
        if (rows.length > 0 && rows[0].status === "unprocessed") {
          await db.update(topics).set({
            status: "analyzed",
            updatedAt: new Date().toISOString(),
          }).where(eq(topics.id, topicId));
        }
      }

      return ok({ id, status: "done", result });
    } catch (e) {
      // Step 3: 失败 → 更新 error
      await db.update(analyses).set({
        status: "error",
        error: String(e),
      }).where(eq(analyses.id, id));

      return ok({ id, status: "error", error: String(e) });
    }
  } catch (error) {
    return err(`切口分析失败: ${error}`, 500);
  }
}
