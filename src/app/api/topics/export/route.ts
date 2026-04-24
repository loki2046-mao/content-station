/**
 * 推演结果导出 API
 * POST /api/topics/export — 导出结论到外脑 inbox_items，更新 export_status
 * body: { projectId }
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topicSummaries, topicCards, topicProjects, inboxItems } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError } from "@/lib/api-helpers";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) return err("缺少 projectId");

    // 获取项目信息
    const projectRows = await db.select().from(topicProjects).where(eq(topicProjects.id, projectId));
    if (!projectRows.length) return err("项目不存在", 404);
    const project = projectRows[0];

    // 获取结论
    const summaryRows = await db.select().from(topicSummaries).where(eq(topicSummaries.projectId, projectId));
    const summary = summaryRows[0] || null;

    // 获取所有 preferred 卡片
    const preferredCards = await db
      .select()
      .from(topicCards)
      .where(and(eq(topicCards.projectId, projectId), eq(topicCards.cardStatus, "preferred")));

    // 组合导出内容
    const lines: string[] = [];
    lines.push(`# 选题推演结论：${project.title}`);
    if (project.description) lines.push(`\n> ${project.description}`);

    if (summary) {
      lines.push("\n## 推荐结论");
      if (summary.recommendedAngle) lines.push(`- **推荐切口**：${summary.recommendedAngle}`);
      if (summary.recommendedPlatform) lines.push(`- **推荐平台**：${summary.recommendedPlatform}`);
      if (summary.spreadSummary) lines.push(`- **核心传播点**：${summary.spreadSummary}`);
      if (summary.nextAction) lines.push(`- **下一步动作**：${summary.nextAction}`);
    }

    if (preferredCards.length) {
      lines.push("\n## 精选卡片");
      const zones: Record<string, string> = {
        angle: "可写切口",
        platform: "适合平台",
        spread: "传播判断",
        next_step: "下一步建议",
      };
      const grouped: Record<string, typeof preferredCards> = {};
      for (const card of preferredCards) {
        if (!grouped[card.zoneType]) grouped[card.zoneType] = [];
        grouped[card.zoneType].push(card);
      }
      for (const [zone, cards] of Object.entries(grouped)) {
        lines.push(`\n### ${zones[zone] || zone}`);
        for (const card of cards) {
          lines.push(`**${card.title}**：${card.content || ""}`);
        }
      }
    }

    const rawContent = lines.join("\n");
    const now = new Date().toISOString();
    const nowMs = Date.now();

    // 写入 inbox_items（失败不阻断 export_status 更新）
    let inboxError: string | null = null;
    try {
      await db.insert(inboxItems).values({
        id: uuid(),
        rawContent,
        sourceType: "generated",
        quickType: "topic",
        suggestedType: "ei_topic",
        suggestedTags: JSON.stringify(["推演板导出"]),
        status: "inbox",
        promotedToId: "",
        createdAt: now,
        updatedAt: now,
      });
    } catch (inboxErr) {
      inboxError = `写入外脑失败: ${inboxErr}`;
      console.error("[Export]", inboxError);
    }

    // 更新 export_status（无论 inbox 是否成功）
    if (summaryRows.length) {
      await db
        .update(topicSummaries)
        .set({ exportStatus: "exported", lastExportedAt: nowMs, updatedAt: nowMs })
        .where(eq(topicSummaries.projectId, projectId));
    } else {
      // 没有结论记录，创建一条空的
      await db.insert(topicSummaries).values({
        id: uuid(),
        projectId,
        recommendedAngle: null,
        recommendedPlatform: null,
        spreadSummary: null,
        nextAction: null,
        exportStatus: "exported",
        lastExportedAt: nowMs,
        updatedAt: nowMs,
      });
    }

    return ok({
      exported: true,
      inboxWarning: inboxError,
    });
  } catch (error) {
    return err(`导出失败: ${error}`, 500);
  }
}
