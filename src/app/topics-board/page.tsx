/**
 * 选题推演板 — 项目列表页
 * /topics-board
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
import { PageHeader } from "@/components/page-header";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STATUS_TABS = [
  { value: "all", label: "全部" },
  { value: "in_progress", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "hold", label: "暂缓" },
];

const STATUS_LABEL: Record<string, string> = {
  in_progress: "进行中",
  done: "已完成",
  hold: "暂缓",
};

const STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  done: "bg-green-500/15 text-green-600 dark:text-green-400",
  hold: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
};

export default function TopicsBoardPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const url =
    statusFilter === "all"
      ? "/api/topics/projects"
      : `/api/topics/projects?status=${statusFilter}`;

  const { data: projects, loading, refresh } = useApiGet<AnyRecord[]>(url);

  const handleCreate = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const title = (formData.get("title") as string)?.trim();
      const description = (formData.get("description") as string)?.trim();

      if (!title) {
        toast.error("项目标题不能为空");
        return;
      }

      setCreating(true);
      try {
        const created = await apiFetch<AnyRecord>("/api/topics/projects", {
          method: "POST",
          body: JSON.stringify({ title, description }),
        });
        toast.success("推演项目已创建");
        setDialogOpen(false);
        router.push(`/topics-board/${created.id}`);
      } catch (err_) {
        toast.error(err_ instanceof Error ? err_.message : "创建失败");
      } finally {
        setCreating(false);
      }
    },
    [router]
  );

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("确定要删除这个推演项目吗？相关卡片和结论也会删除。")) return;
      try {
        await apiFetch(`/api/topics/projects/${id}`, { method: "DELETE" });
        toast.success("已删除");
        refresh();
      } catch (err_) {
        toast.error(err_ instanceof Error ? err_.message : "删除失败");
      }
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="选题推演板"
        description="多维度推演选题，找到最优切口"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90" />}>
              + 新建推演
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建推演项目</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="title">主题标题 *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="例：AI 替代设计师这件事"
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="description">简要说明（选填）</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="这个选题的背景或你的初步想法"
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {creating ? "创建中..." : "创建并进入推演"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* 状态筛选 Tab */}
      <div className="flex gap-1 border-b border-border pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm rounded-t-md transition-colors ${
              statusFilter === tab.value
                ? "border-b-2 border-primary text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 项目列表 */}
      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon="🧩"
          title="还没有推演项目"
          description="点击「新建推演」开始你的第一次选题推演"
        />
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => router.push(`/topics-board/${project.id}`)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{project.title}</h3>
                      <Badge
                        variant="secondary"
                        className={`text-xs shrink-0 ${STATUS_COLOR[project.status] || ""}`}
                      >
                        {STATUS_LABEL[project.status] || project.status}
                      </Badge>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(project.createdAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/topics-board/${project.id}`);
                      }}
                    >
                      打开
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(project.id, e)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
