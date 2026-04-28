/**
 * Mobile Pipeline 独立 layout
 * 不包含桌面端侧边栏，全屏竖屏使用
 * 通过 LayoutShell 在根 layout 中自动检测 /mobile 路由隐藏侧边栏
 */
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "写作Pipeline",
  description: "移动端写作Pipeline快捷操作",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pipeline",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#B8623C",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
