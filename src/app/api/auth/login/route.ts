/**
 * 登录 API
 * POST /api/auth/login
 * Body: { password: string }
 * 成功：设置 auth_token cookie，返回 { success: true }
 */
import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.SITE_PASSWORD || "2046";
const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7天

function makeToken(password: string): string {
  return `station:${password}`;
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || password !== PASSWORD) {
      return NextResponse.json(
        { success: false, error: "密码错误" },
        { status: 401 }
      );
    }

    const token = makeToken(PASSWORD);
    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "请求格式错误" },
      { status: 400 }
    );
  }
}
