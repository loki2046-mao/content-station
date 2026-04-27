/**
 * Pipeline 看板页面
 * Kanban式视图，7列：选题 → 素材收集 → 骨架 → 初稿 → 排版 → 封面 → 待发布
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { toast } from "sonner";

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

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  running:          { label: "处理中",   color: "bg-blue-500/15 text-blue-400 border-blue-500/30",   dot: "bg-blue-400" },
  waiting_decision: { label: "等待决策", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  completed:        { label: "已完成",   color: "bg-green-500/15 text-green-400 border-green-500/30",  dot: "bg-green-400" },
  pending:          { label: "待开始",   color: "bg-muted/60 text-muted-foreground border-border",    dot: "bg-muted-foreground/40" },
  failed:           { label: "失败",     color: "bg-red-500/15 text-red-400 border-red-500/30",      dot: "bg-red-400" },
  skipped:          { label: "已跳过",   color: "bg-muted/60 text-muted-foreground border-border",    dot: "bg-muted-foreground/40" },
};

function ArticleCard({ article, currentStepStatus }: { article: AnyRecord; currentStepStatus: string }) {
  const router = useRouter();
  const config = STEP_STATUS_CONFIG[currentStepStatus] || STEP_STATUS_CONFIG.pending;

  return (
    <div
      onClick={() => router.push(`/pipeline/${article.id}`)}
      className="group cursor-pointer rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-all hover:shadow-sm"
    >
      <p className="text-sm font-medium line-clamp-2 mb-2 group-hover:text-primary/90 transition-colors">
        {article.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={`text-xs px-1.5 py-0 flex items-center gap-1 border ${config.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot} flex-shrink-0`} />
          {config.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(article.createdAt || article.created_at).toLocaleDateString("zh-CN", {
            month: "numeric",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function NewArticleDialog({
  topics,
  onCreated,
}: {
  topics: AnyRecord[];
  onCreated: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const title = (fd.get("title") as string)?.trim();
      const topicId = fd.get("topicId") as string;
      const metadata = (fd.get("metadata") as string)?.trim();

      if (!title) {
        toast.error("标题不能为空");
        return;
      }

      setSubmitting(true);
      try {
        const result = await apiFetch<AnyRecord>("/api/articles", {
          method: "POST",
          body: JSON.stringify({
            title,
            topicId: topicId || null,
            metadata: metadata ? { note: metadata } : {},
          }),
        });
        toast.success("文章创建成功");
        setOpen(false);
        onCreated();
        router.push(`/pipeline/${result.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      } finally {
        setSubmitting(false);
      }
    },
    [router, onCreated]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90" />}>
        + 新建文章
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建文章</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="title">标题 *</Label>
            <Input id="title" name="title" placeholder="输入文章标题" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="topicId">关联选题（可选）</Label>
            <Select name="topicId">
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="不关联选题" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="metadata">备注</Label>
            <Textarea id="metadata" name="metadata" placeholder="目标受众、写作方向等..." className="mt-1" rows={3} />
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitting}>
            {submitting ? "创建中..." : "创建并进入"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PipelinePage() {
  const { data: articleList, loading, refresh } = useApiGet<AnyRecord[]>("/api/articles");
  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");

  // 把文章按 currentStage 分组
  const grouped = (articleList || []).reduce<Record<string, AnyRecord[]>>((acc, a) => {
    const stage = a.currentStage || a.current_stage || "topic";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(a);
    return acc;
  }, {});

  // 获取文章当前step状态（需要从steps里找当前stage的step）
  function getCurrentStepStatus(article: AnyRecord): string {
    const stage = article.currentStage || article.current_stage || "topic";
    // articleList 里的steps是顶层查询没带的，用article.status做降级
    // 实际看板里我们只展示文章状态，步骤状态需要展开详情
    // 简化：active=running, paused=pending, completed=completed
    const statusMap: Record<string, string> = {
      active: "running",
      paused: "pending",
      completed: "completed",
      archived: "skipped",
    };
    return statusMap[article.status] || "pending";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="写作 Pipeline"
        description="追踪每篇文章从选题到发布的全流程"
        actions={
          <NewArticleDialog
            topics={topicsList || []}
            onCreated={refresh}
          />
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          {STAGES.map((s) => (
            <div key={s.key} className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : (articleList?.length ?? 0) === 0 ? (
        <EmptyState
          icon="🗂️"
          title="还没有文章"
          description="点击右上角新建你的第一篇文章，开始写作流程"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const stageArticles = grouped[stage.key] || [];
            return (
              <div key={stage.key} className="flex flex-col gap-2 min-w-[160px]">
                {/* 列头 */}
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-base">{stage.icon}</span>
                  <span className="text-xs font-semibold text-foreground/80">{stage.label}</span>
                  {stageArticles.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-auto">
                      {stageArticles.length}
                    </Badge>
                  )}
                </div>
                {/* 列内容 */}
                <div className="flex flex-col gap-2 min-h-[80px] rounded-lg border border-dashed border-border/50 p-2 bg-muted/10">
                  {stageArticles.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-3">暂无文章</p>
                  ) : (
                    stageArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        currentStepStatus={getCurrentStepStatus(article)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 统计栏 */}
      {(articleList?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm text-muted-foreground">
                共 <strong className="text-foreground">{articleList?.length}</strong> 篇文章
              </span>
              {STAGES.map((s) => {
                const count = (grouped[s.key] || []).length;
                if (!count) return null;
                return (
                  <span key={s.key} className="text-sm text-muted-foreground">
                    {s.label}：<strong className="text-foreground">{count}</strong>
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
