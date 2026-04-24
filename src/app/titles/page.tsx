/**
 * 标题生成页面
 * 选择选题+切口+上下文 → 生成3-5套完整标题方案
 * 使用后台任务模式：发出请求后轮询结果，切走不丢失
 */
"use client";

import { useState, useMemo } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { useBackgroundTask } from "@/hooks/use-background-task";
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
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
  const [selectedAngleIndex, setSelectedAngleIndex] = useState("");
  const [angle, setAngle] = useState("");
  const [context, setContext] = useState("");
  const [currentResult, setCurrentResult] = useState<AnyRecord[] | null>(null);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");
  const { data: historyList, refresh: refreshHistory } = useApiGet<AnyRecord[]>("/api/titles");
  const { data: settingsData } = useApiGet<AnyRecord>("/api/settings");
  const { data: topicAnalyses } = useApiGet<AnyRecord[]>(
    topicId ? `/api/analyses?topicId=${topicId}` : null
  );

  const modelConfigured = !!settingsData?.settings?.api_key;
  const selectedTopic = topicsList?.find((t) => t.id === topicId);

  // 检查是否有进行中的任务
  const resumeId = useMemo(() => {
    if (!historyList) return null;
    const generating = historyList.find((r) => r.status === "generating");
    return generating?.id || null;
  }, [historyList]);

  // 后台任务 hook
  const { status: taskStatus, trigger, taskId } = useBackgroundTask({
    generateUrl: "/api/titles/generate",
    statusUrl: "/api/titles/status",
    resumeId,
    onDone: (result) => {
      const parsed = Array.isArray(result) ? result : [];
      setCurrentResult(parsed);
      setCurrentRecordId(taskId);
      refreshHistory();
      toast.success("标题生成完成");
    },
    onError: (error) => {
      refreshHistory();
      toast.error(error || "生成失败");
    },
  });

  const generating = taskStatus === "generating";

  // 解析当前选中分析的切口列表
  const currentAngles: AnyRecord[] = (() => {
    if (!selectedAnalysisId || !topicAnalyses) return [];
    const analysis = topicAnalyses.find((a) => a.id === selectedAnalysisId);
    if (!analysis) return [];
    try {
      const result = typeof analysis.result === "string" ? JSON.parse(analysis.result) : analysis.result;
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  })();

  // 选择选题时重置分析相关状态
  const handleTopicChange = (v: string | null) => {
    setTopicId(v || "");
    setSelectedAnalysisId("");
    setSelectedAngleIndex("");
    setAngle("");
  };

  // 选择切口时自动填入角度
  const handleAngleSelect = (v: string | null) => {
    setSelectedAngleIndex(v || "");
    if (v && v !== "_manual") {
      const idx = parseInt(v);
      const a = currentAngles[idx];
      if (a) {
        setAngle(`${a.name}：${a.description}`);
      }
    }
  };

  // 生成标题
  const handleGenerate = () => {
    if (!topicId || !selectedTopic) {
      toast.error("请选择一个选题");
      return;
    }

    setCurrentResult(null);
    trigger({
      topicId,
      topic: selectedTopic.title,
      angle: angle || undefined,
      context: context || undefined,
      analysisId: selectedAnalysisId || undefined,
    });
  };

  // 展开/折叠历史方案
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 保存标题方案到素材库
  const handleSaveToMaterials = async (title: AnyRecord, recordId: string) => {
    const key = `${recordId}-${title.id || title.mainTitle}`;
    if (savingKeys.has(key)) return;
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      const lines = [
        `主标题：${title.mainTitle}`,
        `副标题：${title.subtitle}`,
        `风格：${title.style}`,
        title.coverText ? `封面大字：${title.coverText}` : "",
        title.shareText ? `朋友圈导语：${title.shareText}` : "",
      ].filter(Boolean).join("\n");

      await apiFetch("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          content: lines,
          type: "title_inspiration",
          sourceType: "title",
          sourceId: recordId,
        }),
      });
      toast.success("已保存到素材库");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
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
            <Select value={topicId} onValueChange={handleTopicChange}>
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

          {/* 切口分析选择器：选了选题且有分析记录时显示 */}
          {topicId && topicAnalyses && topicAnalyses.length > 0 && (
            <div>
              <Label>选择切口分析（可选）</Label>
              <Select value={selectedAnalysisId} onValueChange={(v) => { setSelectedAnalysisId(v || ""); setSelectedAngleIndex(""); setAngle(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择一次分析记录" />
                </SelectTrigger>
                <SelectContent>
                  {topicAnalyses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {new Date(a.createdAt || a.created_at).toLocaleString("zh-CN")} · {a.modelUsed || a.model_used}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 具体切口选择：选了分析记录且有切口时显示 */}
          {selectedAnalysisId && currentAngles.length > 0 && (
            <div>
              <Label>选择切口方向（可选）</Label>
              <Select value={selectedAngleIndex} onValueChange={handleAngleSelect}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择一个切口" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_manual">手动输入</SelectItem>
                  {currentAngles.map((a, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {a.name} — {a.suitability === "high" ? "高适合" : a.suitability === "medium" ? "中等" : "较低"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>写作切口（可选）</Label>
            <Input
              value={angle}
              onChange={(e) => { setAngle(e.target.value); setSelectedAngleIndex("_manual"); }}
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
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingKeys.has(`current-${i}`)}
                    onClick={() => handleSaveToMaterials(title, currentRecordId || "current")}
                  >
                    {savingKeys.has(`current-${i}`) ? "保存中..." : "💾 保存到素材库"}
                  </Button>
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
              const isGenerating = record.status === "generating";
              const isError = record.status === "error";
              const result = isGenerating || isError
                ? []
                : (typeof record.result === "string" ? JSON.parse(record.result) : record.result);

              return (
                <Card key={record.id} className={isGenerating ? "opacity-70 border-amber-500/30" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isGenerating ? (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            生成中...
                          </Badge>
                        ) : isError ? (
                          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                            失败
                          </Badge>
                        ) : (
                          `${Array.isArray(result) ? result.length : 0} 套方案`
                        )}
                        {" · "}
                        {new Date(record.createdAt || record.created_at).toLocaleString("zh-CN")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Array.isArray(result) && result.map((title: AnyRecord, i: number) => {
                      const expandKey = `${record.id}-${i}`;
                      const isExpanded = expandedKeys.has(expandKey);
                      const saveKey = `${record.id}-${title.id || title.mainTitle}`;

                      return (
                        <div key={i} className="rounded-lg border border-transparent hover:border-muted transition-colors">
                          <div
                            className="flex items-start gap-2 p-2 cursor-pointer hover:bg-muted/50 rounded-lg"
                            onClick={() => toggleExpand(expandKey)}
                          >
                            <span className="text-xs mt-0.5 shrink-0">{isExpanded ? "▾" : "▸"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{title.mainTitle}</p>
                              <p className="text-xs text-muted-foreground truncate">{title.subtitle}</p>
                            </div>
                            {title.style && (
                              <Badge variant="outline" className={`shrink-0 text-xs ${STYLE_COLORS[title.style] || ""}`}>
                                {title.style}
                              </Badge>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="px-6 pb-3 space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">主标题</p>
                                <p className="text-sm font-medium">{title.mainTitle}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">副标题</p>
                                <p className="text-sm">{title.subtitle}</p>
                              </div>
                              {title.coverText && (
                                <div>
                                  <p className="text-xs text-muted-foreground">封面大字</p>
                                  <p className="text-base font-bold text-primary">{title.coverText}</p>
                                </div>
                              )}
                              {title.shareText && (
                                <div>
                                  <p className="text-xs text-muted-foreground">朋友圈导语</p>
                                  <p className="text-sm italic">{title.shareText}</p>
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={savingKeys.has(saveKey)}
                                onClick={(e) => { e.stopPropagation(); handleSaveToMaterials(title, record.id); }}
                                className="mt-1"
                              >
                                {savingKeys.has(saveKey) ? "保存中..." : "💾 保存到素材库"}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
