/**
 * 素材库页面
 * 管理所有素材：观点、金句、标题灵感、例子、开头句、结尾句
 * 以及来自测评的内容素材
 */
"use client";

import { useState, useCallback } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { MaterialTypeBadge } from "@/components/status-badge";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const PAGE_SIZE = 10;

const TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "opinion", label: "观点" },
  { value: "quote", label: "金句" },
  { value: "title_inspiration", label: "标题灵感" },
  { value: "example", label: "例子" },
  { value: "opening", label: "开头句" },
  { value: "closing", label: "结尾句" },
  { value: "prompt", label: "提示词" },
];

const CREATE_TYPE_OPTIONS = TYPE_OPTIONS.filter((t) => t.value !== "all");

const RATING_LABELS: Record<string, string> = {
  success: "✅ 通过",
  fail: "❌ 失败",
  crash: "💥 崩溃",
  exceed: "🌟 超预期",
};

/** 页码导航，最多显示7个页码 */
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Build visible page numbers (at most 7)
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // always show first, last, current ±2, and ellipsis
    const start = Math.max(2, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    pages.push(1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-2"
      >
        ← 上一页
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p as number)}
            className="min-w-[32px]"
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-2"
      >
        下一页 →
      </Button>
    </div>
  );
}

export default function MaterialsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState("opinion");

  // 构建查询
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  const queryStr = params.toString();

  const { data: materialsData, loading, refresh } = useApiGet<{
    items: AnyRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>(`/api/materials?${queryStr}`);

  const materialsList = materialsData?.items ?? [];
  const totalPages = materialsData?.totalPages ?? 1;
  const total = materialsData?.total ?? 0;

  // 测评素材
  const { data: evalMaterialsList, loading: evalLoading, refresh: refreshEvalMaterials } =
    useApiGet<AnyRecord[]>("/api/eval/content-materials?source_type=eval_result");

  // 切换类型筛选时重置到第1页
  const handleTypeChange = (v: string | null) => {
    setTypeFilter(v || "all");
    setPage(1);
  };

  // 搜索时重置到第1页
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  // 新建素材
  const handleCreate = useCallback(
    async (formData: FormData) => {
      const content = formData.get("content") as string;
      const type = formData.get("type") as string;

      if (!content.trim()) {
        toast.error("素材内容不能为空");
        return;
      }

      try {
        await apiFetch("/api/materials", {
          method: "POST",
          body: JSON.stringify({ content, type }),
        });
        toast.success("素材创建成功");
        setDialogOpen(false);
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    },
    [refresh]
  );

  // 删除素材
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条素材吗？")) return;
    try {
      await apiFetch(`/api/materials/${id}`, { method: "DELETE" });
      toast.success("素材已删除");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  // 开始编辑
  const startEdit = (material: AnyRecord) => {
    setEditingId(material.id);
    setEditContent(material.content);
    setEditType(material.type);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await apiFetch(`/api/materials/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent, type: editType }),
      });
      toast.success("素材已更新");
      setEditingId(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="素材库"
        description="收集和管理写作素材：观点、金句、例子、灵感"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90" />}>
              + 新建素材
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建素材</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="type">素材类型 *</Label>
                  <Select name="type" defaultValue="opinion">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="content">素材内容 *</Label>
                  <Textarea id="content" name="content" placeholder="写下你的素材" className="mt-1" rows={5} />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90">创建</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            全部素材 {total > 0 ? `(${total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="eval">
            测评素材 {evalMaterialsList ? `(${evalMaterialsList.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ===== 通用素材 Tab ===== */}
        <TabsContent value="general" className="space-y-4">
          {/* 筛选栏 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="搜索素材..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={typeFilter} onValueChange={handleTypeChange}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="类型筛选" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 素材列表 */}
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !materialsList?.length ? (
            <EmptyState
              icon="📝"
              title="还没有素材"
              description="点击右上角开始收集你的第一条素材"
            />
          ) : (
            <>
              <div className="grid gap-3">
                {materialsList.map((material) => (
                  <Card key={material.id} className="hover:border-primary/20 transition-colors">
                    <CardContent className="pt-4 pb-4">
                      {editingId === material.id ? (
                        // 编辑模式
                        <div className="space-y-3">
                          <Select value={editType} onValueChange={(v) => setEditType(v || "opinion")}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CREATE_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={4}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} className="bg-primary hover:bg-primary/90">保存</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
                          </div>
                        </div>
                      ) : (
                        // 展示模式
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <MaterialTypeBadge type={material.type} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(material.createdAt || material.created_at).toLocaleDateString("zh-CN")}
                              </span>
                              {material.sourceType && (
                                <span className="text-xs text-muted-foreground/60">
                                  {material.sourceType === "obsidian" ? "📓" : material.sourceType === "wechat_article" ? "📰" : ""}
                                  {material.sourceTitle || ""}
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{material.content}</p>
                            {/* 查看原文链接 */}
                            {material.sourceId && (
                              <div className="mt-2">
                                <a
                                  href={material.sourceId}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary/70 hover:text-primary underline-offset-2 hover:underline"
                                >
                                  查看原文 →
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => startEdit(material)}>✏️</Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(material.id)}>🗑️</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 分页导航 */}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />

              {/* 分页信息 */}
              {total > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  共 {total} 条，第 {page}/{totalPages} 页
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== 测评素材 Tab ===== */}
        <TabsContent value="eval" className="space-y-4">
          {evalLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : !evalMaterialsList?.length ? (
            <EmptyState
              icon="🧪"
              title="还没有测评素材"
              description="在测评工作区点击「→ 转素材」，测试记录会出现在这里"
            />
          ) : (
            <div className="grid gap-4">
              {evalMaterialsList.map((m: AnyRecord) => (
                <Card key={m.id} className="hover:border-primary/20 transition-colors">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    {/* 顶部元信息 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.testSubject && (
                            <Badge variant="outline" className="text-xs font-medium">
                              {m.testSubject}
                            </Badge>
                          )}
                          {m.resultSummary && (
                            <span className="text-xs">
                              {RATING_LABELS[m.resultSummary] || m.resultSummary}
                            </span>
                          )}
                          {m.evalGoal && (
                            <span className="text-xs text-muted-foreground">目标：{m.evalGoal}</span>
                          )}
                        </div>
                        {m.taskDescription && (
                          <p className="text-xs text-muted-foreground">{m.taskDescription}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(m.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>

                    {/* 亮点 / 问题 */}
                    {(m.highlights || m.issues) && (
                      <div className="space-y-1">
                        {m.highlights && (
                          <p className="text-sm">
                            <span className="text-green-500 mr-1">✓</span>{m.highlights}
                          </p>
                        )}
                        {m.issues && (
                          <p className="text-sm">
                            <span className="text-red-500 mr-1">✗</span>{m.issues}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 标题方向 */}
                    {Array.isArray(m.titleDirections) && m.titleDirections.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">📌 标题方向</p>
                        <ul className="space-y-1">
                          {m.titleDirections.map((t: string, i: number) => (
                            <li key={i} className="text-sm bg-muted/50 rounded px-2 py-1">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 写作角度 */}
                    {Array.isArray(m.articleAngles) && m.articleAngles.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">✍️ 写作角度</p>
                        <ul className="space-y-1">
                          {m.articleAngles.map((a: string, i: number) => (
                            <li key={i} className="text-sm bg-muted/50 rounded px-2 py-1">{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 可提炼观点 */}
                    {m.extractableInsight && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">💡 观点：</span>
                        {m.extractableInsight}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
