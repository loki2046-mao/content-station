/**
 * 移动端 Pipeline 快捷操作页面
 * 大按钮大字体，竖屏布局，PWA 可加桌面
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch, useApiGet } from "@/hooks/use-api";
import { toast, Toaster } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STAGES = [
  { key: "topic", label: "选题", icon: "📋" },
  { key: "material", label: "素材收集", icon: "📦" },
  { key: "skeleton", label: "骨架", icon: "🏗️" },
  { key: "draft", label: "初稿", icon: "✍️" },
  { key: "layout", label: "排版", icon: "🖼️" },
  { key: "cover", label: "封面", icon: "🎨" },
  { key: "ready", label: "待发布", icon: "🚀" },
] as const;

const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string; dot: string; animate?: boolean }
> = {
  pending: {
    label: "待开始",
    bg: "bg-gray-100",
    text: "text-gray-500",
    dot: "bg-gray-400",
  },
  running: {
    label: "执行中",
    bg: "bg-blue-50",
    text: "text-blue-600",
    dot: "bg-blue-500",
    animate: true,
  },
  waiting_decision: {
    label: "待确认",
    bg: "bg-orange-50",
    text: "text-orange-600",
    dot: "bg-orange-500",
  },
  completed: {
    label: "已完成",
    bg: "bg-green-50",
    text: "text-green-600",
    dot: "bg-green-500",
  },
  done: {
    label: "已完成",
    bg: "bg-green-50",
    text: "text-green-600",
    dot: "bg-green-500",
  },
  failed: {
    label: "失败",
    bg: "bg-red-50",
    text: "text-red-600",
    dot: "bg-red-500",
  },
  skipped: {
    label: "已跳过",
    bg: "bg-gray-100",
    text: "text-gray-500",
    dot: "bg-gray-400",
  },
};

/** article.status → step-like status for list display */
function articleStatusToStep(status: string): string {
  const map: Record<string, string> = {
    active: "running",
    paused: "pending",
    completed: "done",
    archived: "skipped",
  };
  return map[status] || "pending";
}

function getStageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label || key;
}

function getStageIcon(key: string): string {
  return STAGES.find((s) => s.key === key)?.icon || "📄";
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.animate ? "animate-pulse" : ""}`}
      />
      {cfg.label}
    </span>
  );
}

/* ────────────────────────────────────────────
   Modal Component (lightweight, no deps)
   ──────────────────────────────────────────── */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col mx-0 sm:mx-4 animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   New Article Dialog
   ──────────────────────────────────────────── */
function NewArticleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      toast.error("请输入文章标题");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/articles", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), metadata: {} }),
      });
      toast.success("文章创建成功！");
      setTitle("");
      onClose();
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [title, onClose, onCreated]);

  return (
    <Modal open={open} onClose={onClose} title="✍️ 新建文章">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            文章标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-copper/40 focus:border-copper"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-copper text-white font-semibold text-base active:bg-copper-dark disabled:opacity-50 transition-colors"
        >
          {submitting ? "创建中..." : "创建文章"}
        </button>
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────
   Article Detail Modal (steps + actions)
   ──────────────────────────────────────────── */
function ArticleDetailModal({
  open,
  onClose,
  articleId,
  onRefreshList,
}: {
  open: boolean;
  onClose: () => void;
  articleId: string | null;
  onRefreshList: () => void;
}) {
  const {
    data: article,
    loading,
    refresh,
  } = useApiGet<AnyRecord>(articleId ? `/api/articles/${articleId}` : null);

  const steps: AnyRecord[] = article?.steps || [];
  const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));
  const currentStage = article?.currentStage || "topic";
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [decisionText, setDecisionText] = useState("");
  const [executing, setExecuting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Poll while running
  const hasRunning = steps.some((s) => s.status === "running");
  useEffect(() => {
    if (!hasRunning || !articleId) return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [hasRunning, articleId, refresh]);

  const handleExecute = useCallback(
    async (stage: string) => {
      if (!articleId) return;
      setExecuting(true);
      try {
        await apiFetch(`/api/articles/${articleId}/execute`, {
          method: "POST",
          body: JSON.stringify({ stage }),
        });
        toast.success(`${getStageLabel(stage)} 执行完成`);
        refresh();
        onRefreshList();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "执行失败");
      } finally {
        setExecuting(false);
      }
    },
    [articleId, refresh, onRefreshList]
  );

  const handleAdvance = useCallback(
    async (decision?: string) => {
      if (!articleId) return;
      setAdvancing(true);
      try {
        await apiFetch(`/api/articles/${articleId}/advance`, {
          method: "POST",
          body: JSON.stringify({ decision: decision || undefined }),
        });
        toast.success("已推进到下一阶段");
        setDecisionText("");
        refresh();
        onRefreshList();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "推进失败");
      } finally {
        setAdvancing(false);
      }
    },
    [articleId, refresh, onRefreshList]
  );

  function safeJson(str: string | null | undefined) {
    if (!str || str === "{}" || str === "null") return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={article?.title || "加载中..."}
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : !article ? (
        <p className="text-gray-500 text-center py-8">文章不存在</p>
      ) : (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-0.5 mb-4 overflow-x-auto pb-1">
            {STAGES.map((stage, idx) => {
              const step = stepsMap[stage.key];
              const isDone =
                step?.status === "completed" || step?.status === "skipped";
              const isCurrent = stage.key === currentStage;
              const isRunning = step?.status === "running";
              return (
                <div key={stage.key} className="flex items-center gap-0.5">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        isDone
                          ? "border-green-500 bg-green-50 text-green-600"
                          : isCurrent
                          ? "border-copper bg-copper/10 text-copper"
                          : "border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                    >
                      {isRunning ? (
                        <span className="animate-spin">⏳</span>
                      ) : isDone ? (
                        "✓"
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[10px] whitespace-nowrap ${
                        isCurrent
                          ? "text-copper font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div
                      className={`h-0.5 w-3 mb-4 ${
                        isDone ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Stage cards */}
          {STAGES.map((stage) => {
            const step = stepsMap[stage.key];
            const status = step?.status || "pending";
            const isExpanded = expandedStage === stage.key;
            const output = safeJson(step?.output);
            const isCurrent = stage.key === currentStage;

            return (
              <div
                key={stage.key}
                className={`rounded-xl border transition-all ${
                  isCurrent
                    ? "border-copper/30 bg-copper/5"
                    : "border-gray-100 bg-white"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50 rounded-xl"
                  onClick={() =>
                    setExpandedStage(isExpanded ? null : stage.key)
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{stage.icon}</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-copper/10 text-copper font-medium">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    <span className="text-gray-300 text-sm">
                      {isExpanded ? "▾" : "▸"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-50">
                    {/* Output preview */}
                    {output && (
                      <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <p className="text-xs text-gray-500 font-medium mb-1">
                          AI 输出
                        </p>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                          {JSON.stringify(output, null, 2).slice(0, 600)}
                          {JSON.stringify(output, null, 2).length > 600
                            ? "\n..."
                            : ""}
                        </pre>
                      </div>
                    )}

                    {/* Decision record */}
                    {step?.decision && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-medium mb-1">
                          已确认决策
                        </p>
                        <p className="text-sm text-green-800">
                          {step.decision}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {step?.error && (
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs text-red-600 font-medium mb-1">
                          错误
                        </p>
                        <p className="text-sm text-red-700">{step.error}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {(status === "pending" || status === "failed") && (
                        <button
                          onClick={() => handleExecute(stage.key)}
                          disabled={executing}
                          className="flex-1 py-2.5 rounded-lg bg-copper text-white text-sm font-medium active:bg-copper-dark disabled:opacity-50"
                        >
                          {executing ? "执行中..." : "▶️ 执行"}
                        </button>
                      )}
                      {status === "waiting_decision" && (
                        <>
                          <input
                            type="text"
                            value={decisionText}
                            onChange={(e) => setDecisionText(e.target.value)}
                            placeholder="输入决策（可选）"
                            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-copper/30"
                          />
                          <button
                            onClick={() => handleAdvance(decisionText)}
                            disabled={advancing}
                            className="px-4 py-2.5 rounded-lg bg-copper text-white text-sm font-medium active:bg-copper-dark disabled:opacity-50"
                          >
                            {advancing ? "..." : "✅ 确认"}
                          </button>
                        </>
                      )}
                      {status === "running" && (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                          <span className="animate-spin">⏳</span>
                          AI 正在生成中...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ────────────────────────────────────────────
   Auto-Advance Modal
   ──────────────────────────────────────────── */
function AutoAdvanceModal({
  open,
  onClose,
  articles,
  onRefreshList,
}: {
  open: boolean;
  onClose: () => void;
  articles: AnyRecord[];
  onRefreshList: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef(false);

  const activeArticles = articles.filter((a) => a.status !== "completed");

  const handleStart = useCallback(async () => {
    if (!selectedId) {
      toast.error("请选择一篇文章");
      return;
    }
    setRunning(true);
    setLogs([]);
    abortRef.current = false;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (abortRef.current) {
          setLogs((l) => [...l, "⏹ 已停止"]);
          break;
        }

        const res = await apiFetch<AnyRecord>(
          `/api/articles/${selectedId}/auto-advance`,
          { method: "POST" }
        );
        const { action, stage, error, message } = res;
        if (stage) setCurrentStage(stage);

        if (action === "allDone") {
          setLogs((l) => [...l, "🎉 全部阶段已完成！"]);
          toast.success("全部阶段已自动完成！");
          onRefreshList();
          break;
        }

        if (action === "failed") {
          setLogs((l) => [
            ...l,
            `❌ ${getStageLabel(stage || "")} 失败: ${error || message}`,
          ]);
          toast.error(`${getStageLabel(stage || "")} 执行失败`);
          onRefreshList();
          break;
        }

        if (action === "executed") {
          setLogs((l) => [
            ...l,
            `✅ ${getStageLabel(stage || "")} 完成`,
          ]);
          onRefreshList();
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        if (action === "running") {
          setLogs((l) => {
            const msg = `⏳ ${getStageLabel(stage || "")} 执行中...`;
            if (l[l.length - 1] === msg) return l;
            return [...l, msg];
          });
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "自动推进失败";
      setLogs((l) => [...l, `❌ ${msg}`]);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }, [selectedId, onRefreshList]);

  return (
    <Modal open={open} onClose={onClose} title="🚀 一键推进">
      <div className="space-y-4">
        {!running ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择要推进的文章
              </label>
              {activeArticles.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  没有进行中的文章
                </p>
              ) : (
                <div className="space-y-2">
                  {activeArticles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        selectedId === a.id
                          ? "border-copper bg-copper/5"
                          : "border-gray-100 bg-white"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800 mb-1">
                        {a.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {getStageIcon(a.currentStage || a.current_stage || "topic")}{" "}
                          {getStageLabel(a.currentStage || a.current_stage || "topic")}
                        </span>
                        <StatusBadge
                          status={articleStatusToStep(a.status)}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleStart}
              disabled={!selectedId}
              className="w-full py-3.5 rounded-xl bg-copper text-white font-semibold text-base active:bg-copper-dark disabled:opacity-40 transition-colors"
            >
              开始自动推进
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-copper font-medium">
              <span className="animate-spin text-lg">⏳</span>
              正在推进：{getStageLabel(currentStage)}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {log}
                </p>
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-gray-400">启动中...</p>
              )}
            </div>
            <button
              onClick={() => (abortRef.current = true)}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium active:bg-gray-50"
            >
              ⏹ 停止
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────
   Articles List Modal
   ──────────────────────────────────────────── */
function ArticlesListModal({
  open,
  onClose,
  articles,
  loading,
  onSelectArticle,
}: {
  open: boolean;
  onClose: () => void;
  articles: AnyRecord[];
  loading: boolean;
  onSelectArticle: (id: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="📋 我的文章">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">📝</p>
          <p className="text-gray-500">还没有文章，去创建一篇吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => {
            const stage = a.currentStage || a.current_stage || "topic";
            const statusKey = articleStatusToStep(a.status);
            return (
              <button
                key={a.id}
                onClick={() => onSelectArticle(a.id)}
                className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-100 bg-white active:bg-gray-50 transition-all"
              >
                <p className="text-sm font-semibold text-gray-800 mb-1.5 line-clamp-2">
                  {a.title}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {getStageIcon(stage)} {getStageLabel(stage)}
                    </span>
                    <StatusBadge status={statusKey} />
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(
                      a.createdAt || a.created_at
                    ).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ────────────────────────────────────────────
   Main Mobile Page
   ──────────────────────────────────────────── */
export default function MobilePipelinePage() {
  const {
    data: articles,
    loading,
    refresh,
  } = useApiGet<AnyRecord[]>("/api/articles");

  const [showCreate, setShowCreate] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showAutoAdvance, setShowAutoAdvance] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const articleCount = articles?.length || 0;

  return (
    <div className="min-h-screen bg-[#FDF8F4] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FDF8F4]/90 backdrop-blur-sm border-b border-copper/10 px-5 pt-[env(safe-area-inset-top)] pb-0">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              ✍️ 写作Pipeline
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {articleCount > 0
                ? `共 ${articleCount} 篇文章`
                : "开始你的第一篇文章"}
            </p>
          </div>
          <button
            onClick={refresh}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 active:bg-gray-100"
          >
            🔄
          </button>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="flex-1 px-5 py-6 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* New Article */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-[0.98] active:shadow-none transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-copper/10 flex items-center justify-center text-2xl flex-shrink-0">
              ✍️
            </span>
            <div className="text-left">
              <p className="text-base font-bold text-gray-900">新建文章</p>
              <p className="text-sm text-gray-500 mt-0.5">
                输入标题，开始写作流程
              </p>
            </div>
          </button>

          {/* My Articles */}
          <button
            onClick={() => setShowList(true)}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-[0.98] active:shadow-none transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
              📋
            </span>
            <div className="text-left flex-1">
              <p className="text-base font-bold text-gray-900">我的文章</p>
              <p className="text-sm text-gray-500 mt-0.5">
                查看进度、管理阶段
              </p>
            </div>
            {articleCount > 0 && (
              <span className="w-7 h-7 rounded-full bg-copper/10 text-copper text-sm font-bold flex items-center justify-center">
                {articleCount}
              </span>
            )}
          </button>

          {/* Auto Advance */}
          <button
            onClick={() => setShowAutoAdvance(true)}
            className="flex items-center gap-4 px-5 py-5 rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-[0.98] active:shadow-none transition-all"
          >
            <span className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl flex-shrink-0">
              🚀
            </span>
            <div className="text-left">
              <p className="text-base font-bold text-gray-900">一键推进</p>
              <p className="text-sm text-gray-500 mt-0.5">
                选择文章，自动走完所有阶段
              </p>
            </div>
          </button>
        </div>

        {/* Recent articles quick peek */}
        {articles && articles.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1">
              最近文章
            </h2>
            <div className="space-y-2">
              {articles.slice(0, 3).map((a) => {
                const stage = a.currentStage || a.current_stage || "topic";
                const statusKey = articleStatusToStep(a.status);
                return (
                  <button
                    key={a.id}
                    onClick={() => setDetailId(a.id)}
                    className="w-full text-left px-4 py-3.5 rounded-xl bg-white border border-gray-100 active:bg-gray-50 transition-all"
                  >
                    <p className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">
                      {a.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {getStageIcon(stage)} {getStageLabel(stage)}
                      </span>
                      <StatusBadge status={statusKey} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-5 py-4 text-center border-t border-gray-100">
        <p className="text-xs text-gray-400">© 2026 赛博小熊猫Loki</p>
      </footer>

      {/* Modals */}
      <NewArticleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />

      <ArticlesListModal
        open={showList}
        onClose={() => setShowList(false)}
        articles={articles || []}
        loading={loading}
        onSelectArticle={(id) => {
          setShowList(false);
          setDetailId(id);
        }}
      />

      <AutoAdvanceModal
        open={showAutoAdvance}
        onClose={() => setShowAutoAdvance(false)}
        articles={articles || []}
        onRefreshList={refresh}
      />

      <ArticleDetailModal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        articleId={detailId}
        onRefreshList={refresh}
      />

      <Toaster position="top-center" richColors />

      {/* Inline styles for the mobile theme */}
      <style jsx global>{`
        .bg-copper {
          background-color: #b8623c;
        }
        .bg-copper-dark {
          background-color: #8b4a2b;
        }
        .text-copper {
          color: #b8623c;
        }
        .bg-copper\\/5 {
          background-color: rgba(184, 98, 60, 0.05);
        }
        .bg-copper\\/10 {
          background-color: rgba(184, 98, 60, 0.1);
        }
        .border-copper {
          border-color: #b8623c;
        }
        .border-copper\\/10 {
          border-color: rgba(184, 98, 60, 0.1);
        }
        .border-copper\\/30 {
          border-color: rgba(184, 98, 60, 0.3);
        }
        .ring-copper\\/30 {
          --tw-ring-color: rgba(184, 98, 60, 0.3);
        }
        .ring-copper\\/40 {
          --tw-ring-color: rgba(184, 98, 60, 0.4);
        }
        .focus\\:ring-copper\\/40:focus {
          --tw-ring-color: rgba(184, 98, 60, 0.4);
        }
        .focus\\:border-copper:focus {
          border-color: #b8623c;
        }
        .active\\:bg-copper-dark:active {
          background-color: #8b4a2b;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
