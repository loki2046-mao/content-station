/**
 * Layout Shell
 * 桌面端显示侧边栏+导航，/mobile 路由下隐藏
 */
"use client";

import { usePathname } from "next/navigation";
import { DesktopSidebar, MobileNav } from "@/components/nav-sidebar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobilePage = pathname.startsWith("/mobile");

  if (isMobilePage) {
    // 移动端 Pipeline 页面：无侧边栏、无导航，全屏展示
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl">
          {children}
        </main>
      </div>
    </div>
  );
}
