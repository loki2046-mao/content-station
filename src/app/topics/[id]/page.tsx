/**
 * 选题详情页
 * 展示选题基本信息和关联的分析/标题/骨架/素材
 */
"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, SkeletonCard } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const SUITABILITY_COLORS: Record<string, string> = {
  high: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_OPTIONS = [
  { value: "unprocessed", label: "未处理" },
  { value: "analyzed", label: "已分析" },
  { value: "drafted", label: "已成稿" },
  { value: "published", label: "已发布" },
  { value: "paused", label: "暂缓" },
];

export default function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const { data: topic, loading, refresh } = useApiGet<AnyRecord>(`/api/topics/${id}`);
  const { data: analysesData } = useApiGet<AnyRecord[]>(`/api/analyses?topicId=${id}`);
  const { data: titlesData } = useApiGet<AnyRecord[]>(`/api/titles?topicId=${id}`);
  const { data: outlinesData } = useApiGet<AnyRecord[]>(`/api/outlines?topicId=${id}`);

  // 更新选题
  const handleSave = async (formData: FormData) => {
    setSaving(true);
    try {
      await apiFetch(`/api/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: formData.get("title"),
          source: formData.get("source"),
          summary: formData.get("summary"),
          status: formData.get("status"),
        }),
      });
      toast.success("选题已更新");
      setEditing(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  // 删除选题
  const handleDelete = async () => {
    if (!confirm("确定要删除这个选题吗？")) return;
    try {
      await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
      toast.success("选题已删除");
      router.push("/topics");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>;
  if (!topic) return <EmptyState icon="❌" title="选题不存在" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={topic.title}
        description={`创建于 ${new Date(topic.createdAt || topic.created_at).toLocaleString("zh-CN")}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "取消" : "编辑"}
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              删除
            </Button>
          </div>
        }
      />

      {/* 基本信息 */}
      {editing ? (
        <Card>
          <CardContent className="pt-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="title">标题</Label>
                <Input id="title" name="title" defaultValue={topic.title} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="source">来源</Label>
                <Input id="source" name="source" defaultValue={topic.source} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="summary">摘要</Label>
                <Textarea id="summary" name="summary" defaultValue={topic.summary} className="mt-1" rows={3} />
              </div>
              <div>
                <Label htmlFor="status">状态</Label>
                <Select name="status" defaultValue={topic.status}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving ? "保存中..." : "保存"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={topic.status} />
              {topic.source && <span className="text-sm text-muted-foreground">来源: {topic.source}</span>}
            </div>
            {topic.summary && <p className="text-sm text-muted-foreground">{topic.summary}</p>}
          </CardContent>
        </Card>
      )}

      {/* Tab 关联信息 */}
      <Tabs defaultValue="analyses">
        <TabsList>
          <TabsTrigger value="analyses">切口分析 ({analysesData?.length || 0})</TabsTrigger>
          <TabsTrigger value="titles">标题方案 ({titlesData?.length || 0})</TabsTrigger>
          <TabsTrigger value="outlines">文章骨架 ({outlinesData?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="analyses" className="space-y-3 mt-4">
          {!analysesData?.length ? (
            <EmptyState
              title="暂无切口分析"
              description={
                <span>
                  去<Link href={`/analyze`} className="text-primary hover:underline mx-1">切口分析页面</Link>为这个选题生成分析
                </span>
              }
            />
          ) : (
            analysesData.map((a) => {
              const result = typeof a.result === "string" ? JSON.parse(a.result) : a.result;
              const isExpanded = expandedAnalysis === a.id;
              return (
                <Card
                  key={a.id}
                  className={`cursor-pointer transition-colors ${isExpanded ? "border-primary/50" : "hover:border-primary/30"}`}
                  onClick={() => setExpandedAnalysis(isExpanded ? null : a.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {new Date(a.createdAt || a.created_at).toLocaleString("zh-CN")} · {a.modelUsed || a.model_used}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">{isExpanded ? "收起 ▲" : "展开 ▼"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!isExpanded ? (
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(result) && result.map((angle: AnyRecord, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {angle.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                        {Array.isArray(result) && result.map((angle: AnyRecord, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{angle.name}</p>
                              <Badge variant="outline" className={`text-xs ${SUITABILITY_COLORS[angle.suitability] || ""}`}>
                                {angle.suitability === "high" ? "高适合" : angle.suitability === "medium" ? "中等" : "较低"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{angle.description}</p>
                            {angle.suitabilityReason && (
                              <p className="text-xs text-muted-foreground italic">{angle.suitabilityReason}</p>
                            )}
                            {angle.articleType && (
                              <Badge variant="outline" className="text-xs">{angle.articleType}</Badge>
                            )}
                            {angle.expandPoints && (
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {angle.expandPoints.map((point: string, j: number) => (
                                  <li key={j}>• {point}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="titles" className="space-y-3 mt-4">
          {!titlesData?.length ? (
            <EmptyState
              title="暂无标题方案"
              description={
                <span>
                  去<Link href={`/titles`} className="text-primary hover:underline mx-1">标题生成页面</Link>为这个选题生成标题
                </span>
              }
            />
          ) : (
            titlesData.map((t) => {
              const result = typeof t.result === "string" ? JSON.parse(t.result) : t.result;
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal text-muted-foreground">
                      {new Date(t.createdAt || t.created_at).toLocaleString("zh-CN")} · {t.modelUsed || t.model_used}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Array.isArray(result) && result.map((title: AnyRecord, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/50">
                        <p className="font-medium text-sm">{title.mainTitle}</p>
                        <p className="text-xs text-muted-foreground mt-1">{title.subtitle}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="outlines" className="space-y-3 mt-4">
          {!outlinesData?.length ? (
            <EmptyState
              title="暂无文章骨架"
              description={
                <span>
                  去<Link href={`/outline`} className="text-primary hover:underline mx-1">骨架生成页面</Link>为这个选题生成骨架
                </span>
              }
            />
          ) : (
            outlinesData.map((o) => {
              const result = typeof o.result === "string" ? JSON.parse(o.result) : o.result;
              return (
                <Card key={o.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-normal text-muted-foreground">
                      {new Date(o.createdAt || o.created_at).toLocaleString("zh-CN")} · {o.modelUsed || o.model_used}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result?.coreTension && (
                      <p className="text-sm"><strong>核心矛盾：</strong>{result.coreTension}</p>
                    )}
                    {result?.sections && (
                      <div className="mt-2 space-y-1">
                        {result.sections.map((s: AnyRecord, i: number) => (
                          <p key={i} className="text-sm text-muted-foreground">
                            {i + 1}. {s.title} <span className="text-xs">({s.contentType})</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
