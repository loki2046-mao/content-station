/**
 * Dashboard 首页
 * 展示统计概览、最近数据、快捷入口
 */
"use client";

import Link from "next/link";
import { useApiGet } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, MaterialTypeBadge } from "@/components/status-badge";
import { SkeletonCard, EmptyState } from "@/components/loading";
import { PageHeader } from "@/components/page-header";

/** 统计数据卡片 */
function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <span className="text-3xl">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** 快捷入口 */
function QuickActions() {
  const actions = [
    { href: "/topics", label: "新建选题", icon: "📋" },
    { href: "/analyze", label: "切口分析", icon: "🔍" },
    { href: "/titles", label: "标题生成", icon: "✍️" },
    { href: "/outline", label: "骨架生成", icon: "🏗️" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {actions.map((a) => (
        <Link key={a.href} href={a.href}>
          <Button variant="outline" className="w-full h-20 flex flex-col gap-1.5 hover:border-primary/50 hover:bg-primary/5">
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm">{a.label}</span>
          </Button>
        </Link>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default function DashboardPage() {
  const { data: topicsData, loading: topicsLoading } = useApiGet<AnyRecord[]>("/api/topics?limit=5");
  const { data: allTopics } = useApiGet<AnyRecord[]>("/api/topics?limit=9999");
  const { data: titlesData, loading: titlesLoading } = useApiGet<AnyRecord[]>("/api/titles?limit=5");
  const { data: materialsData, loading: materialsLoading } = useApiGet<AnyRecord[]>("/api/materials?limit=5");
  const { data: hotspotsData } = useApiGet<AnyRecord[]>("/api/hotspots?status=new&days=3");

  // 统计数据
  const totalTopics = allTopics?.length ?? 0;
  const unprocessed = allTopics?.filter((t) => t.status === "unprocessed").length ?? 0;
  const published = allTopics?.filter((t) => t.status === "published").length ?? 0;
  const totalMaterials = materialsData?.length ?? 0;
  const newHotspots = hotspotsData?.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="公众号内容创作全流程管理"
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="选题总数" value={totalTopics} icon="📋" />
        <StatCard label="待处理" value={unprocessed} icon="⏳" />
        <StatCard label="已发布" value={published} icon="✅" />
        <StatCard label="素材数" value={totalMaterials} icon="📝" />
        <Link href="/hotspots">
          <StatCard label="新热点" value={newHotspots} icon="🔥" />
        </Link>
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">快捷入口</h2>
        <QuickActions />
      </div>

      {/* 最近数据 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 最近选题 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📋 最近选题
              <Link href="/topics" className="text-xs text-primary hover:underline ml-auto">查看全部</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topicsLoading ? (
              <>{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</>
            ) : !topicsData?.length ? (
              <EmptyState title="还没有选题" description="点击上方快捷入口开始" />
            ) : (
              topicsData.map((t) => (
                <Link key={t.id} href={`/topics/${t.id}`} className="block">
                  <div className="p-2.5 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{t.summary || "暂无摘要"}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* 最近标题 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ✍️ 最近标题
              <Link href="/titles" className="text-xs text-primary hover:underline ml-auto">查看全部</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {titlesLoading ? (
              <>{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</>
            ) : !titlesData?.length ? (
              <EmptyState title="还没有标题方案" />
            ) : (
              titlesData.map((t) => {
                const result = typeof t.result === "string" ? JSON.parse(t.result) : t.result;
                const first = Array.isArray(result) ? result[0] : null;
                return (
                  <div key={t.id} className="p-2.5 rounded-lg hover:bg-muted transition-colors">
                    <p className="text-sm font-medium truncate">{first?.mainTitle || "标题方案"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      共 {Array.isArray(result) ? result.length : 0} 套方案 · {t.modelUsed || t.model_used}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 最近素材 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📝 最近素材
              <Link href="/materials" className="text-xs text-primary hover:underline ml-auto">查看全部</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {materialsLoading ? (
              <>{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</>
            ) : !materialsData?.length ? (
              <EmptyState title="还没有素材" />
            ) : (
              materialsData.map((m) => (
                <div key={m.id} className="p-2.5 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <p className="text-sm truncate flex-1">{m.content}</p>
                    <MaterialTypeBadge type={m.type} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
