/**
 * 标题生成页面
 * 选择选题+切口+上下文 → 生成3-5套完整标题方案
 */
"use client";

import { useState } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, GeneratingOverlay } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STYLE_COLORS: Record<string, string> = {
  好奇心型: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  情绪共鸣型: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  观点输出型: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  反常识型: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  轻梗型: "bg-green-500/20 text-green-400 border-green-500/30",
  深度感型: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function TitlesPage() {
  const [topicId, setTopicId] = useState("");
  const [angle, setAngle] = useState("");
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnyRecord[] | null>(null);

  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");
  const { data: historyList, refresh: refreshHistory } = useApiGet<AnyRecord[]>("/api/titles");
  const { data: settingsData } = useApiGet<AnyRecord>("/api/settings");

  const modelConfigured = !!settingsData?.settings?.api_key;
  const selectedTopic = topicsList?.find((t) => t.id === topicId);

  // 生成标题
  const handleGenerate = async () => {
    if (!topicId || !selectedTopic) {
      toast.error("请选择一个选题");
      return;
    }

    setGenerating(true);
    setCurrentResult(null);
    try {
      const res = await apiFetch<AnyRecord>("/api/titles/generate", {
        method: "POST",
        body: JSON.stringify({
          topicId,
          topic: selectedTopic.title,
          angle: angle || undefined,
          context: context || undefined,
        }),
      });
      const result = typeof res.result === "string" ? JSON.parse(res.result) : res.result;
      setCurrentResult(result);
      refreshHistory();
      toast.success("标题生成完成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  // 收藏标题
  const handleFavorite = async (titleRecordId: string, titleId: string) => {
    try {
      const record = historyList?.find((h) => h.id === titleRecordId);
      if (!record) return;
      const currentFavs: string[] = typeof record.favorites === "string"
        ? JSON.parse(record.favorites)
        : record.favorites || [];
      const newFavs = currentFavs.includes(titleId)
        ? currentFavs.filter((f) => f !== titleId)
        : [...currentFavs, titleId];

      await apiFetch(`/api/titles/${titleRecordId}`, {
        method: "PATCH",
        body: JSON.stringify({ favorites: newFavs }),
      });
      refreshHistory();
      toast.success(newFavs.includes(titleId) ? "已收藏" : "已取消收藏");
    } catch (e) {
      toast.error("操作失败");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="标题生成" description="选择选题和切口，AI 生成多套完整的标题方案" />

      {/* 输入区 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label>选择选题 *</Label>
            <Select value={topicId} onValueChange={(v) => setTopicId(v || "")}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择一个选题" />
              </SelectTrigger>
              <SelectContent>
                {topicsList?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>写作切口（可选）</Label>
            <Input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="比如：从个人体验角度切入"
              className="mt-1"
            />
          </div>

          <div>
            <Label>补充上下文（可选）</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="补充信息，比如大纲、摘要、关键观点等"
              className="mt-1"
              rows={3}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !modelConfigured || !topicId}
            className="bg-primary hover:bg-primary/90"
          >
            {generating ? "生成中..." : "✍️ 生成标题"}
          </Button>
          {!modelConfigured && (
            <p className="text-xs text-muted-foreground">⚠️ 请先在设置中配置模型 API Key</p>
          )}
        </CardContent>
      </Card>

      {/* 生成中 */}
      {generating && <GeneratingOverlay text="AI 正在构思标题方案..." />}

      {/* 当前结果 */}
      {currentResult && (
        <div>
          <h2 className="text-lg font-semibold mb-3">生成结果 · {currentResult.length} 套方案</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {currentResult.map((title, i) => (
              <Card key={i} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    方案 {i + 1}
                    <Badge variant="outline" className={STYLE_COLORS[title.style] || "text-xs"}>
                      {title.style}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">主标题</p>
                    <p className="font-medium">{title.mainTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">副标题</p>
                    <p className="text-sm">{title.subtitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">封面大字</p>
                    <p className="text-lg font-bold text-primary">{title.coverText}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">朋友圈导语</p>
                    <p className="text-sm italic">{title.shareText}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">历史标题方案</h2>
        {!historyList?.length ? (
          <EmptyState icon="📭" title="暂无历史记录" />
        ) : (
          <div className="space-y-3">
            {historyList.map((record) => {
              const result = typeof record.result === "string" ? JSON.parse(record.result) : record.result;
              const favorites: string[] = typeof record.favorites === "string"
                ? JSON.parse(record.favorites)
                : record.favorites || [];

              return (
                <Card key={record.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {Array.isArray(result) ? result.length : 0} 套方案 ·{" "}
                        {new Date(record.createdAt || record.created_at).toLocaleString("zh-CN")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Array.isArray(result) && result.map((title: AnyRecord, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{title.mainTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">{title.subtitle}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFavorite(record.id, title.id || String(i))}
                          className="shrink-0"
                        >
                          {favorites.includes(title.id || String(i)) ? "⭐" : "☆"}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
