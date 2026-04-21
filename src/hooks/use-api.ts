/**
 * 通用 API 调用 Hook 和工具函数
 */
"use client";

import { useState, useEffect, useCallback } from "react";

/** API 响应格式 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 通用 fetch 封装
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || "请求失败");
  }
  return json.data as T;
}

/**
 * GET 请求 Hook
 * 自动加载数据，支持刷新
 */
export function useApiGet<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(url);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, setData };
}
