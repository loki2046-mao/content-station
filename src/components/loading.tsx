/**
 * 加载状态组件
 */
import { cn } from "@/lib/utils";

/** 旋转加载动画 */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-primary",
        className
      )}
      role="status"
    >
      <span className="sr-only">加载中...</span>
    </div>
  );
}

/** 骨架屏卡片 */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-5/6" />
    </div>
  );
}

/** 空状态 */
export function EmptyState({
  icon = "📭",
  title = "暂无数据",
  description = "",
}: {
  icon?: string;
  title?: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-muted-foreground font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
      )}
    </div>
  );
}

/** 生成中的全屏遮罩 */
export function GeneratingOverlay({ text = "AI 正在生成中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Spinner className="h-8 w-8" />
      <p className="text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}
