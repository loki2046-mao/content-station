/**
 * 数据导出 API
 * GET /api/data/export — 导出全部数据为 JSON
 */
import { getDb } from "@/lib/db";
import { topics, analyses, titles, outlines, materials, tags, settings } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { err, dbError } from "@/lib/api-helpers";
import { NextResponse } from "next/server";

export async function GET() {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const data = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      topics: await db.select().from(topics),
      analyses: await db.select().from(analyses),
      titles: await db.select().from(titles),
      outlines: await db.select().from(outlines),
      materials: await db.select().from(materials),
      tags: await db.select().from(tags),
      settings: await db.select().from(settings),
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="content-station-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return err(`数据导出失败: ${error}`, 500);
  }
}
