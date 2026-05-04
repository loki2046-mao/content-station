/**
 * Cola 选题来源配置
 *
 * 与旧版 Cola 公众号工作站的 TOPIC_SOURCES 保持一致。
 */

export type TopicSourcePriority = "high" | "medium" | "low";

export interface TopicSourceConfig {
  name: string;
  type: string;
  searchQuery: string;
  priority: TopicSourcePriority;
  enabled?: boolean;
}

export const COLA_TOPIC_SOURCES: readonly TopicSourceConfig[] = [
  {
    name: "即刻AI圈",
    type: "social",
    searchQuery: "即刻 AI 热门话题 今日",
    priority: "high",
  },
  {
    name: "Twitter/X AI圈",
    type: "social",
    searchQuery: "AI tools trending twitter today",
    priority: "high",
  },
  {
    name: "少数派AI",
    type: "media",
    searchQuery: "少数派 AI 工具 最新",
    priority: "medium",
  },
  {
    name: "ProductHunt AI",
    type: "product",
    searchQuery: "Product Hunt AI tools today",
    priority: "high",
  },
  {
    name: "36氪AI频道",
    type: "media",
    searchQuery: "36氪 AI 最新 产品",
    priority: "medium",
  },
  {
    name: "模型更新追踪",
    type: "tech",
    searchQuery: "OpenAI Claude Gemini model update this week",
    priority: "high",
  },
  {
    name: "国产模型动态",
    type: "tech",
    searchQuery: "豆包 即梦 通义千问 DeepSeek 最新更新",
    priority: "high",
  },
  {
    name: "AI+教育",
    type: "edu",
    searchQuery: "AI教育应用 K12 最新案例",
    priority: "high",
  },
  {
    name: "AI图像生成",
    type: "creative",
    searchQuery: "AI image generation new model tool 2026",
    priority: "medium",
  },
  {
    name: "AI视频生成",
    type: "creative",
    searchQuery: "AI video generation Sora Veo Kling update",
    priority: "medium",
  },
];
