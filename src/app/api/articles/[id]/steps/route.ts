/**
 * 文章步骤列表 API
 * GET /api/articles/:id/steps — 获取文章所有步骤状态
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { articleSteps } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();
  const { id } = await params;

  try {
    const steps = await db
      .select()
      .from(articleSteps)
      .where(eq(articleSteps.articleId, id));

    return ok(steps);
  } catch (error) {
    return err(`获取步骤列表失败: ${error}`, 500);
  }
}
