/**
 * 素材重组建议 API
 * POST /api/materials/reorganize
 *
 * 输入：{ materialIds: string[] } 至少 2 个，至多 12 个
 * 输出：2-3 个候选文章结构方案
 *
 * 实现说明：同步等待模型返回（不走后台任务模式）—— 重组动作是一次性请求，
 * 用户在素材库点了"生成方案"会停在 dialog 里等结果，无需轮询。
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { materials } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, modelError, extractJson } from "@/lib/api-helpers";
import { inArray } from "drizzle-orm";
import { getProvider, getCurrentModelName } from "@/lib/providers";
import {
  buildReorganizePrompt,
  REORGANIZE_SYSTEM_PROMPT,
} from "@/lib/prompts/reorganize";

const MIN_MATERIALS = 2;
const MAX_MATERIALS = 12;

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { materialIds } = body as { materialIds?: string[] };

    if (!Array.isArray(materialIds) || materialIds.length < MIN_MATERIALS) {
      return err(`请至少选择 ${MIN_MATERIALS} 条素材进行重组`);
    }
    if (materialIds.length > MAX_MATERIALS) {
      return err(`一次最多选择 ${MAX_MATERIALS} 条素材`);
    }

    // 拉取素材内容（保持入参顺序）
    const rows = await db
      .select()
      .from(materials)
      .where(inArray(materials.id, materialIds));

    if (rows.length < MIN_MATERIALS) {
      return err("有效素材数量不足，请重新选择");
    }

    const ordered = materialIds
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is typeof rows[number] => Boolean(r));

    const provider = await getProvider();
    if (!provider) return modelError();

    const modelName = await getCurrentModelName();
    const prompt = buildReorganizePrompt(ordered.map((r) => r.content));
    const rawResult = await provider.generate(prompt, {
      systemPrompt: REORGANIZE_SYSTEM_PROMPT,
      temperature: 0.85,
    });

    let suggestions: unknown;
    try {
      const jsonStr = extractJson(rawResult);
      suggestions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("素材重组 JSON 解析失败", { rawResult, parseError });
      return err(`模型返回格式异常，请重试。原始输出：${rawResult.slice(0, 200)}`, 500);
    }

    return ok({
      modelUsed: modelName,
      materialIds: ordered.map((r) => r.id),
      suggestions,
    });
  } catch (error) {
    return err(`素材重组失败: ${error}`, 500);
  }
}
