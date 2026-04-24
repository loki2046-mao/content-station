/**
 * Prompt 详情 API
 * DELETE /api/eval/prompts/[id] — 删除 Prompt
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { evalPrompts } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    await db.delete(evalPrompts).where(eq(evalPrompts.id, id));
    return ok({ id, deleted: true });
  } catch (error) {
    return err(`删除 Prompt 失败: ${error}`, 500);
  }
}
