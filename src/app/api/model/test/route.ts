/**
 * 模型连接测试 API
 * POST /api/model/test — 测试模型连接是否正常
 */
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { createProvider } from "@/lib/providers";
import type { ProviderConfig } from "@/lib/providers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider: providerName, apiKey, baseUrl, model } = body;

    if (!apiKey) return err("请输入 API Key");

    const config: ProviderConfig = {
      provider: providerName || "openai",
      apiKey,
      baseUrl: baseUrl || "https://api.openai.com/v1",
      model: model || "gpt-4o-mini",
    };

    const provider = createProvider(config);
    const result = await provider.testConnection();

    return ok(result);
  } catch (error) {
    return err(`测试连接失败: ${error}`, 500);
  }
}
