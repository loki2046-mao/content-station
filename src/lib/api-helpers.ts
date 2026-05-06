/**
 * API 路由通用辅助函数
 */
import { NextResponse } from "next/server";

/** 成功响应 */
export function ok(data: unknown) {
  return NextResponse.json({ success: true, data });
}

/** 错误响应 */
export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** 数据库不可用的统一错误 */
export function dbError() {
  return err("数据库连接不可用，请检查环境变量配置", 503);
}

/** 模型未配置的统一错误 */
export function modelError() {
  return err("请先在设置页配置文本模型 API Key", 400);
}

/**
 * 安全解析 JSON 字符串
 * 解析失败时返回默认值
 */
export function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 后台任务超时阈值（毫秒）
 * 超过此时长仍处于 generating 的任务视为僵尸任务，应自动标记为 error
 */
export const BACKGROUND_TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟

/**
 * 判断 generating 状态的任务是否已经超时（成为僵尸任务）
 * 用于 status 查询时主动降级 — Vercel/serverless 进程重启会让任务卡死，
 * 这里给前端一个明确的失败信号而不是无限轮询
 */
export function isBackgroundTaskTimedOut(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > BACKGROUND_TASK_TIMEOUT_MS;
}

/**
 * 从模型返回的文本中提取 JSON
 * 模型可能在 JSON 前后加入说明文字，需要提取 ```json ... ``` 中的内容
 */
export function extractJson(text: string): string {
  // 先去掉开头的 ```json 或 ``` 标记（不管有没有闭合的 ```）
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    // 去掉开头的 ```json 或 ```
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    // 去掉结尾的 ```（如果有）
    cleaned = cleaned.replace(/\n?\s*```\s*$/, "");
    cleaned = cleaned.trim();
  }

  // 尝试提取 ```json ... ``` 块（处理文本中间包含代码块的情况）
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 尝试提取最外层的 JSON 数组或对象
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];

  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return cleaned.trim();
}
