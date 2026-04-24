/**
 * 外脑内容库页面
 * 卡片列表 + Tab 筛选 + 编辑/删除
 */
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const EI_TYPE_TABS = [
  { value: "all", label: "全部" },
  { value: "ei_opinion", label: "观点" },
  { value: "ei_title", label: "标题灵感" },
  { value: "ei_topic", label: "选题" },
  { value: "ei_product_obs", label: "产品观察" },
  { value: "ei_quote", label: "金句" },
];

const TYPE_LABELS: Record<string, string> = {
  ei_opinion: "观点",
  ei_title: "标题灵感",
  ei_topic: "选题",
  ei_product_obs: "产品观察",
  ei_quote: "金句",
};

const TYPE_COLORS: Record<string, string> = {
  ei_opinion: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  ei_title: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ei_topic: "bg-green-500/15 text-green-400 border-green-500/30",
  ei_product_obs: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ei_quote: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded border ${TYPE_COLORS[type] || "bg-muted text-muted-foreground border-border"}`}
    >
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function ContentCard({
  item,
  onEdit,
  onDeleted,
}: {
  item: AnyRecord;
  onEdit: (item: AnyRecord) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const tags: string[] = (() => {
    try { return JSON.parse(item.tags || "[]"); } catch { return []; }
  })();

  const handleDelete = async () => {
    if (!confirm("确认删除？")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/brain/content-items/${item.id}`, { method: "DELETE" });
      toast.success("已删除");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <TypeBadge type={item.itemType} />
        {item.sourceInboxId && (
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
            从 inbox 提升
          </span>
        )}
      </div>

      {item.title && (
        <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
      )}
      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
        {item.content}
      </p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: string) => (
            <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("zh-CN")}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
            编辑
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="即将上线"
            className="opacity-40 cursor-not-allowed"
          >
            → 加入素材库
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            disabled={deleting}
            onClick={handleDelete}
          >
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: AnyRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [itemType, setItemType] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [relatedTopic, setRelatedTopic] = useState("");
  const [relatedProduct, setRelatedProduct] = useState("");

  // 初始化表单
  useState(() => {
    if (!item) return;
    setTitle(item.title || "");
    setContent(item.content || "");
    setItemType(item.itemType || "");
    const tags: string[] = (() => {
      try { return JSON.parse(item.tags || "[]"); } catch { return []; }
    })();
    setTagsInput(tags.join(", "));
    setRelatedTopic(item.relatedTopic || "");
    setRelatedProduct(item.relatedProduct || "");
  });

  const handleSave = async () => {
    if (!item) return;
    if (!content.trim()) { toast.error("内容不能为空"); return; }
    const tags = tagsInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    setSaving(true);
    try {
      await apiFetch(`/api/brain/content-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, content, itemType, tags, relatedTopic, relatedProduct }),
      });
      toast.success("已保存");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑内容</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="可选" />
          </div>
          <div className="space-y-1.5">
            <Label>正文 *</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[100px]" />
          </div>
          <div className="space-y-1.5">
            <Label>类型</Label>
            <Select value={itemType} onValueChange={(v) => v && setItemType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EI_TYPE_TABS.filter((t) => t.value !== "all").map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>标签（逗号分隔）</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>关联主题</Label>
              <Input value={relatedTopic} onChange={(e) => setRelatedTopic(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>关联产品</Label>
              <Input value={relatedProduct} onChange={(e) => setRelatedProduct(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LibraryPage() {
  const [typeTab, setTypeTab] = useState("all");
  const [editItem, setEditItem] = useState<AnyRecord | null>(null);

  const url = typeTab === "all"
    ? "/api/brain/content-items"
    : `/api/brain/content-items?type=${typeTab}`;

  const { data, loading, refresh } = useApiGet<AnyRecord[]>(url);

  const handleSaved = useCallback(() => refresh(), [refresh]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="内容库"
        description="整理好的观点和素材"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/search">
              <Button variant="outline" size="sm">🔍 搜索</Button>
            </Link>
            <Link href="/organize">
              <Button size="sm">+ 新建</Button>
            </Link>
          </div>
        }
      />

      <Tabs value={typeTab} onValueChange={setTypeTab} className="mt-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {EI_TYPE_TABS.map((t) => (
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
          </>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <span className="text-4xl">📭</span>
            <p className="text-muted-foreground font-medium">内容库是空的</p>
            <p className="text-sm text-muted-foreground/70">从收件箱提升，或直接新建一条</p>
            <Link href="/organize"><Button size="sm">新建内容</Button></Link>
          </div>
        ) : (
          data.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={setEditItem}
              onDeleted={refresh}
            />
          ))
        )}
      </div>

      <EditDialog
        item={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
