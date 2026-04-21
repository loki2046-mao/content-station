/**
 * Anthropic Claude Provider
 * 支持 Claude 系列模型
 */
import { ModelProvider, GenerateOptions, ProviderConfig } from "./base";

export class AnthropicProvider implements ModelProvider {
  name = "anthropic";
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const baseUrl = this.config.baseUrl || "https://api.anthropic.com";
    const url = `${baseUrl.replace(/\/$/, "")}/v1/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-sonnet-4-20250514",
        max_tokens: options?.maxTokens ?? 4096,
        system: options?.systemPrompt || "",
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API 调用失败 (${response.status}): ${error}`);
    }

    const data = await response.json();
    // Anthropic 返回格式：content 是一个数组
    const textBlocks = data.content?.filter(
      (b: { type: string }) => b.type === "text"
    );
    return textBlocks?.map((b: { text: string }) => b.text).join("") || "";
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
