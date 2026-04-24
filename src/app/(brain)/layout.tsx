/**
 * 外脑模块 Layout
 * 包裹 /quick /inbox /organize /library /search 五个页面
 * 提供模块内统一导航
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BRAIN_NAV = [
  { href: "/quick",    label: "⚡ 快记",    mobileLabel: "快记" },
  { href: "/inbox",    label: "📥 收件箱",  mobileLabel: "收件箱" },
  { href: "/organize", label: "✏️ 整理台",  mobileLabel: "整理" },
  { href: "/library",  label: "📚 内容库",  mobileLabel: "内容库" },
  { href: "/search",   label: "🔍 搜索",    mobileLabel: "搜索" },
];

export default function BrainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] md:min-h-screen">
      {/* 电脑端：顶部横向 Tab 导航 */}
      <div className="hidden md:block border-b border-border bg-background sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-1 h-12">
            <span className="text-sm font-semibold text-muted-foreground mr-3">🧠 外脑</span>
            {BRAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 text-sm rounded-md transition-colors",
                  pathname === item.href || (item.href !== "/search" && pathname.startsWith(item.href))
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 页面内容 */}
      <div className="flex-1 pb-16 md:pb-0">
        {children}
      </div>

      {/* 手机端：底部 Tab 导航 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border">
        <div className="flex items-stretch h-14">
          {BRAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                pathname === item.href
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <span className="text-base leading-none">{item.label.split(" ")[0]}</span>
              <span>{item.mobileLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
