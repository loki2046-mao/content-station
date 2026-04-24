/**
 * 后台任务轮询 Hook
 *
 * 用法：
 *   const { status, result, error, trigger } = useBackgroundTask({
 *     generateUrl: "/api/analyze",
 *     statusUrl: "/api/analyze/status",
 *     onDone: (result) => { ... },
 *     onError: (error) => { ... },
 *   });
 *
 *   trigger({ topicId, inputText }); // 触发生成
 *
 * 核心逻辑：
 * - trigger() 发出 POST fetch（fire-and-forget，不等 response）
 * - 立刻开始轮询 status API（每 3 秒）
 * - 轮询到 done/error 时停止
 * - 组件卸载时 clearInterval
 * - 组件挂载时可传入 resumeId 恢复轮询（切走再回来的场景）
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type TaskStatus = "idle" | "generating" | "done" | "error";

interface UseBackgroundTaskOptions {
  generateUrl: string;
  statusUrl: string;
  onDone?: (result: unknown) => void;
  onError?: (error: string) => void;
  /** 组件挂载时要恢复轮询的任务 ID */
  resumeId?: string | null;
  /** 轮询间隔（毫秒），默认 3000 */
  pollInterval?: number;
}

interface UseBackgroundTaskReturn {
  status: TaskStatus;
  taskId: string | null;
  result: unknown | null;
  error: string | null;
  trigger: (body: Record<string, unknown>) => void;
}

export function useBackgroundTask({
  generateUrl,
  statusUrl,
  onDone,
  onError,
  resumeId,
  pollInterval = 3000,
}: UseBackgroundTaskOptions): UseBackgroundTaskReturn {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);

  // 保持回调引用最新
  onDoneRef.current = onDone;
  onErrorRef.current = onError;

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 开始轮询指定 id
  const startPolling = useCallback((id: string) => {
    stopPolling();
    setStatus("generating");
    setTaskId(id);
    setResult(null);
    setError(null);

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${statusUrl}?id=${id}`);
        const json = await res.json();
        if (!json.success) return; // 忽略临时错误，继续轮询

        const data = json.data;
        if (data.status === "done") {
          stopPolling();
          const parsedResult = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          setStatus("done");
          setResult(parsedResult);
          onDoneRef.current?.(parsedResult);
        } else if (data.status === "error") {
          stopPolling();
          setStatus("error");
          setError(data.error || "生成失败");
          onErrorRef.current?.(data.error || "生成失败");
        }
        // status === "generating" → 继续轮询
      } catch {
        // 网络错误，继续轮询（不停止）
      }
    }, pollInterval);
  }, [statusUrl, pollInterval, stopPolling]);

  // 触发生成
  const trigger = useCallback((body: Record<string, unknown>) => {
    setStatus("generating");
    setResult(null);
    setError(null);

    // Fire-and-forget: 发出 POST 但不等 response
    fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.id) {
          // 拿到 ID 后开始轮询
          startPolling(json.data.id);
        } else if (json.success && json.data?.status === "done") {
          // 极端情况：模型极快，直接返回了结果
          const parsedResult = typeof json.data.result === "string"
            ? JSON.parse(json.data.result) : json.data.result;
          setStatus("done");
          setTaskId(json.data.id);
          setResult(parsedResult);
          onDoneRef.current?.(parsedResult);
        } else {
          // 触发失败（参数校验等）
          setStatus("error");
          setError(json.error || "请求失败");
          onErrorRef.current?.(json.error || "请求失败");
        }
      })
      .catch(() => {
        // fetch 中断（切走）— 没关系，服务端仍在跑
        // 但我们没有 taskId，需要挂载时恢复
        // 这种情况下 status 保持 generating，等组件重新挂载时通过 resumeId 恢复
      });
  }, [generateUrl, startPolling]);

  // 恢复轮询（组件挂载时检查是否有进行中的任务）
  useEffect(() => {
    if (resumeId) {
      startPolling(resumeId);
    }
    return () => stopPolling();
  }, [resumeId, startPolling, stopPolling]);

  // 组件卸载清理
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { status, taskId, result, error, trigger };
}
