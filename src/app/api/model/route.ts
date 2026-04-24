/**
 * 当前模型配置状态
 * GET /api/model — 返回是否已配置 provider、当前使用的模型名
 */
import { ensureDbInit } from "@/lib/db/ensure-init";
import { getModelConfig } from "@/lib/providers";
import { ok, dbError } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";

export async function GET() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  const config = await getModelConfig();

  if (!config) {
    return ok({ configured: false, model: null, provider: null });
  }

  return ok({
    configured: true,
    model: config.model,
    provider: config.provider,
  });
}
