/**
 * 外脑快速记录页
 * 手机优先，专注输入，不复杂导航
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const QUICK_TYPES = [
  { value: "", label: "随便记" },
  { value: "title_inspiration", label: "记标题" },
  { value: "opinion", label: "记观点" },
  { value: "topic", label: "记选题" },
  { value: "product_obs", label: "记产品" },
];

export default function QuickPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [quickType, setQuickType] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("写点什么吧");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/brain/inbox", {
        method: "POST",
        body: JSON.stringify({
          rawContent: content,
          sourceType: "web",
          quickType,
        }),
      });
      toast.success("已记录 ✓", {
        action: {
          label: "查看收件箱",
          onClick: () => router.push("/inbox"),
        },
      });
      setContent("");
      setQuickType("");
      setSavedOnce(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-12 px-4">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* 标题 */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">🧠 随手记</h1>
          <p className="text-sm text-muted-foreground mt-1">先记下来，别管分类</p>
        </div>

        {/* 输入框 */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="随手记下来，先不用想分类…"
          className="min-h-[160px] text-base resize-none"
          autoFocus
        />

        {/* 快捷类型 */}
        <div className="flex flex-wrap gap-2">
          {QUICK_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setQuickType(quickType === t.value ? "" : t.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                quickType === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 保存按钮 */}
        <Button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="w-full h-12 text-base"
        >
          {saving ? "保存中…" : "保存"}
        </Button>

        {/* 底部链接：已记录过才显示去收件箱，否则显示静态提示 */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          {savedOnce ? (
            <>
              <button
                onClick={() => setContent("")}
                className="hover:text-foreground transition-colors"
              >
                再记一条
              </button>
              <span>·</span>
              <Link
                href="/inbox"
                className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                去收件箱 →
              </Link>
            </>
          ) : (
            <Link
              href="/inbox"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
            >
              查看收件箱 →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
