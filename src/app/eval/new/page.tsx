/**
 * 新建测评项目
 * /eval/new
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const GOAL_TYPES = [
  "综合能力测评",
  "中文写作能力",
  "代码生成能力",
  "图像生成质量",
  "视频生成质量",
  "指令遵循能力",
  "推理与逻辑",
  "多模态理解",
  "Agent 任务执行",
];

const MODEL_TYPES = [
  { value: "text", label: "📝 文本模型" },
  { value: "image", label: "🖼️ 图片模型" },
  { value: "video", label: "🎬 视频模型" },
  { value: "agent", label: "🤖 Agent" },
];

export default function NewEvalPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState("");
  const [modelType, setModelType] = useState<"text" | "image" | "video" | "agent">("text");
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { data: dimensions } = useApiGet<AnyRecord[]>(
    `/api/eval/dimensions?model_type=${modelType}`
  );

  const toggleDimension = (id: string) => {
    setSelectedDimensions((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const project = await apiFetch<AnyRecord>("/api/eval/projects", {
        method: "POST",
        body: JSON.stringify({ name, goalType, modelType, status: "active" }),
      });

      // 绑定维度
      for (const dimId of selectedDimensions) {
        await apiFetch("/api/eval/dimensions", {
          method: "POST",
          body: JSON.stringify({
            projectId: project.id,
            dimensionId: dimId,
          }),
        }).catch(() => {});
      }

      toast.success("项目创建成功");
      router.push(`/eval/${project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="新建测评项目" description="创建一个新的 AI 测评项目" />

      {/* 模型类型 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">模型类型</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODEL_TYPES.map((mt) => (
              <button
                key={mt.value}
                onClick={() => {
                  setModelType(mt.value as "text" | "image" | "video" | "agent");
                  setSelectedDimensions([]);
                }}
                className={cn(
                  "p-3 rounded-lg border text-sm font-medium transition-colors text-center",
                  modelType === mt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted"
                )}
              >
                {mt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 测评目标 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">测评目标</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {GOAL_TYPES.map((g) => (
              <button
                key={g}
                onClick={() => setGoalType(g)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm transition-colors",
                  goalType === g
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted text-muted-foreground"
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <Input
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            placeholder="或输入自定义目标..."
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* 测评维度 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">测评维度（可多选）</CardTitle>
        </CardHeader>
        <CardContent>
          {!dimensions?.length ? (
            <p className="text-sm text-muted-foreground">暂无预设维度</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dimensions.map((dim) => (
                <Badge
                  key={dim.id}
                  variant={selectedDimensions.includes(dim.id) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-sm px-3 py-1 transition-colors",
                    selectedDimensions.includes(dim.id)
                      ? "bg-primary text-primary-foreground"
                      : "hover:border-primary/40"
                  )}
                  onClick={() => toggleDimension(dim.id)}
                >
                  {dim.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 项目名称 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">项目名称</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="project-name">名称 *</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：GPT-4o vs Claude 3.5 图像生成对比测评"
            className="mt-1"
          />
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          className="bg-primary hover:bg-primary/90"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "创建中..." : "创建项目"}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </div>
  );
}
