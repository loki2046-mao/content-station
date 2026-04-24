/**
 * 外脑搜索页
 * 实时搜索 inbox + content_items，结果分块展示
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { useDebounce } from "@/hooks/use-debounce";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface SearchResult {
  inbox: AnyRecord[];
  content: AnyRecord[];
  total: number;
}

const TYPE_LABELS: Record<string, string> = {
  title_inspiration: "标题灵感",
  opinion: "观点",
  topic: "选题",
  product_obs: "产品观察",
  quote: "金句",
  raw: "未分类",
  ei_opinion: "观点",
  ei_title: "标题灵感",
  ei_topic: "选题",
  ei_product_obs: "产品观察",
  ei_quote: "金句",
};

function ResultCard({
  item,
  source,
}: {
  item: AnyRecord;
  source: "inbox" | "content";
}) {
  const text = source === "inbox" ? item.rawContent : (item.title || item.content);
  const subText = source === "content" && item.title ? item.content : "";
  const type = source === "inbox"
    ? (item.quickType || item.suggestedType || "raw")
    : item.itemType;

  const href = source === "inbox" ? `/inbox?id=${item.id}` : `/library?id=${item.id}`;

  return (
    <Link href={href}>
      <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
            {TYPE_LABELS[type] || type}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
        <p className="text-sm text-foreground line-clamp-2 whitespace-pre-wrap">{text}</p>
        {subText && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{subText}</p>
        )}
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 400);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResult(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const data = await apiFetch<SearchResult>(`/api/brain/search?q=${encodeURIComponent(q)}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="搜索"
        description="搜索收件箱和内容库"
      />

      <div className="mt-4 relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键词…"
          className="text-base h-11"
          autoFocus
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            搜索中…
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          {/* 收件箱结果 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              收件箱中 · {result.inbox.length} 条
            </h2>
            {result.inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">无结果</p>
            ) : (
              <div className="space-y-2">
                {result.inbox.map((item) => (
                  <ResultCard key={item.id} item={item} source="inbox" />
                ))}
              </div>
            )}
          </section>

          {/* 内容库结果 */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              内容库中 · {result.content.length} 条
            </h2>
            {result.content.length === 0 ? (
              <p className="text-sm text-muted-foreground">无结果</p>
            ) : (
              <div className="space-y-2">
                {result.content.map((item) => (
                  <ResultCard key={item.id} item={item} source="content" />
                ))}
              </div>
            )}
          </section>

          {result.total === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              没找到包含「{query}」的内容
            </p>
          )}
        </div>
      )}

      {!result && !searching && !query && (
        <p className="text-center text-sm text-muted-foreground mt-16">
          输入关键词开始搜索
        </p>
      )}
    </div>
  );
}
