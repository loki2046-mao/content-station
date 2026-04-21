/**
 * 骨架详情 API
 * PATCH /api/outlines/:id — 更新编辑后的骨架
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { outlines } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.editedResult !== undefined) {
      updates.editedResult = JSON.stringify(body.editedResult);
    }

    await db.update(outlines).set(updates).where(eq(outlines.id, id));
    const rows = await db.select().from(outlines).where(eq(outlines.id, id));
    return ok(rows[0]);
  } catch (error) {
    return err(`更新骨架失败: ${error}`, 500);
  }
}
