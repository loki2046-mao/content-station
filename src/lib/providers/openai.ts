/**
 * OpenAI 兼容 Provider
 * 支持 OpenAI 官方 API 以及兼容的国内 API（如 DeepSeek、智谱等）
 * 通过自定义 base_url 实现兼容
 */
import { ModelProvider, GenerateOptions, ProviderConfig } from "./base";

export class OpenAIProvider implements ModelProvider {
  name = "openai";
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];

    // 添加系统提示词
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    // 代理模式：如果配置了 LLM_PROXY_URL，走 Cloudflare Worker 代理
    const proxyUrl = process.env.LLM_PROXY_URL;
    const proxyKey = process.env.LLM_PROXY_KEY;

    let url: string;
    let headers: Record<string, string>;
    let bodyPayload: Record<string, unknown>;

    if (proxyUrl) {
      url = proxyUrl;
      headers = {
        "Content-Type": "application/json",
        "X-Proxy-Key": proxyKey || "",
      };
      bodyPayload = {
        baseUrl: this.config.baseUrl.replace(/\/$/, ""),
        apiKey: this.config.apiKey,
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      };
    } else {
      // 直连模式（本地开发或未配置代理时）
      url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      };
      bodyPayload = {
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API 调用失败 (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const result = await this.generate("请回复\u201C连接成功\u201D四个字。", {
        maxTokens: 50,
        temperature: 0,
      });
      return { ok: true, message: `连接成功，模型返回: ${result.slice(0, 100)}` };
    } catch (error) {
      return { ok: false, message: `连接失败: ${error}` };
    }
  }
}
