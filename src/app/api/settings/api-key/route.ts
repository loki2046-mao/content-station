/**
 * API Key 管理路由
 * POST   /api/settings/api-key — 生成新 API Key
 * DELETE /api/settings/api-key — 撤销 API Key
 * GET    /api/settings/api-key — 获取当前 API Key（脱敏）
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

const API_KEY_SETTING = "station_api_key";

/** 生成随机 32 字符 hex，前缀 sk-station- */
function generateApiKey(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk-station-${hex}`;
}

/** 读取当前存储的 API Key（原始值） */
async function getStoredKey(): Promise<string | null> {
  await ensureDbInit();
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, API_KEY_SETTING));
  if (!rows.length) return null;
  try {
    const val = JSON.parse(rows[0].value || "null");
    return val || null;
  } catch {
    return null;
  }
}

/** 写入 API Key（null = 撤销） */
async function setStoredKey(key: string | null): Promise<void> {
  const db = getDb();
  if (!db) return;
  const jsonValue = JSON.stringify(key);
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, API_KEY_SETTING));
  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: jsonValue })
      .where(eq(settings.key, API_KEY_SETTING));
  } else {
    await db.insert(settings).values({ key: API_KEY_SETTING, value: jsonValue });
  }
}

export async function GET() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  const key = await getStoredKey();
  if (!key) {
    return ok({ hasKey: false, maskedKey: null });
  }
  // 脱敏：显示前缀 + 后4位
  const masked = key.slice(0, "sk-station-".length + 4) + "****" + key.slice(-4);
  return ok({ hasKey: true, maskedKey: masked });
}

export async function POST() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  const newKey = generateApiKey();
  await setStoredKey(newKey);
  return ok({ apiKey: newKey });
}

export async function DELETE() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  await setStoredKey(null);
  return NextResponse.json({ success: true, data: { revoked: true } });
}

/** 供内部 API route 校验 Bearer token */
export async function validateApiKey(token: string): Promise<boolean> {
  const stored = await getStoredKey();
  if (!stored) return false;
  return token === stored;
}
