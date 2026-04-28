/**
 * 文章详情 / Pipeline 进度页
 * 带轮询、阶段产出展示、用户交互决策
 *
 * 架构：前端浏览器直接调阿里API（通过 Cloudflare Worker CORS代理）
 * Worker URL: https://llm-proxy.lokimao0426.workers.dev
 */
"use client";

import { useState, useCallback, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/loading";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Pencil,
} from "lucide-react";
import {
  PIPELINE_SYSTEM_PROMPT,
  buildTopicAnalysisPrompt,
  buildMaterialSuggestionPrompt,
  buildSkeletonPrompt,
  buildDraftWritingPrompt,
  buildCoverDesignPrompt,
  parseLLMJson,
} from "@/lib/prompts/pipeline";

// ─────────────────────────────────────────────
// 客户端 LLM 调用（通过 Cloudflare Worker CORS代理）
// ─────────────────────────────────────────────

const PROXY_URL = "https://llm.hiloki.ai";

/** 从 settings 获取 LLM 配置并调用，通过 Worker 代理绕过 CORS */
async function callLLM(
  messages: Array<{ role: string; content: string }>,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const settingsRes = await fetch("/api/settings");
  const settingsData = await settingsRes.json();
  const cfg = settingsData?.data?.settings ?? {};
  const apiKey: string = cfg.api_key ?? cfg.apiKey ?? "";
  const baseUrl: string = (cfg.base_url ?? cfg.baseUrl ?? "https://coding.dashscope.aliyuncs.com/v1").replace(/\/$/, "");
  const model: string = cfg.default_model ?? cfg.defaultModel ?? "qwen3.5-plus";

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetUrl: `${baseUrl}/chat/completions`,
      apiKey,
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM调用失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content as string) || "";
}

/** 更新 step 状态到数据库 */
async function patchStep(
  articleId: string,
  stage: string,
  update: { status: "running" | "waiting_decision" | "failed"; output?: string; error?: string }
) {
  await apiFetch(`/api/articles/${articleId}/steps/${stage}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

/** 安全解析 JSON 字符串（供客户端执行逻辑用） */
function safeJsonLocal<T = AnyRecord>(str: string | null | undefined): T | null {
  if (!str || str === "{}" || str === "null") return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

/**
 * 前端驱动的阶段执行：
 * 1. PATCH step → running
 * 2. 获取所有 steps 数据
 * 3. 构建 prompt
 * 4. 调 callLLM
 * 5. PATCH step → waiting_decision + output
 */
async function runClientLLM(
  articleId: string,
  stage: string,
  articleTitle: string,
  articleMetadata: string,
  steps: AnyRecord[]
): Promise<void> {
  const stepsMap = Object.fromEntries(steps.map((s: AnyRecord) => [s.stage, s]));
  const metadata = safeJsonLocal<Record<string, string>>(articleMetadata) || {};

  const systemMessages = [{ role: "system", content: PIPELINE_SYSTEM_PROMPT }];

  let userPrompt = "";
  let temperature = 0.7;
  let maxTokens = 3000;
  let outputData: unknown = {};

  if (stage === "topic") {
    userPrompt = buildTopicAnalysisPrompt({
      title: articleTitle,
      note: metadata.note || metadata.description || "",
    });
    temperature = 0.8;
    maxTokens = 2000;
  } else if (stage === "material") {
    const topicStep = stepsMap["topic"];
    let angle = topicStep?.decision || "";
    if (!angle) {
      const topicOutput = safeJsonLocal<{ angles: Array<{ name: string; description: string }> }>(topicStep?.output);
      if (topicOutput?.angles?.length) {
        angle = `${topicOutput.angles[0].name}：${topicOutput.angles[0].description}`;
      }
    }
    userPrompt = buildMaterialSuggestionPrompt({
      title: articleTitle,
      angle: angle || articleTitle,
      existingMaterials: [],
    });
    temperature = 0.7;
    maxTokens = 2000;
  } else if (stage === "skeleton") {
    const topicStep = stepsMap["topic"];
    const materialStep = stepsMap["material"];
    let angle = topicStep?.decision || "";
    if (!angle) {
      const topicOutput = safeJsonLocal<{ angles: Array<{ name: string; description: string }> }>(topicStep?.output);
      if (topicOutput?.angles?.length) {
        angle = `${topicOutput.angles[0].name}：${topicOutput.angles[0].description}`;
      }
    }
    let materialSummary = materialStep?.decision || "";
    if (!materialSummary) {
      const matOutput = safeJsonLocal<{ summary: string }>(materialStep?.output);
      materialSummary = matOutput?.summary || "";
    }
    userPrompt = buildSkeletonPrompt({ title: articleTitle, angle: angle || articleTitle, materialSummary });
    temperature = 0.8;
    maxTokens = 3000;
  } else if (stage === "draft") {
    const topicStep = stepsMap["topic"];
    const materialStep = stepsMap["material"];
    const skeletonStep = stepsMap["skeleton"];
    let angle = topicStep?.decision || "";
    if (!angle) {
      const topicOutput = safeJsonLocal<{ angles: Array<{ name: string; description: string }> }>(topicStep?.output);
      if (topicOutput?.angles?.length) {
        angle = `${topicOutput.angles[0].name}：${topicOutput.angles[0].description}`;
      }
    }
    let skeletonText = skeletonStep?.decision || "";
    if (!skeletonText) {
      const skeletonOutput = safeJsonLocal<{ sections: Array<{ title: string; keyPoints: string[]; estimatedWords: number }>; writingTip: string }>(skeletonStep?.output);
      if (skeletonOutput?.sections) {
        skeletonText = skeletonOutput.sections
          .map((s) => `## ${s.title}\n关键点：${s.keyPoints.join("；")}\n预估字数：${s.estimatedWords}`)
          .join("\n\n");
        if (skeletonOutput.writingTip) skeletonText += `\n\n写作提示：${skeletonOutput.writingTip}`;
      }
    }
    let materialSummary = materialStep?.decision || "";
    if (!materialSummary) {
      const matOutput = safeJsonLocal<{ summary: string }>(materialStep?.output);
      materialSummary = matOutput?.summary || "";
    }
    userPrompt = buildDraftWritingPrompt({
      title: articleTitle,
      angle: angle || articleTitle,
      skeleton: skeletonText || "按照正常公众号文章结构写",
      materialSummary,
    });
    temperature = 0.85;
    maxTokens = 6000;
  } else if (stage === "layout") {
    const draftStep = stepsMap["draft"];
    const draftOutput = safeJsonLocal<{ content: string; wordCount: number }>(draftStep?.output);
    const content = draftStep?.decision || draftOutput?.content || "";
    outputData = {
      content,
      wordCount: draftOutput?.wordCount || content.length,
      layoutNote: "排版需要在排版编辑器中完成。请复制上方内容，前往 wechat-layout.hiloki.ai 进行排版。",
      layoutUrl: "https://wechat-layout.hiloki.ai",
    };
    await patchStep(articleId, stage, { status: "waiting_decision", output: JSON.stringify(outputData) });
    return;
  } else if (stage === "cover") {
    const topicStep = stepsMap["topic"];
    const draftStep = stepsMap["draft"];
    let angle = topicStep?.decision || "";
    if (!angle) {
      const topicOutput = safeJsonLocal<{ angles: Array<{ name: string; description: string }> }>(topicStep?.output);
      if (topicOutput?.angles?.length) {
        angle = `${topicOutput.angles[0].name}：${topicOutput.angles[0].description}`;
      }
    }
    const draftOutput = safeJsonLocal<{ content: string }>(draftStep?.output);
    const draftContent = draftStep?.decision || draftOutput?.content || "";
    userPrompt = buildCoverDesignPrompt({
      title: articleTitle,
      angle: angle || articleTitle,
      draftSummary: draftContent.slice(0, 500),
    });
    temperature = 0.8;
    maxTokens = 2000;
  } else if (stage === "ready") {
    const draftStep = stepsMap["draft"];
    const coverStep = stepsMap["cover"];
    const draftOutput = safeJsonLocal<{ content: string; wordCount: number }>(draftStep?.output);
    const coverOutput = safeJsonLocal<{ titleOptions: unknown[] }>(coverStep?.output);
    outputData = {
      summary: "文章已完成全部制作流程，准备发布",
      finalTitle: articleTitle,
      wordCount: draftOutput?.wordCount || 0,
      hasDraft: !!draftOutput?.content,
      hasCover: !!(coverOutput?.titleOptions?.length),
      readyToPublish: true,
    };
    await patchStep(articleId, stage, { status: "waiting_decision", output: JSON.stringify(outputData) });
    return;
  }

  // 调 LLM
  const raw = await callLLM(
    [...systemMessages, { role: "user", content: userPrompt }],
    { temperature, maxTokens }
  );

  // 解析输出
  if (stage === "draft") {
    const parsed = parseLLMJson<{ content: string; wordCount: number }>(raw);
    outputData = {
      content: parsed.content || raw,
      wordCount: parsed.wordCount || (parsed.content || raw).length,
    };
  } else {
    outputData = parseLLMJson(raw);
  }

  await patchStep(articleId, stage, { status: "waiting_decision", output: JSON.stringify(outputData) });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const STAGES = [
  { key: "topic",    label: "选题",    icon: "📋" },
  { key: "material", label: "素材收集", icon: "📦" },
  { key: "skeleton", label: "骨架",    icon: "🏗️" },
  { key: "draft",    label: "初稿",    icon: "✍️" },
  { key: "layout",   label: "排版",    icon: "🖼️" },
  { key: "cover",    label: "封面",    icon: "🎨" },
  { key: "ready",    label: "待发布",   icon: "🚀" },
] as const;

const ARTICLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: "进行中", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  paused:    { label: "已暂停", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  completed: { label: "已完成", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  archived:  { label: "已归档", color: "bg-muted/60 text-muted-foreground border-border" },
};

const STEP_STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  running:          { label: "AI生成中",  color: "bg-blue-500/15 text-blue-400 border-blue-500/30",       dot: "bg-blue-400" },
  waiting_decision: { label: "等待确认", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  completed:        { label: "已完成",   color: "bg-green-500/15 text-green-400 border-green-500/30",    dot: "bg-green-400" },
  pending:          { label: "待开始",   color: "bg-muted/60 text-muted-foreground border-border",       dot: "bg-muted-foreground/40" },
  failed:           { label: "失败",     color: "bg-red-500/15 text-red-400 border-red-500/30",          dot: "bg-red-400" },
  skipped:          { label: "已跳过",   color: "bg-muted/60 text-muted-foreground border-border",       dot: "bg-muted-foreground/40" },
};

function safeJson<T = AnyRecord>(str: string | null | undefined): T | null {
  if (!str || str === "{}" || str === "null") return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

// ─────────────────────────────────────────────
// Stage Output Components
// ─────────────────────────────────────────────

/** topic 阶段输出：角度选择卡片 */
function TopicOutput({
  output,
  onSelect,
  selectedAngle,
}: {
  output: AnyRecord;
  onSelect: (angle: string) => void;
  selectedAngle: string;
}) {
  const angles: AnyRecord[] = output?.angles || [];
  if (!angles.length) return <p className="text-sm text-muted-foreground">暂无输出</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium">AI 分析了 {angles.length} 个写作角度，请选择一个：</p>
      {angles.map((angle, i) => {
        const angleStr = `${angle.name}：${angle.description}`;
        const isSelected = selectedAngle === angleStr;
        return (
          <div
            key={i}
            onClick={() => onSelect(angleStr)}
            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                <span className="font-medium text-sm">{angle.name}</span>
              </div>
              <Badge variant="outline" className="text-xs border-border text-muted-foreground shrink-0">
                {angle.articleType}
              </Badge>
            </div>
            <p className="text-sm text-foreground/80 mb-2">{angle.description}</p>
            {angle.targetAudience && (
              <p className="text-xs text-muted-foreground">目标读者：{angle.targetAudience}</p>
            )}
          </div>
        );
      })}
      <div className="pt-1">
        <Label className="text-xs text-muted-foreground">或自定义角度：</Label>
        <Textarea
          value={!angles.some((a) => `${a.name}：${a.description}` === selectedAngle) ? selectedAngle : ""}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="输入自定义角度描述..."
          className="mt-1.5 text-sm"
          rows={2}
        />
      </div>
    </div>
  );
}

/** material 阶段输出：素材整理 */
function MaterialOutput({ output }: { output: AnyRecord }) {
  const usefulMaterials: AnyRecord[] = output?.usefulMaterials || [];
  const suggestions: AnyRecord[] = output?.suggestions || [];
  const summary: string = output?.summary || "";

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
          <p className="text-xs font-medium text-blue-400 mb-1">总体判断</p>
          <p className="text-sm text-foreground/90">{summary}</p>
        </div>
      )}
      {usefulMaterials.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            ✅ 可用素材（{usefulMaterials.length} 条）
          </p>
          <div className="space-y-2">
            {usefulMaterials.map((m, i) => (
              <div key={i} className="rounded-md border border-border p-3">
                <p className="text-xs text-foreground/80 mb-1">{m.content}</p>
                <p className="text-xs text-green-400">用法：{m.howToUse}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            💡 建议补充的素材（{suggestions.length} 条）
          </p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {s.type}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/80 mb-1">{s.description}</p>
                <p className="text-xs text-muted-foreground">来源：{s.findWhere}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** skeleton 阶段输出：骨架编辑 */
function SkeletonOutput({
  output,
  editedSkeleton,
  onEdit,
}: {
  output: AnyRecord;
  editedSkeleton: string;
  onEdit: (v: string) => void;
}) {
  const sections: AnyRecord[] = output?.sections || [];
  const totalWords: number = output?.totalEstimatedWords || 0;
  const writingTip: string = output?.writingTip || "";

  return (
    <div className="space-y-4">
      {writingTip && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs font-medium text-amber-400 mb-1">✍️ 写作提示</p>
          <p className="text-sm text-foreground/90">{writingTip}</p>
        </div>
      )}
      {sections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">文章结构（{sections.length} 章节，约 {totalWords} 字）</p>
          </div>
          {sections.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm">{i + 1}. {s.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {s.contentType}
                  </Badge>
                  <span className="text-xs text-muted-foreground">~{s.estimatedWords}字</span>
                </div>
              </div>
              {s.keyPoints && (
                <ul className="space-y-0.5">
                  {(s.keyPoints as string[]).map((p, j) => (
                    <li key={j} className="text-xs text-foreground/70 flex gap-1.5">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">修改意见（可选，直接填写或粘贴修改后的结构）：</Label>
        <Textarea
          value={editedSkeleton}
          onChange={(e) => onEdit(e.target.value)}
          placeholder="如有修改，在这里写明..."
          className="mt-1.5 text-sm"
          rows={3}
        />
      </div>
    </div>
  );
}

/** draft 阶段输出：初稿展示+编辑 */
function DraftOutput({
  output,
  editedDraft,
  onEdit,
}: {
  output: AnyRecord;
  editedDraft: string;
  onEdit: (v: string) => void;
}) {
  const content: string = output?.content || "";
  const wordCount: number = output?.wordCount || content.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">初稿内容</p>
        <span className="text-xs text-muted-foreground">{wordCount} 字</span>
      </div>
      {/* Markdown 渲染（用 pre 展示，实际生产可换 react-markdown） */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 max-h-80 overflow-y-auto">
        <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">修改内容（直接编辑，留空则使用上方原稿）：</Label>
        <Textarea
          value={editedDraft}
          onChange={(e) => onEdit(e.target.value)}
          placeholder="如需修改，在这里直接粘贴修改后的全文..."
          className="mt-1.5 text-sm font-mono"
          rows={6}
        />
      </div>
    </div>
  );
}

/** layout 阶段输出：排版指引 */
function LayoutOutput({ output }: { output: AnyRecord }) {
  const content: string = output?.content || "";
  const wordCount: number = output?.wordCount || content.length;
  const layoutUrl: string = output?.layoutUrl || "https://wechat-layout.hiloki.ai";
  const layoutNote: string = output?.layoutNote || "";

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <p className="text-sm font-medium text-blue-400 mb-2">📐 排版说明</p>
        <p className="text-sm text-foreground/90 mb-3">{layoutNote}</p>
        <a
          href={layoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          打开排版编辑器
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">初稿内容（约 {wordCount} 字）</p>
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-4 max-h-60 overflow-y-auto">
        <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
}

/** cover 阶段输出：封面方案 */
function CoverOutput({
  output,
  selectedCover,
  onSelect,
}: {
  output: AnyRecord;
  selectedCover: string;
  onSelect: (v: string) => void;
}) {
  const titleOptions: AnyRecord[] = output?.titleOptions || [];
  const visualDescription: string = output?.visualDescription || "";
  const imagePrompt: string = output?.imagePrompt || "";

  return (
    <div className="space-y-4">
      {titleOptions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">封面大字方案（点击选择）：</p>
          <div className="grid grid-cols-1 gap-2">
            {titleOptions.map((opt, i) => {
              const isSelected = selectedCover === opt.coverText;
              return (
                <div
                  key={i}
                  onClick={() => onSelect(opt.coverText)}
                  className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      <span className="font-bold text-lg">{opt.coverText}</span>
                    </div>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                      {opt.style}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {visualDescription && (
        <div className="rounded-lg bg-muted/20 border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">视觉方向建议</p>
          <p className="text-sm text-foreground/80">{visualDescription}</p>
        </div>
      )}
      {imagePrompt && (
        <div className="rounded-lg bg-muted/20 border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">AI 生图 Prompt</p>
          <p className="text-sm text-foreground/80 font-mono">{imagePrompt}</p>
        </div>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">自定义封面文字（可选）：</Label>
        <Input
          value={!titleOptions.some((o) => o.coverText === selectedCover) ? selectedCover : ""}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="输入自定义封面大字..."
          className="mt-1.5 text-sm"
        />
      </div>
    </div>
  );
}

/** ready 阶段：汇总展示 */
function ReadyOutput({ output, article }: { output: AnyRecord; article: AnyRecord }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
        <p className="text-2xl mb-2">🎉</p>
        <p className="font-medium text-green-400">文章已完成全部流程！</p>
        <p className="text-sm text-foreground/70 mt-1">{output?.summary}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{output?.wordCount || 0}</p>
          <p className="text-xs text-muted-foreground">总字数</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xs font-medium text-foreground/80 mt-1">{article?.title}</p>
          <p className="text-xs text-muted-foreground">最终标题</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stage Progress Bar
// ─────────────────────────────────────────────
function StageProgressBar({
  currentStage,
  steps,
}: {
  currentStage: string;
  steps: AnyRecord[];
}) {
  const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, idx) => {
        const step = stepsMap[stage.key];
        const isCompleted = step?.status === "completed" || step?.status === "skipped";
        const isCurrent = stage.key === currentStage;
        const isRunning = isCurrent && step?.status === "running";
        const isPast = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted || isPast
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : isCurrent
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground/50"
                }`}
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isCompleted || isPast ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <span className="text-xs font-bold">{idx + 1}</span>
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent ? "text-primary font-medium" : isFuture ? "text-muted-foreground/50" : "text-muted-foreground"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`h-0.5 w-6 mb-4 flex-shrink-0 ${idx < currentIdx ? "bg-green-500/50" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Current Stage Panel
// ─────────────────────────────────────────────
function CurrentStagePanel({
  article,
  steps,
  onRefresh,
}: {
  article: AnyRecord;
  steps: AnyRecord[];
  onRefresh: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [decision, setDecision] = useState("");

  const currentStage = article.currentStage || "topic";
  const stageInfo = STAGES.find((s) => s.key === currentStage);
  const currentStep = steps.find((s) => s.stage === currentStage);
  const stepStatus = currentStep?.status || "pending";
  const stepConfig = STEP_STATUS_CONFIG[stepStatus] || STEP_STATUS_CONFIG.pending;

  const isLastStage = currentStage === "ready";
  const isCompleted = article.status === "completed";
  const isRunning = stepStatus === "running";
  const isWaiting = stepStatus === "waiting_decision";
  const isFailed = stepStatus === "failed";

  const outputData = safeJson(currentStep?.output);

  // Stage-specific decision state
  const [selectedAngle, setSelectedAngle] = useState("");
  const [editedSkeleton, setEditedSkeleton] = useState("");
  const [editedDraft, setEditedDraft] = useState("");
  const [selectedCover, setSelectedCover] = useState("");

  // Reset state when stage changes
  const prevStageRef = useRef(currentStage);
  useEffect(() => {
    if (prevStageRef.current !== currentStage) {
      setSelectedAngle("");
      setEditedSkeleton("");
      setEditedDraft("");
      setSelectedCover("");
      setDecision("");
      setLlmError("");
      prevStageRef.current = currentStage;
    }
  }, [currentStage]);

  // 客户端 LLM 执行：当 step 是 running 时，直接从浏览器调阿里API
  const llmTriggeredRef = useRef<string>("");
  useEffect(() => {
    const triggerKey = `${article.id}-${currentStage}`;
    if (!isRunning || llmTriggeredRef.current === triggerKey) return;
    llmTriggeredRef.current = triggerKey;

    setLlmError("");
    runClientLLM(article.id, currentStage, article.title, article.metadata || "{}", steps)
      .then(() => {
        onRefresh();
      })
      .catch(async (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        setLlmError(errMsg);
        // 把失败状态写回数据库
        try {
          await patchStep(article.id, currentStage, { status: "failed", error: errMsg });
        } catch {
          // ignore
        }
        onRefresh();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, currentStage, isRunning]);

  /** 构建 decision 字符串 */
  const buildDecision = (): string | undefined => {
    if (currentStage === "topic" && selectedAngle) return selectedAngle;
    if (currentStage === "skeleton" && editedSkeleton) return editedSkeleton;
    if (currentStage === "draft" && editedDraft) return editedDraft;
    if (currentStage === "cover" && selectedCover) return selectedCover;
    if (decision.trim()) return decision.trim();
    return undefined;
  };

  const handleAdvance = useCallback(async () => {
    setAdvancing(true);
    try {
      const res = await apiFetch(`/api/articles/${article.id}/advance`, {
        method: "POST",
        body: JSON.stringify({ decision: buildDecision() }),
      });
      toast.success(isLastStage ? "文章已完成！" : "已确认，正在开始下一阶段...");
      setDecision("");
      setSelectedAngle("");
      setEditedSkeleton("");
      setEditedDraft("");
      setSelectedCover("");
      setLlmError("");

      // advance 成功后，重置触发key以便 useEffect 检测到新的 running 状态
      const nextStage = (res as AnyRecord)?.data?.advancedTo;
      if (nextStage) {
        llmTriggeredRef.current = "";
      }

      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setAdvancing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, isLastStage, onRefresh, currentStage, selectedAngle, editedSkeleton, editedDraft, selectedCover, decision]);

  const handleRetry = useCallback(async () => {
    setExecuting(true);
    setLlmError("");
    try {
      // 先设为 running
      await patchStep(article.id, currentStage, { status: "running" });
      // 重置触发key，让 useEffect 重新触发客户端执行
      llmTriggeredRef.current = "";
      toast.success("已重新触发执行");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "触发失败");
    } finally {
      setExecuting(false);
    }
  }, [article.id, currentStage, onRefresh]);

  if (isCompleted) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-lg font-medium text-green-400">文章已完成全部流程</p>
          <p className="text-sm text-muted-foreground mt-1">所有阶段均已完成</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{stageInfo?.icon}</span>
            当前阶段：{stageInfo?.label}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs flex items-center gap-1 border ${stepConfig.color}`}
            >
              {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
              {!isRunning && <span className={`w-1.5 h-1.5 rounded-full ${stepConfig.dot}`} />}
              {stepConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Running 状态 */}
        {isRunning && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI 正在生成{stageInfo?.label}内容，请稍候...</p>
            <p className="text-xs text-muted-foreground/60">浏览器直接调用AI接口，约15-30秒</p>
            {llmError && (
              <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 w-full text-left">
                <p className="text-xs text-red-400">{llmError}</p>
              </div>
            )}
          </div>
        )}

        {/* Failed 状态 */}
        {isFailed && (
          <div className="space-y-3">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm font-medium text-red-400 mb-1">执行失败</p>
              <p className="text-xs text-foreground/70">{currentStep?.error || llmError || "未知错误"}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={executing}
              className="w-full"
            >
              {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              重新执行
            </Button>
          </div>
        )}

        {/* Waiting Decision - 各阶段输出展示 */}
        {isWaiting && outputData && (
          <>
            {currentStage === "topic" && (
              <TopicOutput
                output={outputData}
                onSelect={setSelectedAngle}
                selectedAngle={selectedAngle}
              />
            )}
            {currentStage === "material" && (
              <MaterialOutput output={outputData} />
            )}
            {currentStage === "skeleton" && (
              <SkeletonOutput
                output={outputData}
                editedSkeleton={editedSkeleton}
                onEdit={setEditedSkeleton}
              />
            )}
            {currentStage === "draft" && (
              <DraftOutput
                output={outputData}
                editedDraft={editedDraft}
                onEdit={setEditedDraft}
              />
            )}
            {currentStage === "layout" && (
              <LayoutOutput output={outputData} />
            )}
            {currentStage === "cover" && (
              <CoverOutput
                output={outputData}
                selectedCover={selectedCover}
                onSelect={setSelectedCover}
              />
            )}
            {currentStage === "ready" && (
              <ReadyOutput output={outputData} article={article} />
            )}

            {/* material / layout 阶段通用备注 */}
            {(currentStage === "material" || currentStage === "layout") && (
              <div>
                <Label className="text-xs text-muted-foreground">备注（可选）：</Label>
                <Textarea
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  placeholder="添加备注或说明..."
                  className="mt-1.5 text-sm"
                  rows={2}
                />
              </div>
            )}
          </>
        )}

        {/* Pending 状态 */}
        {stepStatus === "pending" && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">等待上一阶段完成后自动开始</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={executing}
              className="mt-3"
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              手动触发执行
            </Button>
          </div>
        )}

        {/* 已有决策记录 */}
        {currentStep?.decision && isWaiting && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3">
            <p className="text-xs text-green-400 font-medium mb-1">已记录决策</p>
            <p className="text-sm text-foreground/80">{currentStep.decision}</p>
          </div>
        )}

        {/* 确认推进按钮 */}
        {(isWaiting || (stepStatus === "completed" && !isCompleted)) && (
          <Button
            onClick={handleAdvance}
            disabled={advancing}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {advancing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />处理中...</>
            ) : isLastStage ? (
              "✅ 完成全部流程"
            ) : (
              `确认${stageInfo?.label} → 开始${STAGES[STAGES.findIndex((s) => s.key === currentStage) + 1]?.label || "下一步"}`
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Stage History Panel
// ─────────────────────────────────────────────
function StepHistoryPanel({ steps }: { steps: AnyRecord[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (stageKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stageKey)) next.delete(stageKey);
      else next.add(stageKey);
      return next;
    });
  };

  const stepsMap = Object.fromEntries(steps.map((s) => [s.stage, s]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">全部阶段历史</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {STAGES.map((stage) => {
          const step = stepsMap[stage.key];
          const status = step?.status || "pending";
          const config = STEP_STATUS_CONFIG[status] || STEP_STATUS_CONFIG.pending;
          const isOpen = expanded.has(stage.key);

          const outputData = safeJson(step?.output);
          const hasContent = outputData || step?.decision || step?.error;

          return (
            <div key={stage.key} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() => hasContent && toggle(stage.key)}
              >
                <div className="flex items-center gap-3">
                  <span>{stage.icon}</span>
                  <span className="text-sm font-medium">{stage.label}</span>
                  {step?.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(step.completedAt).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs flex items-center gap-1 border ${config.color}`}
                  >
                    {status === "running" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    {status !== "running" && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                    {config.label}
                  </Badge>
                  {hasContent && (
                    isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isOpen && hasContent && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {step?.decision && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">决策记录</p>
                      <p className="text-sm text-green-400 bg-green-500/10 rounded-md p-2">
                        {step.decision}
                      </p>
                    </div>
                  )}
                  {outputData && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-medium">阶段输出摘要</p>
                      <pre className="text-xs bg-muted/30 rounded-md p-2 overflow-auto max-h-32 text-foreground/70">
                        {JSON.stringify(outputData, null, 2).slice(0, 500)}
                        {JSON.stringify(outputData, null, 2).length > 500 ? "\n...(已截断)" : ""}
                      </pre>
                    </div>
                  )}
                  {step?.error && (
                    <div>
                      <p className="text-xs text-red-400 mb-1 font-medium">错误信息</p>
                      <p className="text-xs text-red-400/80 bg-red-500/10 rounded-md p-2">{step.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function PipelineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: articleData, loading, refresh } = useApiGet<AnyRecord>(`/api/articles/${id}`);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [saving, setSaving] = useState(false);

  const article = articleData;
  const steps: AnyRecord[] = article?.steps || [];
  const statusConfig = ARTICLE_STATUS_CONFIG[article?.status] || ARTICLE_STATUS_CONFIG.active;

  // 轮询：前端LLM调用完成后会主动refresh，这里只作为保险
  const currentStage = article?.currentStage || "topic";
  const currentStep = steps.find((s) => s.stage === currentStage);
  const isCurrentRunning = currentStep?.status === "running";

  useEffect(() => {
    if (!isCurrentRunning) return;
    const interval = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [isCurrentRunning, refresh]);

  const handleTitleEdit = () => {
    setTitleValue(article?.title || "");
    setEditingTitle(true);
  };

  const handleTitleSave = useCallback(async () => {
    if (!titleValue.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/articles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      toast.success("标题已更新");
      setEditingTitle(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  }, [id, titleValue, refresh]);

  if (loading && !articleData) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">文章不存在</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/pipeline")}>
          返回看板
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="text-xl font-bold h-auto py-1 max-w-lg"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTitleSave();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <Button size="sm" onClick={handleTitleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold tracking-tight">{article.title}</h1>
              <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                onClick={handleTitleEdit}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className={`text-xs border ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            {isCurrentRunning && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI 生成中...
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              创建于 {new Date(article.createdAt || article.created_at).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/pipeline")} className="shrink-0">
          ← 返回看板
        </Button>
      </div>

      {/* 阶段进度条 */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <StageProgressBar
            currentStage={currentStage}
            steps={steps}
          />
        </CardContent>
      </Card>

      {/* 当前阶段面板 */}
      <CurrentStagePanel
        article={article}
        steps={steps}
        onRefresh={refresh}
      />

      {/* 历史阶段折叠 */}
      <StepHistoryPanel steps={steps} />
    </div>
  );
}
