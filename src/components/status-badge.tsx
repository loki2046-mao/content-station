/**
 * 选题状态 Badge 组件
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  unprocessed: { label: "未处理", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  analyzed: { label: "已分析", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  drafted: { label: "已成稿", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  published: { label: "已发布", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  paused: { label: "暂缓", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

const MATERIAL_TYPE_MAP: Record<string, { label: string; className: string }> = {
  opinion: { label: "观点", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  quote: { label: "金句", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  title_inspiration: { label: "标题灵感", className: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  example: { label: "例子", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  opening: { label: "开头句", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  closing: { label: "结尾句", className: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  title: { label: "标题方案", className: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  angle: { label: "切口", className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  outline: { label: "骨架", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  general: { label: "通用", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  prompt: { label: "提示词", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

export function MaterialTypeBadge({ type }: { type: string }) {
  const config = MATERIAL_TYPE_MAP[type] || { label: type, className: "" };
  return (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
