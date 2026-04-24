/**
 * 骨架生成页面
 * 选择选题+切口 → 生成结构化文章骨架
 * 使用后台任务模式：发出请求后轮询结果，切走不丢失
 */
"use client";

import { useState, useMemo } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { useBackgroundTask } from "@/hooks/use-background-task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function OutlinePage() {
  const [topicId, setTopicId] = useState("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
  const [selectedAngleIndex, setSelectedAngleIndex] = useState("");
  const [angle, setAngle] = useState("");
  const [currentResult, setCurrentResult] = useState<AnyRecord | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");
  const { data: historyList, refresh: refreshHistory } = useApiGet<AnyRecord[]>("/api/outlines");
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
    generateUrl: "/api/outlines/generate",
    statusUrl: "/api/outlines/status",
    resumeId,
    onDone: (result) => {
      setCurrentResult(result as AnyRecord);
      setCurrentId(taskId);
      setEditing(false);
      refreshHistory();
      toast.success("骨架生成完成");
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

  // 生成骨架
  const handleGenerate = () => {
    if (!topicId || !selectedTopic) {
      toast.error("请选择一个选题");
      return;
    }

    setCurrentResult(null);
    setCurrentId(null);
    setEditing(false);
    trigger({
      topicId,
      topic: selectedTopic.title,
      angle: angle || undefined,
      analysisId: selectedAnalysisId || undefined,
    });
  };

  // 进入编辑模式
  const startEdit = () => {
    setEditText(JSON.stringify(currentResult, null, 2));
    setEditing(true);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!currentId) return;
    try {
      const editedResult = JSON.parse(editText);
      await apiFetch(`/api/outlines/${currentId}`, {
        method: "PATCH",
        body: JSON.stringify({ editedResult }),
      });
      setCurrentResult(editedResult);
      setEditing(false);
      refreshHistory();
      toast.success("骨架已保存");
    } catch (e) {
      toast.error("JSON 格式有误，请检查");
    }
  };

  // 保存骨架内容到素材库
  const handleSaveToMaterials = async (content: string, type: string, key: string) => {
    if (savingKeys.has(key)) return;
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await apiFetch("/api/materials", {
        method: "POST",
        body: JSON.stringify({
          content,
          type,
          sourceType: "outline",
          sourceId: currentId || "",
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
      <PageHeader title="骨架生成" description="选择选题和切口，AI 帮你搭建完整的文章结构" />

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

          {/* 切口分析选择器 */}
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

          {/* 具体切口选择 */}
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

          <Button
            onClick={handleGenerate}
            disabled={generating || !modelConfigured || !topicId}
            className="bg-primary hover:bg-primary/90"
          >
            {generating ? "生成中..." : "🏗️ 生成骨架"}
          </Button>
          {!modelConfigured && (
            <p className="text-xs text-muted-foreground">⚠️ 请先在设置中配置模型 API Key</p>
          )}
        </CardContent>
      </Card>

      {/* 生成中 */}
      {generating && <GeneratingOverlay text="AI 正在搭建文章骨架..." />}

      {/* 当前结果 */}
      {currentResult && !editing && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">骨架结果</h2>
            <Button variant="outline" size="sm" onClick={startEdit}>✏️ 编辑</Button>
          </div>

          <div className="space-y-4">
            {/* 核心矛盾 */}
            {currentResult.coreTension && (
              <Card className="border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-primary mb-1 font-medium">🎯 核心矛盾</p>
                      <p className="text-sm">{currentResult.coreTension}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={savingKeys.has("core")}
                      onClick={() => handleSaveToMaterials(currentResult.coreTension, "opinion", "core")}
                    >
                      {savingKeys.has("core") ? "..." : "💾"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 开头 */}
            {currentResult.opening && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">📖 开头方式：{currentResult.opening.method}</p>
                      <p className="text-sm">{currentResult.opening.description}</p>
                      {currentResult.opening.example && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                          {currentResult.opening.example}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={savingKeys.has("opening")}
                      onClick={() => handleSaveToMaterials(
                        `开头方式：${currentResult.opening.method}\n${currentResult.opening.description}${currentResult.opening.example ? `\n示例：${currentResult.opening.example}` : ""}`,
                        "opening",
                        "opening"
                      )}
                    >
                      {savingKeys.has("opening") ? "..." : "💾"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 主体部分 */}
            {currentResult.sections?.map((section: AnyRecord, i: number) => {
              const sectionKey = `section-${i}`;
              const sectionContent = [
                `${section.title}（${section.contentType}）`,
                ...(section.keyPoints || []).map((p: string) => `• ${p}`),
                section.materialSuggestion ? `素材建议：${section.materialSuggestion}` : "",
              ].filter(Boolean).join("\n");

              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        第 {i + 1} 部分：{section.title}
                        <Badge variant="outline" className="text-xs">{section.contentType}</Badge>
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        disabled={savingKeys.has(sectionKey)}
                        onClick={() => handleSaveToMaterials(sectionContent, "outline", sectionKey)}
                      >
                        {savingKeys.has(sectionKey) ? "..." : "💾"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {section.keyPoints && (
                      <ul className="space-y-1">
                        {section.keyPoints.map((point: string, j: number) => (
                          <li key={j} className="text-sm text-muted-foreground">• {point}</li>
                        ))}
                      </ul>
                    )}
                    {section.materialSuggestion && (
                      <p className="text-xs text-primary/80">💡 {section.materialSuggestion}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* 结尾 */}
            {currentResult.ending && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">🔚 结尾方式：{currentResult.ending.method}</p>
                      <p className="text-sm">{currentResult.ending.description}</p>
                      {currentResult.ending.example && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                          {currentResult.ending.example}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={savingKeys.has("ending")}
                      onClick={() => handleSaveToMaterials(
                        `结尾方式：${currentResult.ending.method}\n${currentResult.ending.description}${currentResult.ending.example ? `\n示例：${currentResult.ending.example}` : ""}`,
                        "closing",
                        "ending"
                      )}
                    >
                      {savingKeys.has("ending") ? "..." : "💾"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 编辑模式 */}
      {editing && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">编辑骨架</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>取消</Button>
              <Button size="sm" onClick={saveEdit} className="bg-primary hover:bg-primary/90">保存</Button>
            </div>
          </div>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
        </div>
      )}

      {/* 历史记录 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">历史骨架记录</h2>
        {!historyList?.length ? (
          <EmptyState icon="📭" title="暂无历史记录" />
        ) : (
          <div className="space-y-3">
            {historyList.map((record) => {
              const isGenerating = record.status === "generating";
              const isError = record.status === "error";
              const result = isGenerating || isError
                ? {}
                : (typeof record.result === "string" ? JSON.parse(record.result) : record.result);
              return (
                <Card
                  key={record.id}
                  className={`cursor-pointer transition-colors ${isGenerating ? "opacity-70 border-amber-500/30" : "hover:border-primary/30"}`}
                  onClick={() => {
                    if (isGenerating) return;
                    const edited = record.editedResult || record.edited_result;
                    const displayResult = edited ? (typeof edited === "string" ? JSON.parse(edited) : edited) : result;
                    setCurrentResult(displayResult);
                    setCurrentId(record.id);
                    setEditing(false);
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        {isGenerating ? (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            生成中...
                          </Badge>
                        ) : isError ? (
                          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                            失败
                          </Badge>
                        ) : (
                          <>
                            <p className="text-sm font-medium">{result?.coreTension || "骨架记录"}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {result?.sections?.length || 0} 个段落 · {record.modelUsed || record.model_used} ·{" "}
                              {new Date(record.createdAt || record.created_at).toLocaleString("zh-CN")}
                            </p>
                          </>
                        )}
                      </div>
                      {(record.editedResult || record.edited_result) && (
                        <Badge variant="outline" className="text-xs">已编辑</Badge>
                      )}
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
