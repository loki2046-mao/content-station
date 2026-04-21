/**
 * 选题池页面
 * 展示所有选题，支持搜索、标签筛选、状态筛选、新建
 */
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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
import { StatusBadge } from "@/components/status-badge";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unprocessed", label: "未处理" },
  { value: "analyzed", label: "已分析" },
  { value: "drafted", label: "已成稿" },
  { value: "published", label: "已发布" },
  { value: "paused", label: "暂缓" },
];

export default function TopicsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // 构建查询 URL
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
  const queryStr = params.toString();

  const { data: topicsList, loading, refresh } = useApiGet<AnyRecord[]>(
    `/api/topics${queryStr ? `?${queryStr}` : ""}`
  );
  const { data: settingsData } = useApiGet<AnyRecord>("/api/settings");
  const allTags: AnyRecord[] = settingsData?.tags || [];

  // 新建选题
  const handleCreate = useCallback(
    async (formData: FormData) => {
      const title = formData.get("title") as string;
      const source = formData.get("source") as string;
      const summary = formData.get("summary") as string;

      if (!title.trim()) {
        toast.error("选题标题不能为空");
        return;
      }

      try {
        await apiFetch("/api/topics", {
          method: "POST",
          body: JSON.stringify({ title, source, summary }),
        });
        toast.success("选题创建成功");
        setDialogOpen(false);
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="选题池"
        description="管理你的所有公众号选题"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90" />}>
              + 新建选题
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建选题</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="title">选题标题 *</Label>
                  <Input id="title" name="title" placeholder="输入选题标题" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="source">来源</Label>
                  <Input id="source" name="source" placeholder="链接或来源说明" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="summary">摘要</Label>
                  <Textarea id="summary" name="summary" placeholder="简要描述这个选题" className="mt-1" rows={3} />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">创建</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索选题..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 选题列表 */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !topicsList?.length ? (
        <EmptyState
          icon="📋"
          title="还没有选题"
          description="点击右上角新建你的第一个选题"
        />
      ) : (
        <div className="grid gap-3">
          {topicsList.map((topic) => {
            const tags = (() => {
              try { return JSON.parse(topic.tags || "[]"); } catch { return []; }
            })();
            return (
              <Link key={topic.id} href={`/topics/${topic.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{topic.title}</h3>
                          <StatusBadge status={topic.status} />
                        </div>
                        {topic.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{topic.summary}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {tags.map((tag: string) => {
                            const tagInfo = allTags.find((t) => t.name === tag);
                            return (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                                style={tagInfo ? { borderColor: tagInfo.color, color: tagInfo.color } : {}}
                              >
                                {tag}
                              </Badge>
                            );
                          })}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(topic.createdAt || topic.created_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
