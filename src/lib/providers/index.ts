/**
 * 模型 Provider 工厂
 * 根据数据库 settings 表配置自动选择 provider
 */
import { ModelProvider, ProviderConfig } from "./base";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 从数据库读取模型配置
 */
export async function getModelConfig(): Promise<ProviderConfig | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const rows = await db.select().from(settings);
    const config: Record<string, string> = {};

    for (const row of rows) {
      try {
        config[row.key] = JSON.parse(row.value || '""');
      } catch {
        config[row.key] = row.value || "";
      }
    }

    const apiKey = config["api_key"] || "";
    if (!apiKey) return null;

    return {
      provider: config["model_provider"] || "openai",
      apiKey,
      baseUrl: config["base_url"] || "https://api.openai.com/v1",
      model: config["default_model"] || "gpt-4o-mini",
    };
  } catch (error) {
    console.error("[Provider] 读取配置失败:", error);
    return null;
  }
}

/**
 * 根据配置创建 Provider 实例
 * 国内大模型全部走 OpenAI 兼容接口（base_url 已预设）
 */
export function createProvider(config: ProviderConfig): ModelProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
    case "gemini":
    // 国内大模型（OpenAI 兼容接口）
    case "deepseek":
    case "qwen":
    case "doubao":
    case "zhipu":
    case "moonshot":
    case "baidu":
    case "minimax":
    case "hunyuan":
    case "stepfun":
    case "lingyiwanwu":
    case "baichuan":
    // Coding 专用
    case "alibaba_coding":
    case "volcengine_coding":
    case "zhipu_coding":
    case "kimi_coding":
    case "github_copilot":
    // 本地 / 自定义
    case "ollama":
    case "custom":
    default:
      return new OpenAIProvider(config);
  }
}

/**
 * 获取当前配置的 Provider
 * 如果未配置返回 null
 */
export async function getProvider(): Promise<ModelProvider | null> {
  const config = await getModelConfig();
  if (!config) return null;
  return createProvider(config);
}

/**
 * 获取当前使用的模型名
 */
export async function getCurrentModelName(): Promise<string> {
  const config = await getModelConfig();
  return config?.model || "未配置";
}

export type { ModelProvider, ProviderConfig, GenerateOptions } from "./base";
