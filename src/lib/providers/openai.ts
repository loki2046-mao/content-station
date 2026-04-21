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
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const messages: Array<{ role: string; content: string }> = [];

    // 添加系统提示词
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
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
