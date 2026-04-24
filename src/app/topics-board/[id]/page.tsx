/**
 * 选题推演板 — 推演详情页
 * /topics-board/[id]
 */
"use client";

import { useState, use, useCallback, useEffect } from "react";
import Link from "next/link";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STATUS_OPTIONS = [
  { value: "in_progress", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "hold", label: "暂缓" },
];

const ZONES = [
  { type: "angle", label: "可写切口", icon: "✂️", desc: "哪个角度值得写" },
  { type: "platform", label: "适合平台", icon: "📱", desc: "发哪里最合适" },
  { type: "spread", label: "传播判断", icon: "🔥", desc: "传播潜力分析" },
  { type: "next_step", label: "下一步建议", icon: "🎯", desc: "现在该怎么做" },
];

const CARD_STATUS_STYLES: Record<string, string> = {
  preferred: "border-green-500/60 bg-green-500/5 dark:border-green-400/50",
  discarded: "opacity-40",
  active: "",
};

// ---------- 卡片组件 ----------
function TopicCard({
  card,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  card: AnyRecord;
  onUpdate: (id: string, updates: AnyRecord) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editContent, setEditContent] = useState(card.content || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    await onUpdate(card.id, { title: editTitle, content: editContent });
    setSaving(false);
    setEditing(false);
  };

  const handleStatusToggle = async (status: string) => {
    const newStatus = card.card_status === status ? "active" : status;
    await onUpdate(card.id, { cardStatus: newStatus });
  };

  const handlePin = async () => {
    await onUpdate(card.id, { isPinned: card.is_pinned ? 0 : 1 });
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        CARD_STATUS_STYLES[card.card_status] || ""
      } ${card.is_pinned ? "ring-1 ring-primary/30" : ""}`}
    >
      {editing ? (
        <div className="space-y-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="font-medium"
            placeholder="卡片标题"
          />
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            placeholder="卡片内容"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave}>
              {saving ? "保存..." : "保存"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-medium text-sm leading-snug flex-1">
              {card.is_pinned ? "📌 " : ""}
              {card.title}
            </p>
            {card.source_type === "generated" && (
              <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                AI
              </span>
            )}
          </div>
          {card.content && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">{card.content}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            <button
              onClick={() => handleStatusToggle("preferred")}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                card.card_status === "preferred"
                  ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950"
                  : "border-border text-muted-foreground hover:border-green-400 hover:text-green-600"
              }`}
            >
              {card.card_status === "preferred" ? "✓ 最优" : "标为最优"}
            </button>
            <button
              onClick={() => handleStatusToggle("discarded")}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                card.card_status === "discarded"
                  ? "border-border text-muted-foreground bg-muted"
                  : "border-border text-muted-foreground hover:border-red-300 hover:text-red-500"
              }`}
            >
              暂不采用
            </button>
            <button
              onClick={handlePin}
              className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {card.is_pinned ? "取消置顶" : "置顶"}
            </button>
            <button
              onClick={() => {
                setEditTitle(card.title);
                setEditContent(card.content || "");
                setEditing(true);
              }}
              className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              编辑
            </button>
            <button
              onClick={() => onDelete(card.id)}
              className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
            >
              删除
            </button>
            {!isFirst && (
              <button
                onClick={() => onMoveUp(card.id)}
                className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                ↑
              </button>
            )}
            {!isLast && (
              <button
                onClick={() => onMoveDown(card.id)}
                className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                ↓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Zone 组件 ----------
function ZonePanel({
  zone,
  cards,
  projectTitle,
  onCardUpdate,
  onCardDelete,
  onCardAdd,
  onReorder,
  onGenerate,
}: {
  zone: (typeof ZONES)[0];
  cards: AnyRecord[];
  projectTitle: string;
  onCardUpdate: (id: string, updates: AnyRecord) => Promise<void>;
  onCardDelete: (id: string) => Promise<void>;
  onCardAdd: (zoneType: string, title: string, content: string) => Promise<void>;
  onReorder: (zoneType: string, newOrder: AnyRecord[]) => void;
  onGenerate: (zoneType: string) => Promise<void>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);

  const zoneCards = cards
    .filter((c) => c.zone_type === zone.type)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned;
      return a.sort_order - b.sort_order;
    });

  const handleAdd = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    await onCardAdd(zone.type, addTitle, addContent);
    setAdding(false);
    setAddTitle("");
    setAddContent("");
    setAddOpen(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate(zone.type);
    setGenerating(false);
  };

  const handleMoveUp = (cardId: string) => {
    const idx = zoneCards.findIndex((c) => c.id === cardId);
    if (idx <= 0) return;
    const newOrder = [...zoneCards];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    onReorder(zone.type, newOrder);
  };

  const handleMoveDown = (cardId: string) => {
    const idx = zoneCards.findIndex((c) => c.id === cardId);
    if (idx < 0 || idx >= zoneCards.length - 1) return;
    const newOrder = [...zoneCards];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    onReorder(zone.type, newOrder);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border">
        <div>
          <span className="mr-1.5">{zone.icon}</span>
          <span className="font-semibold text-sm">{zone.label}</span>
          <p className="text-xs text-muted-foreground mt-0.5">{zone.desc}</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={generating}
            onClick={handleGenerate}
            className="text-xs h-7 px-2"
          >
            {generating ? "生成中..." : "✨ AI展开"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAddOpen(true)}
            className="text-xs h-7 px-2"
          >
            + 新增
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 pt-3 pb-4 space-y-2 min-h-[120px]">
        {zoneCards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            点击 AI展开 或 新增 添加卡片
          </p>
        )}
        {zoneCards.map((card, idx) => (
          <TopicCard
            key={card.id}
            card={card}
            onUpdate={onCardUpdate}
            onDelete={onCardDelete}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            isFirst={idx === 0}
            isLast={idx === zoneCards.length - 1}
          />
        ))}
      </CardContent>

      {/* 新增卡片 dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增{zone.label}卡片</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>标题 *</Label>
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="卡片标题"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>内容说明（选填）</Label>
              <Textarea
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="详细说明这张卡片"
                className="mt-1"
                rows={3}
              />
            </div>
            <Button
              disabled={adding || !addTitle.trim()}
              onClick={handleAdd}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {adding ? "添加中..." : "添加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- 结论面板 ----------
function SummaryPanel({
  projectId,
  cards,
  summary,
  onSummaryChange,
  onSave,
  onExport,
  saving,
  exporting,
}: {
  projectId: string;
  cards: AnyRecord[];
  summary: AnyRecord;
  onSummaryChange: (key: string, val: string) => void;
  onSave: () => void;
  onExport: () => void;
  saving: boolean;
  exporting: boolean;
}) {
  // 从 preferred 卡片聚合建议
  const getPreferredTitle = (zoneType: string) => {
    const preferred = cards.find(
      (c) => c.zone_type === zoneType && c.card_status === "preferred"
    );
    return preferred?.title || "";
  };

  const suggestedAngle = getPreferredTitle("angle");
  const suggestedPlatform = getPreferredTitle("platform");
  const suggestedSpread = getPreferredTitle("spread");
  const suggestedNext = getPreferredTitle("next_step");

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">📋 推演结论</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "保存中..." : "保存结论"}
          </Button>
          <Button
            size="sm"
            disabled={exporting}
            onClick={onExport}
            className="bg-primary hover:bg-primary/90"
          >
            {exporting ? "导出中..." : "导出到外脑"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            key: "recommendedAngle",
            label: "推荐切口",
            placeholder: suggestedAngle || "从可写切口中选择最优的",
          },
          {
            key: "recommendedPlatform",
            label: "推荐平台",
            placeholder: suggestedPlatform || "最适合发布的平台",
          },
          {
            key: "spreadSummary",
            label: "核心传播点",
            placeholder: suggestedSpread || "这篇文章最可能的传播点",
          },
          {
            key: "nextAction",
            label: "下一步动作",
            placeholder: suggestedNext || "现在应该做什么",
          },
        ].map((field) => (
          <div key={field.key}>
            <Label className="text-xs">{field.label}</Label>
            <Textarea
              value={summary[field.key] || ""}
              onChange={(e) => onSummaryChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="mt-1 text-sm"
              rows={2}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 主页面 ----------
export default function TopicsBoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const [exporting, setExporting] = useState(false);

  const {
    data: project,
    loading: projectLoading,
    refresh: refreshProject,
  } = useApiGet<AnyRecord>(`/api/topics/projects/${id}`);

  const {
    data: allCards,
    loading: cardsLoading,
    refresh: refreshCards,
  } = useApiGet<AnyRecord[]>(`/api/topics/cards?projectId=${id}`);

  const { data: summaryData, refresh: refreshSummary } =
    useApiGet<AnyRecord>(`/api/topics/summaries/${id}`);

  const [summaryFields, setSummaryFields] = useState<AnyRecord>({});

  // 当 summaryData 加载完毕时同步到本地 state
  useEffect(() => {
    if (summaryData) {
      setSummaryFields({
        recommendedAngle: summaryData.recommended_angle || summaryData.recommendedAngle || "",
        recommendedPlatform: summaryData.recommended_platform || summaryData.recommendedPlatform || "",
        spreadSummary: summaryData.spread_summary || summaryData.spreadSummary || "",
        nextAction: summaryData.next_action || summaryData.nextAction || "",
      });
    }
  }, [summaryData]);

  // 更新项目状态
  const handleStatusChange = async (status: string) => {
    try {
      await apiFetch(`/api/topics/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refreshProject();
    } catch {
      toast.error("状态更新失败");
    }
  };

  // 更新项目标题
  const handleTitleSave = async () => {
    if (!titleInput.trim()) return;
    try {
      await apiFetch(`/api/topics/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: titleInput }),
      });
      setEditingTitle(false);
      refreshProject();
    } catch {
      toast.error("标题更新失败");
    }
  };

  // 更新卡片
  const handleCardUpdate = useCallback(
    async (cardId: string, updates: AnyRecord) => {
      try {
        await apiFetch(`/api/topics/cards/${cardId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        refreshCards();
      } catch {
        toast.error("更新卡片失败");
      }
    },
    [refreshCards]
  );

  // 删除卡片
  const handleCardDelete = useCallback(
    async (cardId: string) => {
      if (!confirm("确定删除这张卡片？")) return;
      try {
        await apiFetch(`/api/topics/cards/${cardId}`, { method: "DELETE" });
        refreshCards();
      } catch {
        toast.error("删除卡片失败");
      }
    },
    [refreshCards]
  );

  // 添加卡片
  const handleCardAdd = useCallback(
    async (zoneType: string, title: string, content: string) => {
      try {
        await apiFetch("/api/topics/cards", {
          method: "POST",
          body: JSON.stringify({ projectId: id, zoneType, title, content }),
        });
        refreshCards();
        toast.success("卡片已添加");
      } catch {
        toast.error("添加卡片失败");
      }
    },
    [id, refreshCards]
  );

  // AI 展开
  const handleGenerate = useCallback(
    async (zoneType: string) => {
      if (!project?.title) return;
      try {
        const generated = await apiFetch<AnyRecord[]>("/api/topics/generate", {
          method: "POST",
          body: JSON.stringify({ projectId: id, zoneType, topic: project.title }),
        });
        refreshCards();
        toast.success(`已生成 ${Array.isArray(generated) ? generated.length : 0} 张卡片`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI 展开失败");
      }
    },
    [id, project, refreshCards]
  );

  // 重新排序
  const handleReorder = useCallback(
    async (zoneType: string, newOrder: AnyRecord[]) => {
      // 先乐观更新（通过 refresh 重新拉数据）
      const updates = newOrder.map((card, idx) => ({ id: card.id, sortOrder: idx }));
      try {
        await apiFetch("/api/topics/cards/reorder", {
          method: "POST",
          body: JSON.stringify({ updates }),
        });
        refreshCards();
      } catch {
        toast.error("排序保存失败");
        refreshCards();
      }
    },
    [refreshCards]
  );

  // 保存结论
  const handleSaveSummary = async () => {
    setSavingSummary(true);
    try {
      await apiFetch(`/api/topics/summaries/${id}`, {
        method: "PUT",
        body: JSON.stringify(summaryFields),
      });
      refreshSummary();
      toast.success("结论已保存");
    } catch {
      toast.error("保存结论失败");
    } finally {
      setSavingSummary(false);
    }
  };

  // 导出
  const handleExport = async () => {
    setExporting(true);
    try {
      await apiFetch("/api/topics/export", {
        method: "POST",
        body: JSON.stringify({ projectId: id }),
      });
      refreshSummary();
      toast.success("已导出到外脑收件箱，可在 /brain/inbox 查看");
    } catch {
      toast.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!project) {
    return <EmptyState icon="❌" title="项目不存在" description="可能已被删除" />;
  }

  const cards = allCards || [];

  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* 返回 */}
          <Link
            href="/topics-board"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← 返回列表
          </Link>

          {/* 标题 */}
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="h-7 text-sm font-semibold"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleTitleSave}>
                  确定
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditingTitle(false)}
                >
                  取消
                </Button>
              </div>
            ) : (
              <button
                className="font-semibold text-sm truncate block max-w-full hover:text-primary transition-colors"
                onClick={() => {
                  setTitleInput(project.title);
                  setEditingTitle(true);
                }}
                title="点击编辑标题"
              >
                {project.title}
              </button>
            )}
          </div>

          {/* 状态 */}
          <Select value={project.status || "in_progress"} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 导出 */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2 shrink-0"
            disabled={savingSummary}
            onClick={handleSaveSummary}
          >
            保存结论
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs px-2 shrink-0 bg-primary hover:bg-primary/90"
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting ? "导出中..." : "导出"}
          </Button>
        </div>
      </div>

      {/* 主区域 */}
      <div className="flex-1 p-4">
        {cardsLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            加载卡片中...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ZONES.map((zone) => (
              <ZonePanel
                key={zone.type}
                zone={zone}
                cards={cards}
                projectTitle={project.title}
                onCardUpdate={handleCardUpdate}
                onCardDelete={handleCardDelete}
                onCardAdd={handleCardAdd}
                onReorder={handleReorder}
                onGenerate={handleGenerate}
              />
            ))}
          </div>
        )}

        {/* 底部结论面板 */}
        <SummaryPanel
          projectId={id}
          cards={cards}
          summary={summaryFields}
          onSummaryChange={(key, val) =>
            setSummaryFields((prev: AnyRecord) => ({ ...prev, [key]: val }))
          }
          onSave={handleSaveSummary}
          onExport={handleExport}
          saving={savingSummary}
          exporting={exporting}
        />
      </div>
    </div>
  );
}
