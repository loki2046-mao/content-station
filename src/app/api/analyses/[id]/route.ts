/**
 * 切口分析详情 API
 * DELETE /api/analyses/:id — 删除分析记录
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    await db.delete(analyses).where(eq(analyses.id, id));
    return ok({ deleted: true });
  } catch (error) {
    return err(`删除失败: ${error}`, 500);
  }
}
