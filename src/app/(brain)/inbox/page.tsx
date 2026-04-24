/**
 * 外脑收件箱页面
 * 状态 Tab + 卡片列表 + 详情 Dialog
 */
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PageHeader } from "@/components/page-header";
import { SkeletonCard } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STATUS_TABS = [
  { value: "all", label: "全部" },
  { value: "inbox", label: "未整理" },
  { value: "confirmed", label: "已确认" },
  { value: "archived", label: "已归档" },
  { value: "discarded", label: "已废弃" },
];

const TYPE_LABELS: Record<string, string> = {
  title_inspiration: "标题灵感",
  opinion: "观点",
  topic: "选题",
  product_obs: "产品观察",
  quote: "金句",
  raw: "未分类",
};

const TYPE_COLORS: Record<string, string> = {
  title_inspiration: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  opinion: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  topic: "bg-green-500/15 text-green-400 border-green-500/30",
  product_obs: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  quote: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  raw: "bg-muted text-muted-foreground border-border",
};

const STATUS_ACTIONS = [
  { value: "inbox", label: "未整理" },
  { value: "confirmed", label: "已确认" },
  { value: "archived", label: "已归档" },
  { value: "discarded", label: "已废弃" },
];

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded border ${TYPE_COLORS[type] || TYPE_COLORS.raw}`}
    >
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function InboxCard({
  item,
  onClick,
}: {
  item: AnyRecord;
  onClick: () => void;
}) {
  const tags: string[] = (() => {
    try {
      return JSON.parse(item.suggestedTags || "[]");
    } catch {
      return [];
    }
  })();

  const displayType = item.quickType || item.suggestedType || "raw";

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <p className="text-sm text-foreground line-clamp-3 mb-3 whitespace-pre-wrap">
        {item.rawContent}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <TypeBadge type={displayType} />
        {tags.map((tag: string) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </div>
  );
}

function InboxDialog({
  item,
  open,
  onClose,
  onUpdated,
  onDeleted,
}: {
  item: AnyRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  if (!item) return null;

  const handleStatusChange = async (status: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/brain/inbox/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("已更新");
      onUpdated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setUpdating(false);
    }
  };

  const handleTypeChange = async (suggestedType: string) => {
    setUpdating(true);
    try {
      await apiFetch(`/api/brain/inbox/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ suggestedType }),
      });
      toast.success("类型已更新");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确认删除这条记录？")) return;
    setUpdating(true);
    try {
      await apiFetch(`/api/brain/inbox/${item.id}`, { method: "DELETE" });
      toast.success("已删除");
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setUpdating(false);
    }
  };

  const tags: string[] = (() => {
    try {
      return JSON.parse(item.suggestedTags || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>收件箱详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 完整内容 */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap text-foreground">
            {item.rawContent}
          </div>

          {/* 类型修改 */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-16 shrink-0">建议类型</span>
            <Select
              value={item.suggestedType || "raw"}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标签 */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">标签：</span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 时间 */}
          <p className="text-xs text-muted-foreground">
            记录于 {new Date(item.createdAt).toLocaleString("zh-CN")}
          </p>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/organize?from=${item.id}`}
              className="flex-1"
            >
              <Button className="w-full" disabled={updating}>
                提升为正式素材 →
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.filter((s) => s.value !== item.status).map((s) => (
              <Button
                key={s.value}
                variant="outline"
                size="sm"
                disabled={updating}
                onClick={() => handleStatusChange(s.value)}
              >
                标为{s.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              disabled={updating}
              onClick={handleDelete}
            >
              删除
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function InboxPage() {
  const [statusTab, setStatusTab] = useState("all");
  const [selectedItem, setSelectedItem] = useState<AnyRecord | null>(null);

  const url = statusTab === "all" ? "/api/brain/inbox" : `/api/brain/inbox?status=${statusTab}`;
  const { data, loading, refresh } = useApiGet<AnyRecord[]>(url);

  const handleUpdated = useCallback(() => {
    refresh();
    if (selectedItem) {
      setSelectedItem((prev) => prev); // keep dialog open for re-read
    }
  }, [refresh, selectedItem]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="收件箱"
        description="还没整理的灵感都在这里"
        actions={
          <Link href="/quick">
            <Button size="sm">+ 快速记录</Button>
          </Link>
        }
      />

      <Tabs value={statusTab} onValueChange={setStatusTab} className="mt-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-muted-foreground font-medium">收件箱是空的</p>
            <p className="text-sm text-muted-foreground/70">去快速记录页随手记一条吧</p>
            <Link href="/quick"><Button size="sm">去记录</Button></Link>
          </div>
        ) : (
          data.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))
        )}
      </div>

      <InboxDialog
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdated={handleUpdated}
        onDeleted={() => {
          setSelectedItem(null);
          refresh();
        }}
      />
    </div>
  );
}
