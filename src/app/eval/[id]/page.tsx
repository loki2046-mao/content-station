/**
 * 测评项目详情（工作区）
 * /eval/[id]
 */
"use client";

import { useState, useEffect, use } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { SkeletonCard, EmptyState, Spinner } from "@/components/loading";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const MODEL_TYPE_LABELS: Record<string, string> = {
  text: "📝 文本",
  image: "🖼️ 图片",
  video: "🎬 视频",
  agent: "🤖 Agent",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-500",
  medium: "text-yellow-500",
  hard: "text-red-500",
};

const RATING_LABELS: Record<string, string> = {
  success: "✅ 通过",
  fail: "❌ 失败",
  crash: "💥 崩溃",
  exceed: "🌟 超预期",
};

export default function EvalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: projectData, loading: projectLoading, refresh: refreshProject } =
    useApiGet<AnyRecord>(`/api/eval/projects/${id}`);

  const { data: casesData, loading: casesLoading, refresh: refreshCases } =
    useApiGet<AnyRecord[]>(`/api/eval/cases?project_id=${id}`);

  const { data: resultsData, loading: resultsLoading, refresh: refreshResults } =
    useApiGet<AnyRecord[]>(`/api/eval/test-results?project_id=${id}`);

  // Case 生成状态
  const [generatingCases, setGeneratingCases] = useState(false);

  // Prompt 相关
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptModelTarget, setPromptModelTarget] = useState("");
  const { data: promptsData, refresh: refreshPrompts } = useApiGet<AnyRecord[]>(
    selectedCaseId ? `/api/eval/prompts?case_id=${selectedCaseId}` : null
  );

  // 新建结果
  const [newResultCaseId, setNewResultCaseId] = useState("");
  const [newResultModel, setNewResultModel] = useState("");
  const [newResultRating, setNewResultRating] = useState("success");
  const [newResultHighlights, setNewResultHighlights] = useState("");
  const [newResultIssues, setNewResultIssues] = useState("");
  const [newResultWorthWriting, setNewResultWorthWriting] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  // 编辑结果
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editResultData, setEditResultData] = useState<AnyRecord>({});

  const project = projectData?.project;
  const cases = casesData || [];

  // AI 生成 Case
  const handleGenerateCases = async () => {
    if (!project) return;
    setGeneratingCases(true);
    try {
      const dimensions = cases.map((c: AnyRecord) => c.dimensionId).filter(Boolean);
      await apiFetch("/api/eval/cases/generate", {
        method: "POST",
        body: JSON.stringify({
          projectId: id,
          goalType: project.goalType,
          modelType: project.modelType,
          dimensions,
          count: 5,
        }),
      });
      toast.success("Case 生成成功");
      refreshCases();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGeneratingCases(false);
    }
  };

  // 生成 Prompt
  const handleGeneratePrompt = async () => {
    if (!selectedCaseId) {
      toast.error("请先选择一个 Case");
      return;
    }
    setGeneratingPrompt(true);
    try {
      await apiFetch("/api/eval/prompts/generate", {
        method: "POST",
        body: JSON.stringify({ caseId: selectedCaseId, modelTarget: promptModelTarget }),
      });
      toast.success("Prompt 生成成功");
      refreshPrompts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // 保存测试结果
  const handleSaveResult = async () => {
    if (!newResultCaseId) {
      toast.error("请选择 Case");
      return;
    }
    setSavingResult(true);
    try {
      await apiFetch("/api/eval/test-results", {
        method: "POST",
        body: JSON.stringify({
          caseId: newResultCaseId,
          modelUsed: newResultModel,
          rating: newResultRating,
          highlights: newResultHighlights,
          issues: newResultIssues,
          worthWriting: newResultWorthWriting,
        }),
      });
      toast.success("结果已记录");
      setNewResultCaseId("");
      setNewResultModel("");
      setNewResultHighlights("");
      setNewResultIssues("");
      setNewResultWorthWriting(false);
      refreshResults();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingResult(false);
    }
  };

  // 更新结果
  const handleUpdateResult = async (resultId: string) => {
    try {
      await apiFetch(`/api/eval/test-results/${resultId}`, {
        method: "PATCH",
        body: JSON.stringify(editResultData),
      });
      toast.success("已更新");
      setEditingResultId(null);
      refreshResults();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!project) {
    return <EmptyState icon="❌" title="项目不存在" description="该项目可能已被删除" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${MODEL_TYPE_LABELS[project.modelType] || project.modelType}${project.goalType ? " · " + project.goalType : ""}`}
      />

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Case 列表 ({cases.length})</TabsTrigger>
          <TabsTrigger value="prompts">Prompt 生成</TabsTrigger>
          <TabsTrigger value="results">测试记录 ({resultsData?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Case 列表 */}
        <TabsContent value="cases" className="space-y-4">
          <div className="flex justify-end">
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleGenerateCases}
              disabled={generatingCases}
            >
              {generatingCases ? (
                <><Spinner className="h-4 w-4 mr-2" />生成中...</>
              ) : (
                "✨ AI 生成 Case"
              )}
            </Button>
          </div>

          {casesLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : !cases.length ? (
            <EmptyState
              icon="📋"
              title="还没有测试 Case"
              description="点击「AI 生成 Case」自动生成测试用例"
            />
          ) : (
            <div className="grid gap-3">
              {cases.map((c: AnyRecord) => (
                <Card key={c.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{c.title}</h3>
                          <span className={cn("text-xs font-medium", DIFFICULTY_COLORS[c.difficulty])}>
                            {c.difficulty}
                          </span>
                        </div>
                        {c.description && (
                          <p className="text-sm text-muted-foreground">{c.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Prompt 生成 */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">生成 Prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>选择 Case</Label>
                <Select value={selectedCaseId} onValueChange={(v) => setSelectedCaseId(v || "")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择一个 Case" />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map((c: AnyRecord) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>目标模型（可选）</Label>
                <Input
                  value={promptModelTarget}
                  onChange={(e) => setPromptModelTarget(e.target.value)}
                  placeholder="例如：GPT-4o、Claude 3.5 Sonnet..."
                  className="mt-1"
                />
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={handleGeneratePrompt}
                disabled={generatingPrompt || !selectedCaseId}
              >
                {generatingPrompt ? (
                  <><Spinner className="h-4 w-4 mr-2" />生成中...</>
                ) : (
                  "✨ 生成 Prompt"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Prompt 列表 */}
          {selectedCaseId && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                该 Case 下的 Prompt
              </h3>
              {!promptsData?.length ? (
                <p className="text-sm text-muted-foreground">暂无 Prompt，点击上方生成</p>
              ) : (
                promptsData.map((p: AnyRecord) => (
                  <Card key={p.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-2">
                        {p.modelTarget && (
                          <Badge variant="outline" className="text-xs">{p.modelTarget}</Badge>
                        )}
                        <span className={cn("text-xs", DIFFICULTY_COLORS[p.difficulty || "medium"])}>
                          {p.difficulty}
                        </span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 rounded p-3">
                        {p.content}
                      </pre>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* 测试记录 */}
        <TabsContent value="results" className="space-y-4">
          {/* 新建记录表单 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">记录测试结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Case</Label>
                  <Select value={newResultCaseId} onValueChange={(v) => setNewResultCaseId(v || "")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="选择 Case" />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.map((c: AnyRecord) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>使用模型</Label>
                  <Input
                    value={newResultModel}
                    onChange={(e) => setNewResultModel(e.target.value)}
                    placeholder="例如：GPT-4o"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>评级</Label>
                <Select value={newResultRating} onValueChange={(v) => setNewResultRating(v || "success")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">✅ 通过</SelectItem>
                    <SelectItem value="fail">❌ 失败</SelectItem>
                    <SelectItem value="crash">💥 崩溃</SelectItem>
                    <SelectItem value="exceed">🌟 超预期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>亮点</Label>
                <Textarea
                  value={newResultHighlights}
                  onChange={(e) => setNewResultHighlights(e.target.value)}
                  placeholder="该模型表现好的地方..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>问题</Label>
                <Textarea
                  value={newResultIssues}
                  onChange={(e) => setNewResultIssues(e.target.value)}
                  placeholder="该模型表现差的地方..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="worth-writing"
                  checked={newResultWorthWriting}
                  onChange={(e) => setNewResultWorthWriting(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="worth-writing">值得写文章</Label>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={handleSaveResult}
                disabled={savingResult}
              >
                {savingResult ? "保存中..." : "记录结果"}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* 结果列表 */}
          {resultsLoading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : !resultsData?.length ? (
            <EmptyState icon="📊" title="还没有测试记录" description="在上方填写并记录测试结果" />
          ) : (
            <div className="grid gap-3">
              {resultsData.map((r: AnyRecord) => {
                const isEditing = editingResultId === r.id;
                const caseInfo = cases.find((c: AnyRecord) => c.id === r.caseId);
                return (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {caseInfo?.title || r.caseId}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {RATING_LABELS[r.rating] || r.rating}
                          </Badge>
                          {r.worthWriting ? (
                            <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                              值得写
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{r.modelUsed}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              if (isEditing) {
                                setEditingResultId(null);
                              } else {
                                setEditingResultId(r.id);
                                setEditResultData({
                                  rating: r.rating,
                                  highlights: r.highlights,
                                  issues: r.issues,
                                  worthWriting: r.worthWriting,
                                  extractableInsight: r.extractableInsight,
                                });
                              }
                            }}
                          >
                            {isEditing ? "取消" : "编辑"}
                          </Button>
                        </div>
                      </div>

                      {!isEditing ? (
                        <>
                          {r.highlights && (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-green-500 mr-1">✓</span>{r.highlights}
                            </p>
                          )}
                          {r.issues && (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-red-500 mr-1">✗</span>{r.issues}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="space-y-3 pt-2">
                          <div>
                            <Label className="text-xs">评级</Label>
                            <Select
                              value={editResultData.rating}
                              onValueChange={(v) => setEditResultData((d) => ({ ...d, rating: v || "success" }))}
                            >
                              <SelectTrigger className="mt-1 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="success">✅ 通过</SelectItem>
                                <SelectItem value="fail">❌ 失败</SelectItem>
                                <SelectItem value="crash">💥 崩溃</SelectItem>
                                <SelectItem value="exceed">🌟 超预期</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">亮点</Label>
                            <Textarea
                              value={editResultData.highlights || ""}
                              onChange={(e) => setEditResultData((d) => ({ ...d, highlights: e.target.value }))}
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">问题</Label>
                            <Textarea
                              value={editResultData.issues || ""}
                              onChange={(e) => setEditResultData((d) => ({ ...d, issues: e.target.value }))}
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">可提炼观点</Label>
                            <Textarea
                              value={editResultData.extractableInsight || ""}
                              onChange={(e) => setEditResultData((d) => ({ ...d, extractableInsight: e.target.value }))}
                              className="mt-1"
                              rows={2}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`worth-${r.id}`}
                              checked={!!editResultData.worthWriting}
                              onChange={(e) => setEditResultData((d) => ({ ...d, worthWriting: e.target.checked }))}
                            />
                            <Label htmlFor={`worth-${r.id}`} className="text-xs">值得写文章</Label>
                          </div>
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => handleUpdateResult(r.id)}
                          >
                            保存
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
