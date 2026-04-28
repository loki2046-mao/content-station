/**
 * 全站密码保护中间件
 * - 所有页面和 API 路由（除 /api/auth）都需要验证
 * - 通过 cookie auth_token 持久化登录状态（7天）
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD || "2046";
const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7天

/** token 就是密码本身，Edge Runtime 兼容 */
function makeToken(password: string): string {
  return `station:${password}`;
}

function isValidToken(token: string): boolean {
  return token === makeToken(PASSWORD);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行：登录页本身、登录 API
  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // 放行：外部触发 API（内部自行校验 Bearer token）
  if (pathname.startsWith("/api/external/")) {
    return NextResponse.next();
  }

  // 放行：Next.js 内部路由和静态资源
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // 验证 cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token && isValidToken(token)) {
    return NextResponse.next();
  }

  // API 路由未授权：返回 401 JSON，不跳转
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: "未授权，请先登录" },
      { status: 401 }
    );
  }

  // 页面路由：跳转登录页，带 redirect 参数
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // 匹配所有路由（排除 _next 静态文件由上面逻辑处理）
    "/((?!_next/static|_next/image).*)",
  ],
};
