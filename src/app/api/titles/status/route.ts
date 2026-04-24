/**
 * 标题生成状态查询 API
 * GET /api/titles/status?id=xxx
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { titles } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return err("缺少 id 参数");

    const rows = await db.select().from(titles).where(eq(titles.id, id));
    if (rows.length === 0) return err("记录不存在", 404);

    const record = rows[0];
    return ok({
      id: record.id,
      status: record.status || "done",
      result: record.status === "done" ? record.result : undefined,
      error: record.status === "error" ? record.error : undefined,
    });
  } catch (error) {
    return err(`查询状态失败: ${error}`, 500);
  }
}
