/**
 * 测试结果详情 API
 * PATCH  /api/eval/test-results/[id] — 更新测试结果
 * DELETE /api/eval/test-results/[id] — 删除测试结果
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { evalTestResults } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      modelUsed,
      outputUrl,
      rating,
      highlights,
      issues,
      worthWriting,
      extractableInsight,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (modelUsed !== undefined) updateData.modelUsed = modelUsed;
    if (outputUrl !== undefined) updateData.outputUrl = outputUrl;
    if (rating !== undefined) updateData.rating = rating;
    if (highlights !== undefined) updateData.highlights = highlights;
    if (issues !== undefined) updateData.issues = issues;
    if (worthWriting !== undefined) updateData.worthWriting = worthWriting ? 1 : 0;
    if (extractableInsight !== undefined) updateData.extractableInsight = extractableInsight;

    await db
      .update(evalTestResults)
      .set(updateData)
      .where(eq(evalTestResults.id, id));

    return ok({ id, ...updateData });
  } catch (error) {
    return err(`更新测试结果失败: ${error}`, 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { id } = await params;
    await db.delete(evalTestResults).where(eq(evalTestResults.id, id));
    return ok({ id, deleted: true });
  } catch (error) {
    return err(`删除测试结果失败: ${error}`, 500);
  }
}
