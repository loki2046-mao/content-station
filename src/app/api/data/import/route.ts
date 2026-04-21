/**
 * 数据导入 API
 * POST /api/data/import — 从 JSON 文件导入数据
 */
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { topics, analyses, titles, outlines, materials, tags, settings } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const data = await request.json();
    let counts = { topics: 0, analyses: 0, titles: 0, outlines: 0, materials: 0, tags: 0, settings: 0 };

    // 导入各表数据（使用 INSERT OR IGNORE 避免重复）
    if (data.topics?.length) {
      for (const row of data.topics) {
        try {
          await db.insert(topics).values(row);
          counts.topics++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.analyses?.length) {
      for (const row of data.analyses) {
        try {
          await db.insert(analyses).values(row);
          counts.analyses++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.titles?.length) {
      for (const row of data.titles) {
        try {
          await db.insert(titles).values(row);
          counts.titles++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.outlines?.length) {
      for (const row of data.outlines) {
        try {
          await db.insert(outlines).values(row);
          counts.outlines++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.materials?.length) {
      for (const row of data.materials) {
        try {
          await db.insert(materials).values(row);
          counts.materials++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.tags?.length) {
      for (const row of data.tags) {
        try {
          await db.insert(tags).values(row);
          counts.tags++;
        } catch { /* 跳过重复 */ }
      }
    }

    if (data.settings) {
      for (const row of data.settings) {
        try {
          await db.insert(settings).values(row);
          counts.settings++;
        } catch { /* 跳过重复 */ }
      }
    }

    return ok({ message: "导入完成", counts });
  } catch (error) {
    return err(`数据导入失败: ${error}`, 500);
  }
}
