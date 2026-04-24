/**
 * 切口分析页面
 * 输入话题 → 调用 AI → 展示6个切口方向
 * 使用后台任务模式：发出请求后轮询结果，切走不丢失
 */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { useBackgroundTask } from "@/hooks/use-background-task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const SUITABILITY_COLORS: Record<string, string> = {
  high: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function AnalyzePage() {
  const [topicId, setTopicId] = useState("");
  const [inputText, setInputText] = useState("");
  const [currentResult, setCurrentResult] = useState<AnyRecord[] | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [savingAngles, setSavingAngles] = useState<Set<number>>(new Set());

  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");
  const { data: historyList, refresh: refreshHistory } = useApiGet<AnyRecord[]>("/api/analyses");
  const { data: settingsData } = useApiGet<AnyRecord>("/api/settings");

  const modelConfigured = !!settingsData?.settings?.api_key;

  // 检查是否有进行中的任务（组件挂载时恢复轮询）
  const resumeId = useMemo(() => {
    if (!historyList) return null;
    const generating = historyList.find((r) => r.status === "generating");
    return generating?.id || null;
  }, [historyList]);

  // 后台任务 hook
  const { status: taskStatus, trigger, taskId } = useBackgroundTask({
    generateUrl: "/api/analyze",
    statusUrl: "/api/analyze/status",
    resumeId,
    onDone: (result) => {
      const parsed = Array.isArray(result) ? result : [];
      setCurrentResult(parsed);
      setCurrentAnalysisId(taskId);
      refreshHistory();
      toast.success("切口分析完成");
    },
    onError: (error) => {
      refreshHistory();
      toast.error(error || "分析失败");
    },
  });

  const generating = taskStatus === "generating";

  // 选择选题时自动填入文本
  const handleTopicSelect = (id: string | null) => {
    setTopicId(id || "");
    if (id && id !== "_direct") {
      const topic = topicsList?.find((t) => t.id === id);
      if (topic) {
        setInputText(topic.title + (topic.summary ? `\n${topic.summary}` : ""));
      }
    }
  };

  // 生成切口分析
  const handleGenerate = () => {
    if (!inputText.trim()) {
      toast.error("请输入要分析的话题");
      return;
    }

    setCurrentResult(null);
    trigger({
      topicId: topicId && topicId !== "_direct" ? topicId : null,
      inputText: inputText.trim(),
    });
  };

  // 保存切口到素材库
  const handleSaveToMaterial = async (angle: AnyRecord, index: number) => {
    setSavingAngles((prev) => new Set(prev).add(index));
    try {
      const content = `【${angle.name}】${angle.description}\n适合度: ${angle.suitability === "high" ? "高" : angle.suitability === "medium" ? "中等" : "较低"}\n文章类型: ${angle.articleType}${angle.suitabilityReason ? `\n原因: ${angle.suitabilityReason}` : ""}${angle.expandPoints?.length ? `\n展开方向:\n${angle.expandPoints.map((p: string) => `• ${p}`).join("\n")}` : ""}`;
      await apiFetch("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          content,
          type: "opinion",
          tags: ["切口分析", angle.articleType].filter(Boolean),
          topicIds: topicId && topicId !== "_direct" ? [topicId] : [],
        }),
      });
      toast.success(`"${angle.name}" 已保存到素材库`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingAngles((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="切口分析" description="输入话题，AI 帮你找到6个不同的写作切口方向" />

      {/* 输入区 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label>选择已有选题（可选）</Label>
            <Select value={topicId} onValueChange={handleTopicSelect}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择选题或直接输入" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_direct">直接输入</SelectItem>
                {topicsList?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>话题内容</Label>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入你想分析的话题，比如：AI 正在替代初级程序员的工作"
              className="mt-1"
              rows={4}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !modelConfigured}
            className="bg-primary hover:bg-primary/90"
          >
            {generating ? "分析中..." : "🔍 开始分析"}
          </Button>
          {!modelConfigured && (
            <p className="text-xs text-muted-foreground">⚠️ 请先在设置中配置模型 API Key</p>
          )}
        </CardContent>
      </Card>

      {/* 生成中 */}
      {generating && <GeneratingOverlay text="AI 正在分析切口方向..." />}

      {/* 当前结果 */}
      {currentResult && (
        <div>
          <h2 className="text-lg font-semibold mb-3">分析结果</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentResult.map((angle, i) => (
              <Card key={i} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {angle.name}
                    <Badge variant="outline" className={SUITABILITY_COLORS[angle.suitability] || ""}>
                      {angle.suitability === "high" ? "高适合" : angle.suitability === "medium" ? "中等" : "较低"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{angle.description}</p>
                  <p className="text-xs text-muted-foreground">{angle.suitabilityReason}</p>
                  <Badge variant="outline" className="text-xs">{angle.articleType}</Badge>
                  {angle.expandPoints && (
                    <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                      {angle.expandPoints.map((point: string, j: number) => (
                        <li key={j}>• {point}</li>
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs mt-2"
                    disabled={savingAngles.has(i)}
                    onClick={() => handleSaveToMaterial(angle, i)}
                  >
                    {savingAngles.has(i) ? "保存中..." : "💾 保存到素材库"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">历史分析记录</h2>
        {!historyList?.length ? (
          <EmptyState icon="📭" title="暂无历史记录" />
        ) : (
          <div className="space-y-3">
            {historyList.map((record) => {
              const isGenerating = record.status === "generating";
              const isError = record.status === "error";
              const result = isGenerating || isError
                ? []
                : (typeof record.result === "string" ? JSON.parse(record.result) : record.result);
              const isActive = currentAnalysisId === record.id;
              return (
                <Card
                  key={record.id}
                  className={`cursor-pointer transition-colors ${isActive ? "border-primary/50" : isGenerating ? "border-amber-500/30 opacity-70" : "hover:border-primary/30"}`}
                  onClick={() => {
                    if (isGenerating) return;
                    if (isActive) {
                      setCurrentResult(null);
                      setCurrentAnalysisId(null);
                    } else {
                      setCurrentResult(Array.isArray(result) ? result : []);
                      setCurrentAnalysisId(record.id);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal flex items-center gap-2">
                      <span className="truncate flex-1">{record.inputText || record.input_text}</span>
                      {isGenerating && (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 shrink-0">
                          生成中...
                        </Badge>
                      )}
                      {isError && (
                        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 shrink-0">
                          失败
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(record.createdAt || record.created_at).toLocaleString("zh-CN")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(result) && result.map((angle: AnyRecord, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {angle.name}
                        </Badge>
                      ))}
                    </div>
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
