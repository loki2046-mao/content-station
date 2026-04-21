/**
 * 模型 Provider 统一接口
 * 所有模型实现都遵循此接口
 */

export interface GenerateOptions {
  temperature?: number; // 温度，控制创造性
  maxTokens?: number; // 最大输出 token 数
  systemPrompt?: string; // 系统提示词
}

export interface ModelProvider {
  /** Provider 名称 */
  name: string;

  /**
   * 调用模型生成文本
   * @param prompt 用户提示词
   * @param options 生成选项
   * @returns 模型返回的文本
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * 测试连接是否正常
   * @returns 测试结果描述
   */
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

/**
 * Provider 配置
 */
export interface ProviderConfig {
  provider: string; // openai / anthropic / gemini / custom
  apiKey: string;
  baseUrl: string;
  model: string;
}
