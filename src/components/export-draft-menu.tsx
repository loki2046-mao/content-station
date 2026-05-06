/**
 * 初稿导出菜单
 * 一组横排按钮：复制 Markdown / 下载 .md / 在 Obsidian 中打开
 * 飞书云文档 + WPS 笔记目前都支持直接拖入 .md 文件，所以共用"下载"动作
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, FileText, Info } from "lucide-react";
import { toast } from "sonner";

export interface ExportDraftMenuProps {
  /** 文章标题，用于文件名和 Obsidian 笔记名 */
  title: string;
  /** Markdown 正文 */
  content: string;
  /** 可选：附加到 Markdown 顶部的 frontmatter / 标题元信息 */
  frontmatter?: Record<string, string | number | undefined>;
  /** 可选：按钮尺寸，默认 sm */
  size?: "sm" | "default";
  /** 可选：紧凑模式（图标+短标签），默认 false */
  compact?: boolean;
}

/** 把 frontmatter 序列化成 YAML 形式 */
function buildFrontmatter(fm?: Record<string, string | number | undefined>): string {
  if (!fm) return "";
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => {
      const value = typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : String(v);
      return `${k}: ${value}`;
    });
  if (!lines.length) return "";
  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** 把标题做成可用作文件名的字符串 */
function safeFileName(title: string): string {
  const cleaned = (title || "未命名初稿")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return cleaned;
}

export function ExportDraftMenu({ title, content, frontmatter, size = "sm", compact = false }: ExportDraftMenuProps) {
  const [copying, setCopying] = useState(false);

  const fullMarkdown = `${buildFrontmatter(frontmatter)}# ${title || "未命名初稿"}\n\n${content}`;
  const fileName = `${safeFileName(title)}.md`;

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(fullMarkdown);
      toast.success("已复制为 Markdown，可直接粘贴到飞书 / WPS / Notion");
    } catch {
      toast.error("复制失败，浏览器可能拒绝了剪贴板权限");
    } finally {
      setTimeout(() => setCopying(false), 600);
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([fullMarkdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${fileName} 已下载，可拖入飞书 / WPS / Notion`);
    } catch (e) {
      toast.error(`下载失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /**
   * 通过 obsidian:// URI 让 Obsidian 一键打开新建笔记
   * 不指定 vault 时会用最近使用的 vault
   * 注意：超长内容（> ~32KB）部分系统/浏览器可能拦截 URI，下面有降级处理
   */
  const handleOpenInObsidian = () => {
    const noteName = safeFileName(title);
    const encoded = encodeURIComponent(fullMarkdown);
    // Obsidian URI 用 query string，太长有些浏览器会截断
    if (encoded.length > 30000) {
      toast.message("内容较长，建议改用「下载 .md」再拖入 Obsidian", { duration: 4000 });
      return;
    }
    const uri = `obsidian://new?name=${encodeURIComponent(noteName)}&content=${encoded}&silent=true`;
    try {
      window.location.href = uri;
      toast.success("已尝试打开 Obsidian。如果没有反应，请确认本机已安装 Obsidian");
    } catch {
      toast.error("打开 Obsidian 失败");
    }
  };

  const labelClass = compact ? "" : "ml-1.5";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          variant="outline"
          size={size}
          onClick={handleCopy}
          disabled={copying}
          className="gap-0"
          title="复制 Markdown"
        >
          <Copy className="w-3.5 h-3.5" />
          <span className={labelClass}>{compact ? "" : "复制 MD"}</span>
        </Button>
        <Button
          variant="outline"
          size={size}
          onClick={handleDownload}
          className="gap-0"
          title="下载 .md 文件"
        >
          <Download className="w-3.5 h-3.5" />
          <span className={labelClass}>{compact ? "" : "下载 .md"}</span>
        </Button>
        <Button
          variant="outline"
          size={size}
          onClick={handleOpenInObsidian}
          className="gap-0"
          title="在 Obsidian 中打开"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className={labelClass}>{compact ? "" : "Obsidian"}</span>
        </Button>
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
          <Info className="w-3 h-3" />
          飞书云文档 / WPS 笔记：把下载的 .md 文件拖进去即可
        </p>
      )}
    </div>
  );
}
