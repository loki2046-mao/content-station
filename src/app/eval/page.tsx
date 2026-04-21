/**
 * AI 测评工作台首页
 * /eval
 */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { SkeletonCard, EmptyState } from "@/components/loading";

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
  draft: "secondary",
  active: "default",
  completed: "outline",
};

export default function EvalPage() {
  const router = useRouter();
  const { data: projects, loading } = useApiGet<AnyRecord[]>("/api/eval/projects");
  const [casesCount, setCasesCount] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);

  useEffect(() => {
    // 获取统计数据
    apiFetch<AnyRecord[]>("/api/eval/cases").then((cases) => {
      setCasesCount(cases?.length ?? 0);
    }).catch(() => {});
    apiFetch<AnyRecord[]>("/api/eval/test-results").then((results) => {
      setResultsCount(results?.length ?? 0);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="🧪 AI 测评工作台"
        description="系统化测评 AI 模型，沉淀测评观点"
        actions={
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => router.push("/eval/new")}
          >
            + 新建测评项目
          </Button>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{projects?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">测评项目</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{casesCount}</p>
            <p className="text-xs text-muted-foreground mt-1">测试 Case</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-primary">{resultsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">已记录结果</p>
          </CardContent>
        </Card>
      </div>

      {/* 项目列表 */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">最近项目</h2>
        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : !projects?.length ? (
          <EmptyState
            icon="🧪"
            title="还没有测评项目"
            description="点击右上角新建你的第一个测评项目"
          />
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/eval/${project.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          <Badge variant={STATUS_COLORS[project.status] as "secondary" | "default" | "outline" || "secondary"}>
                            {STATUS_LABELS[project.status] || project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{MODEL_TYPE_LABELS[project.modelType] || project.modelType}</span>
                          {project.goalType && <span>目标：{project.goalType}</span>}
                          <span className="ml-auto">
                            {new Date(project.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
