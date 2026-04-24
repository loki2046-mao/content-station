/**
 * 推演项目列表 API
 * GET  /api/topics/projects — 获取项目列表，支持 ?status= 筛选
 * POST /api/topics/projects — 新建项目
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topicProjects } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = db.select().from(topicProjects);
    if (status && status !== "all") {
      query = query.where(eq(topicProjects.status, status)) as typeof query;
    }

    const rows = await query.orderBy(desc(topicProjects.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取推演项目列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title || !title.trim()) return err("项目标题不能为空");

    const now = Date.now();
    const newProject = {
      id: uuid(),
      title: title.trim(),
      description: description?.trim() || null,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(topicProjects).values(newProject);
    return ok(newProject);
  } catch (error) {
    return err(`创建推演项目失败: ${error}`, 500);
  }
}
