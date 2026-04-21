/**
 * 根布局
 * 包含导航栏和内容区
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { DesktopSidebar, MobileNav } from "@/components/nav-sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "公众号内容工作站",
  description: "从选题到标题到骨架，一站式公众号内容创作工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          {/* 桌面端侧边栏 */}
          <DesktopSidebar />

          {/* 主内容区 */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 移动端顶部导航 */}
            <MobileNav />

            {/* 内容 */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl">
              {children}
            </main>
          </div>
        </div>

        <Toaster />
      </body>
    </html>
  );
}
