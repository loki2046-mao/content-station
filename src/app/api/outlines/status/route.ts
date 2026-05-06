/**
 * 骨架生成状态查询 API
 * GET /api/outlines/status?id=xxx
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { outlines } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, isBackgroundTaskTimedOut } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return err("缺少 id 参数");

    const rows = await db.select().from(outlines).where(eq(outlines.id, id));
    if (rows.length === 0) return err("记录不存在", 404);

    let record = rows[0];

    // 超时降级：generating 超过阈值视为僵尸任务，自动改 error
    if (record.status === "generating" && isBackgroundTaskTimedOut(record.createdAt)) {
      const timeoutMsg = "任务超时（生成进程可能已中断），请重新发起";
      await db.update(outlines)
        .set({ status: "error", error: timeoutMsg })
        .where(eq(outlines.id, id));
      record = { ...record, status: "error", error: timeoutMsg };
    }

    // 解析 result：统一返回对象格式
    let parsedResult: unknown = undefined;
    if (record.status === "done" && record.result) {
      try {
        const raw = typeof record.result === "string" ? JSON.parse(record.result) : record.result;
        // 兼容旧格式：如果是数组，包装成 {sections: [...]}
        parsedResult = Array.isArray(raw) ? { sections: raw } : raw;
      } catch {
        parsedResult = undefined;
      }
    }

    return ok({
      id: record.id,
      status: record.status || "done",
      result: parsedResult,
      error: record.status === "error" ? record.error : undefined,
    });
  } catch (error) {
    return err(`查询状态失败: ${error}`, 500);
  }
}
