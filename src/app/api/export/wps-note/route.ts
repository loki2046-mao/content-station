/**
 * 推送初稿到 WPS 笔记
 * POST /api/export/wps-note
 *   body: { title, content, frontmatter? }
 *
 * 服务端调 WPS 笔记 MCP（streamable HTTP）创建笔记。
 * MCP 配置走 .env.local：WPS_NOTE_MCP_URL + WPS_NOTE_API_KEY
 */
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { createWpsNote, listWpsNoteTools } from "@/lib/wps-note";

/**
 * GET /api/export/wps-note?debug=tools
 * 返回 WPS MCP 上的所有可用工具，便于排查我应该选哪个 tool
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("debug") !== "tools") {
    return err("请使用 ?debug=tools 查询可用工具", 400);
  }
  try {
    const result = await listWpsNoteTools();
    return ok(result);
  } catch (error) {
    return err(`列出 WPS 工具失败：${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, frontmatter } = body as {
      title?: string;
      content?: string;
      frontmatter?: Record<string, string | number>;
    };

    if (!title) return err("缺少 title");
    if (!content) return err("缺少 content");

    // 拼成完整 markdown（带 frontmatter）
    const fmLines = frontmatter
      ? Object.entries(frontmatter)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : v}`)
      : [];
    const fmBlock = fmLines.length ? `---\n${fmLines.join("\n")}\n---\n\n` : "";
    const markdown = `${fmBlock}# ${title}\n\n${content}`;

    const result = await createWpsNote({ title, markdown });
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // 把 WPS 配置缺失这种"用户配置问题"返回 400，而不是 500
    if (msg.includes("缺少环境变量")) return err(msg, 400);
    return err(`推送 WPS 笔记失败：${msg}`, 500);
  }
}
