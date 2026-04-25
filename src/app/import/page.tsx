/**
 * /import — 素材导入页
 * 支持：公众号历史文章 / Obsidian 笔记（即将支持）
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const WECHAT_TOTAL = 778;

type ImportStatus = "idle" | "loading" | "done" | "error";

export default function ImportPage() {
  const [wechatStatus, setWechatStatus] = useState<ImportStatus>("idle");
  const [wechatInserted, setWechatInserted] = useState(0);
  const [wechatError, setWechatError] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  async function handleWechatImport() {
    setWechatStatus("loading");
    setWechatInserted(0);
    setWechatError("");

    try {
      const url = `/api/import/wechat${overwrite ? "?overwrite=true" : ""}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        setWechatError(data.error || `HTTP ${res.status}`);
        setWechatStatus("error");
        return;
      }

      setWechatInserted(data.data?.inserted ?? data.inserted ?? 0);
      setWechatStatus("done");
    } catch (e) {
      setWechatError(String(e));
      setWechatStatus("error");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">导入素材</h1>
        <p className="text-muted-foreground text-sm mt-1">将外部素材批量导入到素材库</p>
      </div>

      {/* 公众号历史文章 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📰</span>
            <span>公众号历史文章</span>
          </CardTitle>
          <CardDescription>96 篇文章 · 提取完成 · 共 {WECHAT_TOTAL} 条素材</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 覆盖导入选项 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="overwrite"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-primary"
            />
            <Label htmlFor="overwrite" className="text-sm text-muted-foreground cursor-pointer">
              覆盖导入（先清空旧的公众号文章素材再写入）
            </Label>
          </div>

          {/* 状态区 */}
          {wechatStatus === "loading" && (
            <div className="text-sm text-muted-foreground animate-pulse">
              导入中，请稍候……（共 {WECHAT_TOTAL} 条）
            </div>
          )}
          {wechatStatus === "done" && (
            <div className="text-sm text-green-500 font-medium">
              ✓ 导入完成，共导入 {wechatInserted} 条
            </div>
          )}
          {wechatStatus === "error" && (
            <div className="text-sm text-red-500">
              ✗ 导入失败：{wechatError}
            </div>
          )}

          <Button
            onClick={handleWechatImport}
            disabled={wechatStatus === "loading"}
            className="w-full sm:w-auto"
          >
            {wechatStatus === "loading" ? "导入中…" : "开始导入"}
          </Button>
        </CardContent>
      </Card>

      {/* Obsidian 笔记（即将支持） */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔮</span>
            <span>Obsidian 笔记</span>
          </CardTitle>
          <CardDescription>即将支持</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline" className="w-full sm:w-auto">
            即将支持
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
