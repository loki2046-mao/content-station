/**
 * 骨架生成页面
 * 选择选题+切口 → 生成结构化文章骨架
 */
"use client";

import { useState } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
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
  const [angle, setAngle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnyRecord | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const { data: topicsList } = useApiGet<AnyRecord[]>("/api/topics");
  const { data: historyList, refresh: refreshHistory } = useApiGet<AnyRecord[]>("/api/outlines");
  const { data: settingsData } = useApiGet<AnyRecord>("/api/settings");

  const modelConfigured = !!settingsData?.settings?.api_key;
  const selectedTopic = topicsList?.find((t) => t.id === topicId);

  // 生成骨架
  const handleGenerate = async () => {
    if (!topicId || !selectedTopic) {
      toast.error("请选择一个选题");
      return;
    }

    setGenerating(true);
    setCurrentResult(null);
    setCurrentId(null);
    setEditing(false);
    try {
      const res = await apiFetch<AnyRecord>("/api/outlines/generate", {
        method: "POST",
        body: JSON.stringify({
          topicId,
          topic: selectedTopic.title,
          angle: angle || undefined,
        }),
      });
      const result = typeof res.result === "string" ? JSON.parse(res.result) : res.result;
      setCurrentResult(result);
      setCurrentId(res.id);
      refreshHistory();
      toast.success("骨架生成完成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
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

  return (
    <div className="space-y-6">
      <PageHeader title="骨架生成" description="选择选题和切口，AI 帮你搭建完整的文章结构" />

      {/* 输入区 */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div>
            <Label>选择选题 *</Label>
            <Select value={topicId} onValueChange={(v) => setTopicId(v || "")}>
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

          <div>
            <Label>写作切口（可选）</Label>
            <Input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
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
                  <p className="text-xs text-primary mb-1 font-medium">🎯 核心矛盾</p>
                  <p className="text-sm">{currentResult.coreTension}</p>
                </CardContent>
              </Card>
            )}

            {/* 开头 */}
            {currentResult.opening && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">📖 开头方式：{currentResult.opening.method}</p>
                  <p className="text-sm">{currentResult.opening.description}</p>
                  {currentResult.opening.example && (
                    <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                      {currentResult.opening.example}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 主体部分 */}
            {currentResult.sections?.map((section: AnyRecord, i: number) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    第 {i + 1} 部分：{section.title}
                    <Badge variant="outline" className="text-xs">{section.contentType}</Badge>
                  </CardTitle>
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
            ))}

            {/* 结尾 */}
            {currentResult.ending && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">🔚 结尾方式：{currentResult.ending.method}</p>
                  <p className="text-sm">{currentResult.ending.description}</p>
                  {currentResult.ending.example && (
                    <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                      {currentResult.ending.example}
                    </p>
                  )}
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
              const result = typeof record.result === "string" ? JSON.parse(record.result) : record.result;
              return (
                <Card key={record.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => {
                  const edited = record.editedResult || record.edited_result;
                  const displayResult = edited ? (typeof edited === "string" ? JSON.parse(edited) : edited) : result;
                  setCurrentResult(displayResult);
                  setCurrentId(record.id);
                  setEditing(false);
                }}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{result?.coreTension || "骨架记录"}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result?.sections?.length || 0} 个段落 · {record.modelUsed || record.model_used} ·{" "}
                          {new Date(record.createdAt || record.created_at).toLocaleString("zh-CN")}
                        </p>
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
