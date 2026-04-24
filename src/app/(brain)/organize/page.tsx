/**
 * 外脑整理页
 * 接受 ?from=inboxId，把 inbox_item 提升为正式 content_item
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiFetch } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const EI_TYPE_OPTIONS = [
  { value: "ei_opinion", label: "观点" },
  { value: "ei_title", label: "标题灵感" },
  { value: "ei_topic", label: "选题" },
  { value: "ei_product_obs", label: "产品观察" },
  { value: "ei_quote", label: "金句" },
];

// inbox suggestedType → ei_ 类型的建议映射
const SUGGEST_MAP: Record<string, string> = {
  opinion: "ei_opinion",
  title_inspiration: "ei_title",
  topic: "ei_topic",
  product_obs: "ei_product_obs",
  quote: "ei_quote",
};

function OrganizeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");

  const [inboxItem, setInboxItem] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [itemType, setItemType] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [relatedTopic, setRelatedTopic] = useState("");
  const [relatedProduct, setRelatedProduct] = useState("");

  useEffect(() => {
    if (!fromId) return;
    setLoading(true);
    apiFetch<AnyRecord>(`/api/brain/inbox/${fromId}`)
      .then((item) => {
        setInboxItem(item);
        setContent(item.rawContent || "");
        // 建议类型映射
        const suggested = item.quickType || item.suggestedType;
        if (suggested && SUGGEST_MAP[suggested]) {
          setItemType(SUGGEST_MAP[suggested]);
        }
        // 建议标签
        try {
          const tags = JSON.parse(item.suggestedTags || "[]");
          setTagsInput(tags.join(", "));
        } catch {
          // ignore
        }
      })
      .catch(() => toast.error("加载 inbox 条目失败"))
      .finally(() => setLoading(false));
  }, [fromId]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("内容不能为空");
      return;
    }
    if (!itemType) {
      toast.error("请选择外脑类型");
      return;
    }

    const tags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (fromId) {
        // 通过 promote 接口
        await apiFetch("/api/brain/promote", {
          method: "POST",
          body: JSON.stringify({
            inboxId: fromId,
            title,
            itemType,
            tags,
            relatedTopic,
            relatedProduct,
          }),
        });
      } else {
        // 直接新建
        await apiFetch("/api/brain/content-items", {
          method: "POST",
          body: JSON.stringify({
            title,
            content,
            itemType,
            tags,
            relatedTopic,
            relatedProduct,
          }),
        });
      }
      toast.success("已归档到内容库 ✓");
      router.push("/library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">加载中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      {inboxItem && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <span className="text-xs font-medium text-foreground block mb-1">原始记录</span>
          <p className="line-clamp-3 whitespace-pre-wrap">{inboxItem.rawContent}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label>标题（可选）</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这条内容起个标题…"
        />
      </div>

      <div className="space-y-2">
        <Label>正文 *</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="内容…"
          className="min-h-[120px]"
        />
      </div>

      <div className="space-y-2">
        <Label>外脑类型 *</Label>
        <Select value={itemType} onValueChange={(v) => v && setItemType(v)}>
          <SelectTrigger>
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            {EI_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">存储值带 ei_ 前缀，区别于素材库的类型</p>
      </div>

      <div className="space-y-2">
        <Label>标签（用逗号分隔）</Label>
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="观点, AI产品, …"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>关联主题</Label>
          <Input
            value={relatedTopic}
            onChange={(e) => setRelatedTopic(e.target.value)}
            placeholder="如：大模型对比"
          />
        </div>
        <div className="space-y-2">
          <Label>关联产品</Label>
          <Input
            value={relatedProduct}
            onChange={(e) => setRelatedProduct(e.target.value)}
            placeholder="如：Claude"
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={saving || !content.trim() || !itemType}
        className="w-full h-11"
      >
        {saving ? "归档中…" : "归档到内容库"}
      </Button>
    </div>
  );
}

export default function OrganizePage() {
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="整理素材"
        description="把灵感整理成可用的内容资产"
      />
      <div className="mt-6">
        <Suspense fallback={<div className="text-sm text-muted-foreground">加载中…</div>}>
          <OrganizeForm />
        </Suspense>
      </div>
    </div>
  );
}
