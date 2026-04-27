/**
 * 文章详情 / Pipeline 进度页
 */
"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/loading";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, ArrowRight, Pencil } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STAGES = [
  { key: "topic",    label: "选题",    icon: "📋" },
  { key: "material", label: "素材收集", icon: "📦" },
  { key: "skeleton", label: "骨架",    icon: "🏗️" },
  { key: "draft",    label: "初稿",    icon: "✍️" },
  { key: "layout",   label: "排版",    icon: "🖼️" },
  { key: "cover",    label: "封面",    icon: "🎨" },
  { key: "ready",    label: "待发布",   icon: "🚀" },
] as const;

const ARTICLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: "进行中", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  paused:    { label: "已暂停", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  completed: { label: "已完成", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  archived:  { label: "已归档", color: "bg-muted/60 text-muted-foreground border-border" },
};

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  running:          { label: "进行中",   color: "bg-blue-500/15 text-blue-400 border-blue-500/30",       dot: "bg-blue-400" },
  waiting_decision: { label: "等待决策", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  completed:        { label: "已完成",   color: "bg-green-500/15 text-green-400 border-green-500/30",    dot: "bg-green-400" },
  pending:          { label: "待开始",   color: "bg-muted/60 text-muted-foreground border-border",       dot: "bg-muted-foreground/40" },
  failed:           { label: "失败",     color: "bg-red-500/15 text-red-400 border-red-500/30",          dot: "bg-red-400" },
  skipped:          { label: "已跳过",   color: "bg-muted/60 text-muted-foreground border-border",       dot: "bg-muted-foreground/40" },
};

/** 阶段进度条 */
function StageProgressBar({
  currentStage,
  steps,
}: {
  currentStage: string;
  steps: AnyRecord[];
}) {
  const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, idx) => {
        const step = stepsMap[stage.key];
        const isCompleted = step?.status === "completed" || step?.status === "skipped";
        const isCurrent = stage.key === currentStage;
        const isPast = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted || isPast
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : isCurrent
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground/50"
                }`}
              >
                {isCompleted || isPast ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <span className="text-xs font-bold">{idx + 1}</span>
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent
                    ? "text-primary font-medium"
                    : isFuture
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={`h-0.5 w-6 mb-4 flex-shrink-0 ${
                  idx < currentIdx ? "bg-green-500/50" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 当前阶段面板 */
function CurrentStagePanel({
  article,
  steps,
  onRefresh,
}: {
  article: AnyRecord;
  steps: AnyRecord[];
  onRefresh: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [decision, setDecision] = useState("");

  const currentStage = article.currentStage || article.current_stage || "topic";
  const stageInfo = STAGES.find((s) => s.key === currentStage);
  const currentStep = steps.find((s) => s.stage === currentStage);
  const stepStatus = currentStep?.status || "pending";
  const stepConfig = STEP_STATUS_CONFIG[stepStatus] || STEP_STATUS_CONFIG.pending;

  const isLastStage = currentStage === "ready";
  const isCompleted = article.status === "completed";

  const safeJson = (str: string | null | undefined) => {
    if (!str || str === "{}") return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  const inputData = safeJson(currentStep?.input);
  const outputData = safeJson(currentStep?.output);

  const handleAdvance = useCallback(async () => {
    setAdvancing(true);
    try {
      await apiFetch(`/api/articles/${article.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ decision: decision.trim() || undefined }),
      });
      toast.success(isLastStage ? "文章已完成！" : "已推进到下一阶段");
      setDecision("");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setAdvancing(false);
    }
  }, [article.id, decision, isLastStage, onRefresh]);

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-lg font-medium text-green-400">文章已完成全部流程</p>
          <p className="text-sm text-muted-foreground mt-1">所有阶段均已完成</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{stageInfo?.icon}</span>
            当前阶段：{stageInfo?.label}
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-xs flex items-center gap-1 border ${stepConfig.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${stepConfig.dot}`} />
            {stepConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 输入内容 */}
        {inputData && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">阶段输入</p>
            <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-auto max-h-32 text-foreground/80">
              {JSON.stringify(inputData, null, 2)}
            </pre>
          </div>
        )}

        {/* 输出内容 */}
        {outputData && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">阶段输出</p>
            <pre className="text-xs bg-muted/30 rounded-md p-3 overflow-auto max-h-48 text-foreground/80">
              {JSON.stringify(outputData, null, 2)}
            </pre>
          </div>
        )}

        {/* 已有决策 */}
        {currentStep?.decision && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">决策记录</p>
            <p className="text-sm bg-green-500/10 border border-green-500/20 rounded-md p-3 text-green-400">
              {currentStep.decision}
            </p>
          </div>
        )}

        {/* waiting_decision 时显示决策输入框 */}
        {stepStatus === "waiting_decision" && !currentStep?.decision && (
          <div>
            <Label className="text-xs text-muted-foreground">
              请确认或修改本阶段内容
            </Label>
            <Textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="输入你的决策或修改意见..."
              className="mt-1.5 text-sm"
              rows={3}
            />
          </div>
        )}

        {/* 决策备注（running时可选填）*/}
        {stepStatus === "running" && (
          <div>
            <Label className="text-xs text-muted-foreground">
              推进备注（可选）
            </Label>
            <Textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="填写此阶段的备注或决策..."
              className="mt-1.5 text-sm"
              rows={2}
            />
          </div>
        )}

        {/* 推进按钮 */}
        {!isCompleted && stepStatus !== "pending" && (
          <Button
            onClick={handleAdvance}
            disabled={advancing}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {advancing
              ? "处理中..."
              : isLastStage
              ? "完成全部流程"
              : `推进到下一步`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** 历史阶段折叠面板 */
function StepHistoryPanel({ steps }: { steps: AnyRecord[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (stageKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stageKey)) next.delete(stageKey);
      else next.add(stageKey);
      return next;
    });
  };

  const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">全部阶段历史</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {STAGES.map((stage) => {
          const step = stepsMap[stage.key];
          const status = step?.status || "pending";
          const config = STEP_STATUS_CONFIG[status] || STEP_STATUS_CONFIG.pending;
          const isOpen = expanded.has(stage.key);

          const safeJson = (str: string | null | undefined) => {
            if (!str || str === "{}") return null;
            try { return JSON.parse(str); } catch { return null; }
          };

          const inputData = safeJson(step?.input);
          const outputData = safeJson(step?.output);
          const hasContent = inputData || outputData || step?.decision;

          return (
            <div key={stage.key} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() => hasContent && toggle(stage.key)}
              >
                <div className="flex items-center gap-3">
                  <span>{stage.icon}</span>
                  <span className="text-sm font-medium">{stage.label}</span>
                  {step?.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.completedAt).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs flex items-center gap-1 border ${config.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </Badge>
                  {hasContent && (
                    isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isOpen && hasContent && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {inputData && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">输入</p>
                      <pre className="text-xs bg-muted/30 rounded-md p-2 overflow-auto max-h-24 text-foreground/70">
                        {JSON.stringify(inputData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {outputData && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">输出</p>
                      <pre className="text-xs bg-muted/30 rounded-md p-2 overflow-auto max-h-32 text-foreground/70">
                        {JSON.stringify(outputData, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step?.decision && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">决策</p>
                      <p className="text-sm text-green-400 bg-green-500/10 rounded-md p-2">
                        {step.decision}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: articleData, loading, refresh } = useApiGet<AnyRecord>(`/api/articles/${id}`);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [saving, setSaving] = useState(false);

  const article = articleData;
  const steps: AnyRecord[] = article?.steps || [];
  const statusConfig = ARTICLE_STATUS_CONFIG[article?.status] || ARTICLE_STATUS_CONFIG.active;

  const handleTitleEdit = () => {
    setTitleValue(article?.title || "");
    setEditingTitle(true);
  };

  const handleTitleSave = useCallback(async () => {
    if (!titleValue.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/articles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      toast.success("标题已更新");
      setEditingTitle(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  }, [id, titleValue, refresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">文章不存在</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/pipeline")}>
          返回看板
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 自定义页头（支持可编辑标题） */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="text-xl font-bold h-auto py-1 max-w-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <Button size="sm" onClick={handleTitleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold tracking-tight">{article.title}</h1>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                onClick={handleTitleEdit}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className={`text-xs border ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              创建于 {new Date(article.createdAt || article.created_at).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/pipeline")} className="shrink-0">
          ← 返回看板
        </Button>
      </div>

      {/* 阶段进度条 */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <StageProgressBar
            currentStage={article.currentStage || article.current_stage || "topic"}
            steps={steps}
          />
        </CardContent>
      </Card>

      {/* 当前阶段面板 */}
      <CurrentStagePanel
        article={article}
        steps={steps}
        onRefresh={refresh}
      />

      {/* 历史阶段折叠 */}
      <StepHistoryPanel steps={steps} />
    </div>
  );
}
