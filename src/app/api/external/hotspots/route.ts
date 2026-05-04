/**
 * 外部热点触发 API
 * POST /api/external/hotspots
 *
 * 认证：Authorization: Bearer sk-station-xxx
 *
 * 请求体：
 *   { "autoFetch": true } 或 { "action": "fetch" } — 按 Cola 选题来源立即抓取
 *   { "items": [...] } — 外部推送热点，走同一套清洗、去重和空标题过滤
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { validateApiKey } from "@/app/api/settings/api-key/route";
import { saveHotspots } from "@/lib/hotspots/store";

async function authenticate(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;
  return validateApiKey(token);
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  if (!(await authenticate(request))) {
    return err("未授权：API Key 无效或未设置", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return err("请求体必须是合法的 JSON", 400);
  }

  try {
    const result = await saveHotspots(db, {
      ...body,
      autoFetch: body.autoFetch === true || body.action === "fetch",
    });

    if (result.total === 0) {
      return err("没有要写入的热点数据。传入 items 数组，或设置 autoFetch: true / action: fetch", 400);
    }

    return ok(result);
  } catch (error) {
    return err(`写入热点失败: ${error}`, 500);
  }
}
