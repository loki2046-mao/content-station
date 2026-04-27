"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type ImportStatus = "idle" | "loading" | "done" | "error";

export default function ImportPage() {
  const [wechatStatus, setWechatStatus] = useState<ImportStatus>("idle");
  const [wechatInserted, setWechatInserted] = useState(0);
  const [wechatError, setWechatError] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Obsidian state
  const [obsidianStatus, setObsidianStatus] = useState<ImportStatus>("idle");
  const [obsidianInserted, setObsidianInserted] = useState(0);
  const [obsidianError, setObsidianError] = useState("");
  const [obsidianOverwrite, setObsidianOverwrite] = useState(false);
  const [obsidianFile, setObsidianFile] = useState<File | null>(null);

  async function handleWechatImport() {
    if (!selectedFile) {
      setWechatError("请先选择 all-materials-v2.json 文件");
      setWechatStatus("error");
      return;
    }

    setWechatStatus("loading");
    setWechatInserted(0);
    setWechatError("");

    try {
      const text = await selectedFile.text();
      const items = JSON.parse(text);

      const res = await fetch("/api/import/wechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, overwrite }),
      });
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

  async function handleObsidianImport() {
    if (!obsidianFile) {
      setObsidianError("请先选择 obsidian-materials.json 文件");
      setObsidianStatus("error");
      return;
    }

    setObsidianStatus("loading");
    setObsidianInserted(0);
    setObsidianError("");

    try {
      const text = await obsidianFile.text();
      const items = JSON.parse(text);

      const res = await fetch("/api/import/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, overwrite: obsidianOverwrite }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setObsidianError(data.error || `HTTP ${res.status}`);
        setObsidianStatus("error");
        return;
      }

      setObsidianInserted(data.data?.inserted ?? data.inserted ?? 0);
      setObsidianStatus("done");
    } catch (e) {
      setObsidianError(String(e));
      setObsidianStatus("error");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">导入素材</h1>
        <p className="text-muted-foreground text-sm mt-1">将外部素材批量导入到素材库</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📰</span>
            <span>公众号历史文章</span>
          </CardTitle>
          <CardDescription>选择本地的 all-materials-v2.json 文件上传导入</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file" className="text-sm">选择素材文件</Label>
            <input
              id="file"
              type="file"
              accept=".json"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground">已选择：{selectedFile.name}</p>
            )}
          </div>

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

          {wechatStatus === "loading" && (
            <div className="text-sm text-muted-foreground animate-pulse">导入中，请稍候……</div>
          )}
          {wechatStatus === "done" && (
            <div className="text-sm text-green-500 font-medium">✓ 导入完成，共导入 {wechatInserted} 条</div>
          )}
          {wechatStatus === "error" && (
            <div className="text-sm text-red-500">✗ 导入失败：{wechatError}</div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔮</span>
            <span>Obsidian 笔记</span>
          </CardTitle>
          <CardDescription>选择本地的 obsidian-materials.json 文件上传导入</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="obsidian-file" className="text-sm">选择素材文件</Label>
            <input
              id="obsidian-file"
              type="file"
              accept=".json"
              onChange={(e) => setObsidianFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
            />
            {obsidianFile && (
              <p className="text-xs text-muted-foreground">已选择：{obsidianFile.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="obsidian-overwrite"
              checked={obsidianOverwrite}
              onChange={(e) => setObsidianOverwrite(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-primary"
            />
            <Label htmlFor="obsidian-overwrite" className="text-sm text-muted-foreground cursor-pointer">
              覆盖导入（先清空旧的 Obsidian 素材再写入）
            </Label>
          </div>

          {obsidianStatus === "loading" && (
            <div className="text-sm text-muted-foreground animate-pulse">导入中，请稍候……</div>
          )}
          {obsidianStatus === "done" && (
            <div className="text-sm text-green-500 font-medium">✓ 导入完成，共导入 {obsidianInserted} 条</div>
          )}
          {obsidianStatus === "error" && (
            <div className="text-sm text-red-500">✗ 导入失败：{obsidianError}</div>
          )}

          <Button
            onClick={handleObsidianImport}
            disabled={obsidianStatus === "loading"}
            className="w-full sm:w-auto"
          >
            {obsidianStatus === "loading" ? "导入中…" : "开始导入"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
