/**
 * AI 展开卡片 API
 * POST /api/topics/generate — 调用 LLM 生成卡片，批量写入 topic_cards
 * body: { projectId, zoneType, topic }
 */
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import { topicCards } from "@/lib/db/schema";
import { ensureDbInit } from "@/lib/db/ensure-init";
import { ok, err, dbError, extractJson } from "@/lib/api-helpers";
import { getProvider } from "@/lib/providers";

const SYSTEM_PROMPT = `你是一个内容创作助手，帮助内容创作者从不同维度推演选题。
输出必须是 JSON 数组，每个对象包含 title 和 content 两个字段，不要有多余的文字。`;

function buildUserPrompt(zoneType: string, topic: string): string {
  switch (zoneType) {
    case "angle":
      return `选题：${topic}。请从以下切口类型出发，各生成一张切口卡片：情绪切口、认知反转切口、打工人切口、产品观察切口、行业趋势切口、哲学/关系感切口。每张卡片 title 是切口类型，content 说明这个切口的角度和为什么值得写（50字以内）。`;
    case "platform":
      return `选题：${topic}。针对以下平台各生成一张建议卡：公众号、小红书、即刻、朋友圈。每张卡片 title 是平台名，content 说明为什么适合这个平台以及建议的表达方式（50字以内）。`;
    case "spread":
      return `选题：${topic}。分析这个选题的传播潜力，生成5张判断卡：最容易点开的点、最容易转发的点、最容易引发评论的点、最容易写空或同质化的风险、传播潜力总评（强/中/弱+原因）。`;
    case "next_step":
      return `选题：${topic}。分析写作准备度，生成若干建议卡，从以下方向选择合适的：直接进入标题生成、直接进入文章骨架、先进入选题池、先回外脑补材料、先观察不急着写、可以拆成系列。每张卡片说明为什么推荐这个动作。`;
    default:
      return `选题：${topic}。请生成若干分析卡片，每张卡片包含 title 和 content 字段。`;
  }
}

export async function POST(request: NextRequest) {
  await ensureDbInit();
  const db = getDb();
  if (!db) return dbError();

  try {
    const body = await request.json();
    const { projectId, zoneType, topic } = body;

    if (!projectId) return err("缺少 projectId");
    if (!zoneType) return err("缺少 zoneType");
    if (!topic || !topic.trim()) return err("缺少 topic");

    // 获取 AI provider
    const provider = await getProvider();
    if (!provider) return err("AI provider not configured", 400);

    const userPrompt = buildUserPrompt(zoneType, topic.trim());

    let rawResult: string;
    try {
      rawResult = await provider.generate(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
        temperature: 0.8,
      });
    } catch (genError) {
      return err(`AI 生成失败: ${genError}`, 500);
    }

    // 解析 JSON
    const jsonStr = extractJson(rawResult);
    let cards: Array<{ title: string; content: string }>;
    try {
      cards = JSON.parse(jsonStr);
      if (!Array.isArray(cards)) throw new Error("not array");
    } catch {
      return err(`AI 返回格式无法解析: ${rawResult.slice(0, 300)}`, 500);
    }

    // 批量插入
    const now = Date.now();
    const insertedCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card.title) continue;
      const newCard = {
        id: uuid(),
        projectId,
        zoneType,
        title: card.title.trim(),
        content: card.content?.trim() || null,
        cardStatus: "active",
        sourceType: "generated",
        isPinned: 0,
        sortOrder: i,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(topicCards).values(newCard);
      insertedCards.push(newCard);
    }

    return ok(insertedCards);
  } catch (error) {
    return err(`AI 展开失败: ${error}`, 500);
  }
}
