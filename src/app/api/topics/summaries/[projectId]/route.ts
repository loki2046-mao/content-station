/**
 * 推演结论 API
 * GET /api/topics/summaries/[projectId]  — 获取结论
 * PUT /api/topics/summaries/[projectId]  — upsert 结论
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topicSummaries } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { projectId } = await params;
    const rows = await db.select().from(topicSummaries).where(eq(topicSummaries.projectId, projectId));
    return ok(rows[0] || null);
  } catch (error) {
    return err(`获取结论失败: ${error}`, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { projectId } = await params;
    const body = await request.json();
    const { recommendedAngle, recommendedPlatform, spreadSummary, nextAction } = body;

    const now = Date.now();
    // 检查是否已存在
    const existing = await db.select().from(topicSummaries).where(eq(topicSummaries.projectId, projectId));

    if (existing.length) {
      await db
        .update(topicSummaries)
        .set({
          recommendedAngle: recommendedAngle ?? existing[0].recommendedAngle,
          recommendedPlatform: recommendedPlatform ?? existing[0].recommendedPlatform,
          spreadSummary: spreadSummary ?? existing[0].spreadSummary,
          nextAction: nextAction ?? existing[0].nextAction,
          updatedAt: now,
        })
        .where(eq(topicSummaries.projectId, projectId));
    } else {
      await db.insert(topicSummaries).values({
        id: uuid(),
        projectId,
        recommendedAngle: recommendedAngle || null,
        recommendedPlatform: recommendedPlatform || null,
        spreadSummary: spreadSummary || null,
        nextAction: nextAction || null,
        exportStatus: "not_exported",
        lastExportedAt: null,
        updatedAt: now,
      });
    }

    const rows = await db.select().from(topicSummaries).where(eq(topicSummaries.projectId, projectId));
    return ok(rows[0]);
  } catch (error) {
    return err(`保存结论失败: ${error}`, 500);
  }
}
