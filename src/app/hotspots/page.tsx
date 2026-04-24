/**
 * 热点看板页面
 * 展示自动抓取的热点，支持筛选、采纳为选题、忽略等操作
 */
"use client";

import { useState, useCallback } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/** 来源配置：标签颜色和中文名 */
const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  weibo: { label: "微博", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  zhihu: { label: "知乎", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  baidu: { label: "百度", className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  "36kr": { label: "36kr", className: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  hackernews: { label: "HackerNews", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  x_kol: { label: "KOL", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  x_kol_intl: { label: "国际KOL", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  ai_media: { label: "AI媒体", className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  edu_policy: { label: "教育政策", className: "bg-green-500/20 text-green-400 border-green-500/30" },
};

const SOURCE_OPTIONS = [
  { value: "all", label: "全部来源" },
  { value: "weibo", label: "微博" },
  { value: "zhihu", label: "知乎" },
  { value: "baidu", label: "百度" },
  { value: "36kr", label: "36kr" },
  { value: "hackernews", label: "HackerNews" },
  { value: "x_kol", label: "KOL" },
  { value: "x_kol_intl", label: "国际KOL" },
  { value: "ai_media", label: "AI媒体" },
  { value: "edu_policy", label: "教育政策" },
];

/** 来源 Badge */
function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] || { label: source, className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" };
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

/** 状态 Badge */
function HotspotStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: "新热点", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    reviewed: { label: "已读", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
    adopted: { label: "已采纳", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    dismissed: { label: "已忽略", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const config = map[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

/** 热度指标 */
function HeatIndicator({ score }: { score: number }) {
  if (!score) return null;
  const formatted = score >= 10000 ? `${(score / 10000).toFixed(1)}万` : String(score);
  return (
    <span className="text-xs text-orange-400 flex items-center gap-0.5">
      🔥 {formatted}
    </span>
  );
}

export default function HotspotsPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [fetching, setFetching] = useState(false);

  // 构建查询 URL
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
  if (statusTab && statusTab !== "all") params.set("status", statusTab);
  params.set("days", "7");
  const queryStr = params.toString();

  const { data: hotspotsList, loading, refresh } = useApiGet<AnyRecord[]>(
    `/api/hotspots?${queryStr}`
  );

  // 手动触发抓取
  const handleFetch = useCallback(async () => {
    setFetching(true);
    try {
      const result = await apiFetch<AnyRecord>("/api/hotspots", {
        method: "POST",
        body: JSON.stringify({ autoFetch: true }),
      });
      toast.success(`抓取完成：新增 ${result.inserted} 条，去重 ${result.duplicates} 条`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "抓取失败");
    } finally {
      setFetching(false);
    }
  }, [refresh]);

  // 采纳为选题
  const handleAdopt = useCallback(
    async (id: string) => {
      try {
        const result = await apiFetch<AnyRecord>(`/api/hotspots/${id}/adopt`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        toast.success("已采纳为选题");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "采纳失败");
      }
    },
    [refresh]
  );

  // 忽略
  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/hotspots/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "dismissed" }),
        });
        toast.success("已忽略");
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    },
    [refresh]
  );

  // 标记已读
  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/hotspots/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "reviewed" }),
        });
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    },
    [refresh]
  );

  // 统计
  const totalNew = hotspotsList?.filter((h) => h.status === "new").length ?? 0;

  // 上次抓取时间
  const lastFetchedAt = hotspotsList?.length
    ? hotspotsList.reduce((latest, h) => {
        const t = h.fetchedAt || h.fetched_at;
        return t > latest ? t : latest;
      }, "")
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="热点看板"
        description="自动抓取的行业热点，发现值得写的选题"
        actions={
          <div className="flex items-center gap-3">
            {lastFetchedAt && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                上次抓取：{new Date(lastFetchedAt).toLocaleString("zh-CN")}
              </span>
            )}
            <Button
              onClick={handleFetch}
              disabled={fetching}
              className="bg-primary hover:bg-primary/90"
            >
              {fetching ? "抓取中..." : "🔄 立即抓取"}
            </Button>
          </div>
        }
      />

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索热点..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v || "all")}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="来源筛选" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 状态 Tabs */}
      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList>
          <TabsTrigger value="all">
            全部 {hotspotsList?.length ? `(${hotspotsList.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="new">
            新热点 {totalNew ? `(${totalNew})` : ""}
          </TabsTrigger>
          <TabsTrigger value="adopted">已采纳</TabsTrigger>
          <TabsTrigger value="dismissed">已忽略</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 热点列表 */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !hotspotsList?.length ? (
        <EmptyState
          icon="🔥"
          title="暂无热点"
          description="点击右上角「立即抓取」获取最新热点，或等待下次自动抓取"
        />
      ) : (
        <div className="grid gap-3">
          {hotspotsList.map((item) => {
            const tags: string[] = (() => {
              try {
                return JSON.parse(item.tags || "[]");
              } catch {
                return [];
              }
            })();
            const heatScore = item.heatScore ?? item.heat_score ?? 0;
            const isNew = item.status === "new";
            const isAdopted = item.status === "adopted";
            const isDismissed = item.status === "dismissed";

            return (
              <Card
                key={item.id}
                className={`transition-colors ${
                  isNew
                    ? "border-primary/20 hover:border-primary/40"
                    : isDismissed
                    ? "opacity-60 hover:opacity-80"
                    : "hover:border-primary/30"
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 标题行 */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium truncate max-w-[70%]">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                        </h3>
                        <SourceBadge source={item.source} />
                        <HotspotStatusBadge status={item.status} />
                        <HeatIndicator score={heatScore} />
                      </div>

                      {/* 摘要 */}
                      {item.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {item.summary}
                        </p>
                      )}

                      {/* 底部信息行 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.author && (
                          <span className="text-xs text-muted-foreground">
                            👤 {item.author}
                          </span>
                        )}
                        {tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs opacity-70"
                          >
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(item.fetchedAt || item.fetched_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {!isAdopted && !isDismissed && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 bg-primary hover:bg-primary/90"
                            onClick={() => handleAdopt(item.id)}
                          >
                            采纳为选题
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            onClick={() => handleDismiss(item.id)}
                          >
                            忽略
                          </Button>
                          {isNew && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => handleMarkRead(item.id)}
                            >
                              标记已读
                            </Button>
                          )}
                        </>
                      )}
                      {isAdopted && item.adoptedTopicId && (
                        <a href={`/topics/${item.adoptedTopicId || item.adopted_topic_id}`}>
                          <Button size="sm" variant="outline" className="text-xs h-7">
                            查看选题
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
