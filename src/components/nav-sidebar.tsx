/**
 * 左侧导航栏组件
 * 包含 Logo、导航项、主题切换
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

/** 导航项定义 */
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/topics", label: "选题池", icon: "📋" },
  { href: "/analyze", label: "切口分析", icon: "🔍" },
  { href: "/titles", label: "标题生成", icon: "✍️" },
  { href: "/outline", label: "骨架生成", icon: "🏗️" },
  { href: "/materials", label: "素材库", icon: "📝" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

/** 导航链接 */
function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[0];
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <span className="text-lg">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

/** 主题切换按钮 */
function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // 默认深色主题
    const saved = localStorage.getItem("theme");
    const dark = saved ? saved === "dark" : true;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start gap-3 px-3">
      <span className="text-lg">{isDark ? "🌙" : "☀️"}</span>
      <span className="text-sm">{isDark ? "深色模式" : "浅色模式"}</span>
    </Button>
  );
}

/** 侧边栏内容 */
function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 pb-2">
        <Link href="/" className="flex items-center gap-2" onClick={onItemClick}>
          <span className="text-2xl">🎯</span>
          <span className="font-bold text-lg">内容工作站</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1">公众号选题 → 标题 → 骨架</p>
      </div>

      <Separator className="mx-4 w-auto" />

      {/* 导航 */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            }
            onClick={onItemClick}
          />
        ))}
      </nav>

      {/* 底部 */}
      <div className="p-3 space-y-1">
        <Separator className="mb-2" />
        <ThemeToggle />
      </div>
    </div>
  );
}

/** 桌面端侧边栏 */
export function DesktopSidebar() {
  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-border bg-sidebar h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
}

/** 移动端抽屉导航 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-background sticky top-0 z-40">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl">🎯</span>
        <span className="font-bold">内容工作站</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="sm" />}>
          <span className="text-xl">☰</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-0">
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <SidebarContent onItemClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
