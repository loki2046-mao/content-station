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
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const MODEL_TYPE_LABELS: Record<string, string> = {
  text: "📝 文本",
  image: "🖼️ 图片",
  video: "🎬 视频",
  agent: "🤖 Agent",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  active: "进行中",
  completed: "已完成",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
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

  const { data: projectDimsData, refresh: refreshProjectDims } =
    useApiGet<AnyRecord[]>(`/api/eval/project-dimensions?project_id=${id}`);

  // ---- 检测 provider 配置 ----
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/model")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setProviderConfigured(json.data?.configured ?? false);
      })
      .catch(() => setProviderConfigured(false));
  }, []);

  // ---- 已入库素材 source_id 集合 ----
  const [materializedResultIds, setMaterializedResultIds] = useState<Set<string>>(new Set());
  const refreshMaterialized = async () => {
    try {
      const res = await fetch("/api/eval/content-materials?source_type=eval_result");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const ids = new Set<string>(json.data.map((m: AnyRecord) => m.sourceId as string));
        setMaterializedResultIds(ids);
      }
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    refreshMaterialized();
  }, []);

  // --- 项目状态切换 ---
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // --- Case Tab ---
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [newCaseDifficulty, setNewCaseDifficulty] = useState("medium");
  const [newCaseDimId, setNewCaseDimId] = useState("");
  const [savingCase, setSavingCase] = useState(false);
  const [generatingCases, setGeneratingCases] = useState(false);

  // --- Prompt Tab ---
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptModelTarget, setPromptModelTarget] = useState("");
  // 手动录入 Prompt
  const [showManualPromptForm, setShowManualPromptForm] = useState(false);
  const [manualPromptContent, setManualPromptContent] = useState("");
  const [manualPromptModel, setManualPromptModel] = useState("");
  const [manualPromptDifficulty, setManualPromptDifficulty] = useState("medium");
  const [savingPrompt, setSavingPrompt] = useState(false);

  const { data: promptsData, refresh: refreshPrompts } = useApiGet<AnyRecord[]>(
    selectedCaseId ? `/api/eval/prompts?case_id=${selectedCaseId}` : null
  );

  // --- Results Tab ---
  const [newResultCaseId, setNewResultCaseId] = useState("");
  const [newResultPromptId, setNewResultPromptId] = useState("");
  const [newResultModel, setNewResultModel] = useState("");
  const [newResultRating, setNewResultRating] = useState("success");
  const [newResultHighlights, setNewResultHighlights] = useState("");
  const [newResultIssues, setNewResultIssues] = useState("");
  const [newResultWorthWriting, setNewResultWorthWriting] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  // 「转素材」loading 状态（per resultId）
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  // Prompt list for selected case in result form
  const { data: resultCasePrompts } = useApiGet<AnyRecord[]>(
    newResultCaseId ? `/api/eval/prompts?case_id=${newResultCaseId}` : null
  );

  // 编辑结果
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editResultData, setEditResultData] = useState<AnyRecord>({});

  const project = projectData?.project;
  const cases = casesData || [];
  const projectDims = projectDimsData || [];

  // ============ 项目状态切换 ============
  const handleToggleStatus = async () => {
    if (!project) return;
    setUpdatingStatus(true);
    const nextStatus =
      project.status === "draft" ? "active" :
      project.status === "active" ? "completed" : "active";
    try {
      await apiFetch(`/api/eval/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`已标记为「${STATUS_LABELS[nextStatus]}」`);
      refreshProject();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ============ Case 操作 ============
  const handleGenerateCases = async () => {
    if (!project) return;
    setGeneratingCases(true);
    try {
      const dimensions = projectDims.map((d: AnyRecord) => d.name).filter(Boolean);
      const result = await apiFetch<AnyRecord[]>("/api/eval/cases/generate", {
        method: "POST",
        body: JSON.stringify({
          projectId: id,
          goalType: project.goalType,
          modelType: project.modelType,
          dimensions,
          count: 5,
        }),
      });
      toast.success(`生成了 ${Array.isArray(result) ? result.length : 5} 个 Case`);
      refreshCases();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGeneratingCases(false);
    }
  };

  const handleCreateCase = async () => {
    if (!newCaseTitle.trim()) {
      toast.error("Case 标题不能为空");
      return;
    }
    setSavingCase(true);
    try {
      await apiFetch("/api/eval/cases", {
        method: "POST",
        body: JSON.stringify({
          projectId: id,
          title: newCaseTitle.trim(),
          description: newCaseDesc.trim(),
          difficulty: newCaseDifficulty,
          dimensionId: newCaseDimId || undefined,
        }),
      });
      toast.success("Case 已创建");
      setNewCaseTitle("");
      setNewCaseDesc("");
      setNewCaseDifficulty("medium");
      setNewCaseDimId("");
      setShowNewCaseForm(false);
      refreshCases();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSavingCase(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm("确认删除该 Case？关联的 Prompt 和测试记录也会一并删除。")) return;
    try {
      await apiFetch(`/api/eval/cases/${caseId}`, { method: "DELETE" });
      toast.success("已删除");
      refreshCases();
      refreshResults();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  // ============ Prompt 操作 ============
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

  const handleSaveManualPrompt = async () => {
    if (!selectedCaseId) {
      toast.error("请先选择 Case");
      return;
    }
    if (!manualPromptContent.trim()) {
      toast.error("Prompt 内容不能为空");
      return;
    }
    setSavingPrompt(true);
    try {
      await apiFetch("/api/eval/prompts", {
        method: "POST",
        body: JSON.stringify({
          caseId: selectedCaseId,
          content: manualPromptContent.trim(),
          modelTarget: manualPromptModel.trim(),
          difficulty: manualPromptDifficulty,
          isSaved: true,
        }),
      });
      toast.success("Prompt 已录入");
      setManualPromptContent("");
      setManualPromptModel("");
      setManualPromptDifficulty("medium");
      setShowManualPromptForm(false);
      refreshPrompts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "录入失败");
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm("确认删除该 Prompt？")) return;
    try {
      await apiFetch(`/api/eval/prompts/${promptId}`, { method: "DELETE" });
      toast.success("已删除");
      refreshPrompts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleCopyPrompt = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success("已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败，请手动复制");
    });
  };

  // ============ 测试结果操作 ============
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
          promptId: newResultPromptId || undefined,
          modelUsed: newResultModel,
          rating: newResultRating,
          highlights: newResultHighlights,
          issues: newResultIssues,
          worthWriting: newResultWorthWriting,
        }),
      });
      toast.success("结果已记录");
      setNewResultCaseId("");
      setNewResultPromptId("");
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

  const handleDeleteResult = async (resultId: string) => {
    if (!confirm("确认删除该测试记录？")) return;
    try {
      await apiFetch(`/api/eval/test-results/${resultId}`, { method: "DELETE" });
      toast.success("已删除");
      refreshResults();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  // ============ 转素材操作 ============
  const handleConvertToMaterial = async (resultId: string) => {
    setConvertingIds((prev) => new Set(prev).add(resultId));
    try {
      const res = await apiFetch<AnyRecord>("/api/eval/convert-to-material", {
        method: "POST",
        body: JSON.stringify({ resultId }),
      });
      if (res.alreadyExists) {
        toast.info("该记录已在素材库中");
      } else {
        toast.success("已转为素材，可在素材库查看");
      }
      // 刷新已入库集合
      setMaterializedResultIds((prev) => new Set(prev).add(resultId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "转素材失败");
    } finally {
      setConvertingIds((prev) => {
        const next = new Set(prev);
        next.delete(resultId);
        return next;
      });
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

  // 未配置 provider 警告横条
  const NoProviderBanner = () =>
    providerConfigured === false ? (
      <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
        <span>⚠️ 未配置文本模型，AI 生成不可用。</span>
        <Link href="/settings" className="underline font-medium hover:text-yellow-900">
          前往设置 →
        </Link>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${MODEL_TYPE_LABELS[project.modelType] || project.modelType}${project.goalType ? " · " + project.goalType : ""}`}
      />

      {/* ===== 项目概览 ===== */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 状态 */}
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[project.status] || STATUS_COLORS.draft)}>
              {STATUS_LABELS[project.status] || project.status}
            </span>

            {/* Case / 结果数 */}
            <span className="text-xs text-muted-foreground">
              {casesLoading ? "..." : cases.length} 个 Case
            </span>
            <span className="text-xs text-muted-foreground">
              {resultsLoading ? "..." : (resultsData?.length ?? 0)} 条测试记录
            </span>

            {/* 维度标签 */}
            {projectDims.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {projectDims.map((d: AnyRecord) => (
                  <Badge key={d.id} variant="secondary" className="text-xs">
                    {d.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* 状态切换按钮 */}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={handleToggleStatus}
              disabled={updatingStatus}
            >
              {updatingStatus ? <Spinner className="h-3 w-3 mr-1" /> : null}
              {project.status === "draft" ? "标记进行中" :
               project.status === "active" ? "标记完成" : "重新激活"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Case 列表 ({cases.length})</TabsTrigger>
          <TabsTrigger value="prompts">Prompt 管理</TabsTrigger>
          <TabsTrigger value="results">测试记录 ({resultsData?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* ===== Case 列表 Tab ===== */}
        <TabsContent value="cases" className="space-y-4">
          {/* 未配置 provider 警告 */}
          <NoProviderBanner />

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowNewCaseForm((v) => !v)}
            >
              {showNewCaseForm ? "收起" : "+ 手动新建 Case"}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleGenerateCases}
              disabled={generatingCases || providerConfigured === false}
              title={providerConfigured === false ? "请先在设置页配置文本模型 API Key" : undefined}
            >
              {generatingCases ? (
                <><Spinner className="h-4 w-4 mr-2" />生成中...</>
              ) : (
                "✨ AI 生成 Case"
              )}
            </Button>
          </div>

          {/* 手动新建 Case 表单 */}
          {showNewCaseForm && (
            <Card className="border-dashed border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">新建 Case</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">标题 <span className="text-red-500">*</span></Label>
                  <Input
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    placeholder="Case 标题..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">描述</Label>
                  <Textarea
                    value={newCaseDesc}
                    onChange={(e) => setNewCaseDesc(e.target.value)}
                    placeholder="测试场景说明..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">难度</Label>
                    <Select value={newCaseDifficulty} onValueChange={(v) => setNewCaseDifficulty(v || "medium")}>
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">🟢 Easy</SelectItem>
                        <SelectItem value="medium">🟡 Medium</SelectItem>
                        <SelectItem value="hard">🔴 Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {projectDims.length > 0 && (
                    <div>
                      <Label className="text-xs">维度（可选）</Label>
                      <Select value={newCaseDimId} onValueChange={(v) => setNewCaseDimId(v === "none" ? "" : (v || ""))}>
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue placeholder="选择维度" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">不关联维度</SelectItem>
                          {projectDims.map((d: AnyRecord) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleCreateCase}
                    disabled={savingCase}
                  >
                    {savingCase ? "保存中..." : "创建 Case"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewCaseForm(false)}
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {casesLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : !cases.length ? (
            <EmptyState
              icon="📋"
              title="还没有测试 Case"
              description="点击「手动新建 Case」或「AI 生成 Case」添加测试用例"
            />
          ) : (
            <div className="grid gap-3">
              {cases.map((c: AnyRecord) => {
                const dim = projectDims.find((d: AnyRecord) => d.id === c.dimensionId);
                return (
                  <Card key={c.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-medium text-sm">{c.title}</h3>
                            <span className={cn("text-xs font-medium", DIFFICULTY_COLORS[c.difficulty])}>
                              {c.difficulty}
                            </span>
                            {dim && (
                              <Badge variant="outline" className="text-xs">{dim.name}</Badge>
                            )}
                          </div>
                          {c.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleDeleteCase(c.id)}
                        >
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Prompt 管理 Tab ===== */}
        <TabsContent value="prompts" className="space-y-4">
          {/* 未配置 provider 警告 */}
          <NoProviderBanner />

          {/* 选 Case */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">选择 Case</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedCaseId} onValueChange={(v) => setSelectedCaseId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="选择一个 Case 查看 / 添加 Prompt" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c: AnyRecord) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedCaseId && (
            <>
              {/* 操作区 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowManualPromptForm((v) => !v)}
                >
                  {showManualPromptForm ? "收起" : "+ 手动录入 Prompt"}
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleGeneratePrompt}
                  disabled={generatingPrompt || !selectedCaseId || providerConfigured === false}
                  title={providerConfigured === false ? "请先在设置页配置文本模型 API Key" : undefined}
                >
                  {generatingPrompt ? (
                    <><Spinner className="h-4 w-4 mr-2" />生成中...</>
                  ) : (
                    "✨ AI 生成 Prompt"
                  )}
                </Button>
              </div>

              {/* 手动录入表单 */}
              {showManualPromptForm && (
                <Card className="border-dashed border-primary/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">手动录入 Prompt</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Prompt 内容 <span className="text-red-500">*</span></Label>
                      <Textarea
                        value={manualPromptContent}
                        onChange={(e) => setManualPromptContent(e.target.value)}
                        placeholder="输入 Prompt 内容..."
                        className="mt-1 font-mono text-sm"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">目标模型（可选）</Label>
                        <Input
                          value={manualPromptModel}
                          onChange={(e) => setManualPromptModel(e.target.value)}
                          placeholder="例如：GPT-4o"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">难度</Label>
                        <Select value={manualPromptDifficulty} onValueChange={(v) => setManualPromptDifficulty(v || "medium")}>
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">🟢 Easy</SelectItem>
                            <SelectItem value="medium">🟡 Medium</SelectItem>
                            <SelectItem value="hard">🔴 Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90"
                        onClick={handleSaveManualPrompt}
                        disabled={savingPrompt}
                      >
                        {savingPrompt ? "保存中..." : "保存 Prompt"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowManualPromptForm(false)}
                      >
                        取消
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Prompt 列表 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  该 Case 下的 Prompt（{promptsData?.length ?? 0} 条）
                </h3>
                {!promptsData?.length ? (
                  <p className="text-sm text-muted-foreground">暂无 Prompt，点击上方添加</p>
                ) : (
                  promptsData.map((p: AnyRecord) => (
                    <Card key={p.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {p.modelTarget && (
                              <Badge variant="outline" className="text-xs">{p.modelTarget}</Badge>
                            )}
                            <span className={cn("text-xs", DIFFICULTY_COLORS[p.difficulty || "medium"])}>
                              {p.difficulty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyPrompt(p.content)}
                            >
                              复制
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeletePrompt(p.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/50 rounded p-3">
                          {p.content}
                        </pre>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          {!selectedCaseId && (
            <EmptyState
              icon="⬆️"
              title="请先选择 Case"
              description="从上方下拉菜单中选择一个 Case，再管理其 Prompt"
            />
          )}
        </TabsContent>

        {/* ===== 测试记录 Tab ===== */}
        <TabsContent value="results" className="space-y-4">
          {/* 新建记录表单 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">记录测试结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Case <span className="text-red-500">*</span></Label>
                  <Select value={newResultCaseId} onValueChange={(v) => { setNewResultCaseId(v || ""); setNewResultPromptId(""); }}>
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

              {/* 关联 Prompt（可选） */}
              {newResultCaseId && (
                <div>
                  <Label>关联 Prompt（可选）</Label>
                  <Select value={newResultPromptId} onValueChange={(v) => setNewResultPromptId(v === "none" ? "" : (v || ""))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="不关联 Prompt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不关联</SelectItem>
                      {(resultCasePrompts || []).map((p: AnyRecord) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.content.slice(0, 40)}{p.content.length > 40 ? "…" : ""}
                          {p.modelTarget ? ` [${p.modelTarget}]` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                const isMaterialized = materializedResultIds.has(r.id);
                const isConverting = convertingIds.has(r.id);

                return (
                  <Card key={r.id}>
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          {/* 已入库标签 */}
                          {isMaterialized && (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                              ✓ 已入库
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">{r.modelUsed}</span>

                          {/* 转素材按钮 */}
                          {!isMaterialized ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleConvertToMaterial(r.id)}
                              disabled={isConverting}
                            >
                              {isConverting ? <Spinner className="h-3 w-3 mr-1" /> : null}
                              → 转素材
                            </Button>
                          ) : null}

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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteResult(r.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>

                      {/* 关联 Prompt 摘要 */}
                      {r.promptId && (
                        <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                          🔗 关联 Prompt ID：{r.promptId.slice(0, 8)}…
                        </p>
                      )}

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
