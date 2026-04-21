/**
 * 测评项目 API
 * GET  /api/eval/projects — 获取项目列表
 * POST /api/eval/projects — 创建项目
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { evalProjects } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { desc } from "drizzle-orm";

export async function GET() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const rows = await db.select().from(evalProjects).orderBy(desc(evalProjects.createdAt));
    return ok(rows);
  } catch (error) {
    return err(`获取测评项目列表失败: ${error}`, 500);
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { name, goalType, modelType, status } = body;

    if (!name) return err("项目名称不能为空");

    const now = new Date().toISOString();
    const newProject = {
      id: uuid(),
      name,
      goalType: goalType || "",
      modelType: (modelType || "text") as "text" | "image" | "video" | "agent",
      status: (status || "draft") as "draft" | "active" | "completed",
      createdAt: now,
    };

    await db.insert(evalProjects).values(newProject);
    return ok(newProject);
  } catch (error) {
    return err(`创建测评项目失败: ${error}`, 500);
  }
}
