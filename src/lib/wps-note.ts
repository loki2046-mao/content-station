/**
 * WPS 笔记 MCP 客户端
 * 通过 MCP streamable HTTP 协议把内容写到 WPS 笔记
 *
 * MCP 协议参考：https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 *
 * 流程：
 *   1. initialize           — 建会话，部分实现需要后续 Mcp-Session-Id
 *   2. notifications/initialized — 通知会话就绪
 *   3. tools/list           — 列出可用工具
 *   4. tools/call           — 选择"创建笔记"类工具调用
 *
 * 配置（.env.local）：
 *   WPS_NOTE_MCP_URL=https://ainote.kdocs.cn/mcp-svc/mcp
 *   WPS_NOTE_API_KEY=xxxxxxxxxxxxx
 *
 * 注：这里只跑一次性请求，不维持长连接
 */

const REQUEST_TIMEOUT_MS = 25_000;

export type WpsCreateNoteResult = {
  toolUsed: string;
  raw: unknown;
  noteUrl?: string;
  noteId?: string;
};

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id?: number | string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, JsonSchemaProp>;
    required?: string[];
  };
}

interface JsonSchemaProp {
  type?: string | string[]; // JSON Schema 允许 type 是数组（如 ["null", "array"]）
  description?: string;
  items?: JsonSchemaProp;
  default?: unknown;
  enum?: unknown[];
}

interface ToolListResult {
  tools: ToolDefinition[];
}

interface ToolCallResult {
  content?: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
  structuredContent?: unknown;
  [k: string]: unknown;
}

/** 解析 MCP 服务端可能返回的两种格式：application/json 或 text/event-stream */
async function parseMcpResponse<T>(response: Response): Promise<JsonRpcResponse<T>> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("text/event-stream") || text.startsWith("event:") || text.startsWith("data:")) {
    // SSE: 解析 data: 行，取第一个完整 JSON
    const lines = text.split("\n");
    const dataLines = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    for (const dataLine of dataLines) {
      try {
        return JSON.parse(dataLine) as JsonRpcResponse<T>;
      } catch {
        // 继续找下一行
      }
    }
    throw new Error(`SSE 响应里没有可解析的 JSON：${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as JsonRpcResponse<T>;
  } catch {
    throw new Error(`MCP 响应非 JSON：${text.slice(0, 300)}`);
  }
}

/** 发一个 JSON-RPC POST 请求 */
async function callMcp<T = unknown>(
  url: string,
  apiKey: string,
  method: string,
  params: unknown,
  sessionId?: string,
  isNotification = false
): Promise<{ data: JsonRpcResponse<T>; sessionId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "X-API-Key": apiKey,
    "Authorization": `Bearer ${apiKey}`, // 兼容某些实现期望 Bearer
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    params,
  };
  if (!isNotification) body.id = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const newSessionId = res.headers.get("mcp-session-id") || res.headers.get("Mcp-Session-Id") || sessionId;

    if (isNotification) {
      // 通知不期望响应体
      return { data: { jsonrpc: "2.0" } as JsonRpcResponse<T>, sessionId: newSessionId || undefined };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await parseMcpResponse<T>(res);
    if (data.error) {
      throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
    }
    return { data, sessionId: newSessionId || undefined };
  } finally {
    clearTimeout(timer);
  }
}

/** 从工具列表里挑出最像"创建笔记"的工具 */
function pickCreateNoteTool(tools: ToolDefinition[]): ToolDefinition | null {
  if (!tools.length) return null;

  // 黑名单：明显不是"创建一篇全新笔记"的子动作
  const NEGATIVE_PATTERNS = [
    /tag/i, /label/i, /category/i,             // add_note_tags / set_label 等
    /comment/i, /share/i, /move/i, /copy/i, /export/i, /import/i,
    /delete/i, /remove/i, /trash/i, /archive/i,
    /update/i, /edit/i, /modify/i, /append/i, /patch/i, // 修改已有笔记
    /list/i, /search/i, /query/i, /find/i, /get/i, /fetch/i, /read/i,
    /info/i, /detail/i, /count/i, /stat/i,
    /folder/i, /workspace/i, /book/i, /collection/i, // 创建容器，不是笔记本身
    /attachment/i, /file/i, /image/i, /asset/i,
    /permission/i, /collaborator/i, /member/i,
  ];

  // 名字 - 强匹配："纯净"的创建笔记动作
  const STRONG_NAME_PATTERNS = [
    /^create[_-]?note$/i, /^new[_-]?note$/i, /^add[_-]?note$/i, /^write[_-]?note$/i,
    /^create[_-]?memo$/i, /^new[_-]?memo$/i,
    /^create[_-]?doc(ument)?$/i, /^new[_-]?doc(ument)?$/i,
    /^post[_-]?note$/i,
  ];

  const score = (t: ToolDefinition): number => {
    const name = (t.name || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    let s = 0;

    // 黑名单一票否决
    if (NEGATIVE_PATTERNS.some((p) => p.test(name))) return -100;

    // 名字强匹配
    if (STRONG_NAME_PATTERNS.some((p) => p.test(name))) s += 100;

    // 名字弱匹配
    if (/^(create|new|add|post|write)[_-]/.test(name)) s += 5;
    if (/(note|memo|doc)$/.test(name)) s += 5;

    // 描述匹配
    if (/创建|新建|新增|写入/.test(desc) && /笔记|文档|note|memo/.test(desc)) s += 8;
    if (/添加|更新|修改|删除/.test(desc) && /标签|tag/.test(desc)) s -= 50;

    // 参数 schema 看起来像"内容主体"
    const schemaStr = JSON.stringify(t.inputSchema || {}).toLowerCase();
    if (/markdown|content|body|text/.test(schemaStr)) s += 3;
    if (/title|subject|name/.test(schemaStr)) s += 2;
    if (/note_?id\b/i.test(schemaStr)) s -= 5; // 需要 note_id 的多半是修改类工具

    return s;
  };

  const ranked = tools
    .map((t) => ({ tool: t, score: score(t) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.tool || null;
}

/** 根据 JSON Schema 字段类型生成合适的默认值（处理 null|array 这种 union） */
function defaultValueForProp(prop: JsonSchemaProp | undefined): unknown {
  if (!prop) return "";
  if ("default" in prop && prop.default !== undefined) return prop.default;

  const types = Array.isArray(prop.type) ? prop.type : prop.type ? [prop.type] : [];
  // 取第一个非 null 的类型；都没有就返回 null
  const primary = types.find((t) => t !== "null") || types[0];

  switch (primary) {
    case "array":
      return [];
    case "object":
      return {};
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "null":
      return null;
    case "string":
    default:
      return "";
  }
}

/** 根据 tool 的 inputSchema，构造合适的参数对象 */
function buildToolArgs(
  tool: ToolDefinition,
  payload: { title: string; markdown: string }
): Record<string, unknown> {
  const props = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};

  // 智能映射常见字段名
  const map = (candidates: string[], value: unknown) => {
    for (const c of candidates) {
      if (props[c]) {
        args[c] = value;
        return true;
      }
    }
    return false;
  };

  map(["title", "name", "noteName", "noteTitle", "subject"], payload.title);
  map(
    ["content", "body", "markdown", "text", "noteContent", "noteBody"],
    payload.markdown
  );
  map(["format"], "markdown");

  // 还有 required 字段没填的，按 JSON Schema 的 type 给合适的默认值
  // 关键：tag_names 这种 type:["null","array"] 的字段不能填空字符串
  for (const required of tool.inputSchema?.required || []) {
    if (!(required in args)) {
      args[required] = defaultValueForProp(props[required]);
    }
  }

  return args;
}

/** 列出 WPS MCP 上所有可用工具（debug 用） */
export async function listWpsNoteTools(): Promise<{
  tools: ToolDefinition[];
  picked: string | null;
  pickedReason: string;
}> {
  const url = process.env.WPS_NOTE_MCP_URL;
  const apiKey = process.env.WPS_NOTE_API_KEY;
  if (!url) throw new Error("缺少环境变量 WPS_NOTE_MCP_URL");
  if (!apiKey) throw new Error("缺少环境变量 WPS_NOTE_API_KEY");

  const { sessionId: sid1 } = await callMcp(url, apiKey, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "content-station", version: "0.1" },
  });
  await callMcp(url, apiKey, "notifications/initialized", {}, sid1, true).catch(() => {});

  const { data: listResp } = await callMcp<ToolListResult>(url, apiKey, "tools/list", {}, sid1);
  const tools = listResp.result?.tools || [];
  const overrideName = process.env.WPS_NOTE_TOOL_NAME;
  let picked: ToolDefinition | null = null;
  let pickedReason = "";
  if (overrideName) {
    picked = tools.find((t) => t.name === overrideName) || null;
    pickedReason = picked ? `环境变量手动指定 WPS_NOTE_TOOL_NAME=${overrideName}` : "环境变量指定的工具不存在";
  } else {
    picked = pickCreateNoteTool(tools);
    pickedReason = picked ? "启发式打分自动选出" : "无匹配，需要手动指定";
  }
  return { tools, picked: picked?.name || null, pickedReason };
}

/** XML 转义 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Markdown → WPS Note XML 转换（基础版）
 * WPS 的 edit_block 只吃 XML，不吃 Markdown。这里做最小可用的语法转换：
 *  - # ~ ###### 标题 → <h1>...</h1> ~ <h6>...</h6>
 *  - ``` ``` 代码块 → <code_block language="xx">...</code_block>
 *  - 普通段落 → <p>...</p>
 *  - 空行作为段落分隔
 *  - 行内 markdown（**粗体** *斜体* `code`）暂保留原文，WPS 会以纯文本展示
 *  - frontmatter（---...---）会被剥掉
 */
function markdownToWpsXml(markdown: string): string {
  // 剥掉开头的 frontmatter
  let md = markdown;
  const fmMatch = md.match(/^---\n[\s\S]*?\n---\n+/);
  if (fmMatch) md = md.slice(fmMatch[0].length);

  const lines = md.split(/\r?\n/);
  const blocks: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      const text = paraBuf.join(" ").trim();
      if (text) blocks.push(`<p>${escapeXml(text)}</p>`);
      paraBuf = [];
    }
  };
  const flushCode = () => {
    const code = codeBuf.join("\n");
    const langAttr = codeLang ? ` language="${escapeXml(codeLang)}"` : "";
    blocks.push(`<code_block${langAttr}>${escapeXml(code)}</code_block>`);
    codeBuf = [];
    codeLang = "";
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        flushPara();
        inCode = true;
        codeLang = line.slice(3).trim();
      } else {
        flushCode();
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const headMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headMatch) {
      flushPara();
      const level = headMatch[1].length;
      const text = headMatch[2].trim();
      blocks.push(`<h${level}>${escapeXml(text)}</h${level}>`);
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    paraBuf.push(line);
  }
  flushPara();
  if (inCode && codeBuf.length) flushCode();

  return blocks.join("");
}

/** 通用：调用一个具名 tool */
async function callTool<T = ToolCallResult>(
  url: string,
  apiKey: string,
  sessionId: string | undefined,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: T | undefined; sessionId?: string }> {
  const { data, sessionId: sid } = await callMcp<T>(url, apiKey, "tools/call", { name, arguments: args }, sessionId);
  return { result: data.result, sessionId: sid };
}

/** 从 tools/call 的结果里抽取 structuredContent 或 text 里的字段 */
function extractFromToolResult(result: ToolCallResult | undefined, key: string): string | undefined {
  if (!result) return undefined;
  const sc = result.structuredContent as Record<string, unknown> | undefined;
  if (sc && typeof sc[key] === "string") return sc[key] as string;
  for (const c of result.content || []) {
    if (c.type === "text" && typeof c.text === "string") {
      const m = c.text.match(new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']?([^"',}\\s]+)`, "i"));
      if (m) return m[1];
    }
  }
  return undefined;
}

/** 把 markdown 推送到 WPS 笔记，返回结果（多步：create_note → get_note_outline → edit_block） */
export async function createWpsNote(payload: {
  title: string;
  markdown: string;
}): Promise<WpsCreateNoteResult> {
  const url = process.env.WPS_NOTE_MCP_URL;
  const apiKey = process.env.WPS_NOTE_API_KEY;
  if (!url) throw new Error("缺少环境变量 WPS_NOTE_MCP_URL");
  if (!apiKey) throw new Error("缺少环境变量 WPS_NOTE_API_KEY");

  // 1. initialize
  const { sessionId: sid0 } = await callMcp(url, apiKey, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "content-station", version: "0.1" },
  });
  await callMcp(url, apiKey, "notifications/initialized", {}, sid0, true).catch(() => {});

  // 2. create_note —— 创建一篇只有标题的空笔记
  const { result: createResult, sessionId: sid1 } = await callTool(url, apiKey, sid0, "create_note", {
    title: payload.title,
  });
  if (createResult?.isError) {
    const msg = (createResult.content || []).map((c) => c.text || JSON.stringify(c.data)).join("\n");
    throw new Error(`create_note 失败：${msg}`);
  }
  const noteId = extractFromToolResult(createResult, "note_id");
  const linkUrl = extractFromToolResult(createResult, "link_url");
  if (!noteId) throw new Error("create_note 返回里没找到 note_id");

  console.log(`[wps-note] created note ${noteId}, link=${linkUrl}`);

  // 3. 把 markdown 转成 WPS XML
  const xmlContent = markdownToWpsXml(payload.markdown);
  if (!xmlContent) {
    return { toolUsed: "create_note", raw: createResult, noteUrl: linkUrl, noteId };
  }

  // 4. get_note_outline —— 拿到第一个 block_id 作为锚点
  const { result: outlineResult, sessionId: sid2 } = await callTool(url, apiKey, sid1, "get_note_outline", {
    note_id: noteId,
    include_preview: false,
    max_depth: 1,
  });
  let anchorId: string | undefined;
  const sc = outlineResult?.structuredContent as Record<string, unknown> | undefined;
  if (sc && Array.isArray(sc.blocks) && sc.blocks.length > 0) {
    const first = sc.blocks[0] as Record<string, unknown>;
    anchorId = (first.block_id || first.id) as string | undefined;
  }
  if (!anchorId) {
    // 兜底：从 text 里正则提一个 block_id
    for (const c of outlineResult?.content || []) {
      if (c.type === "text" && typeof c.text === "string") {
        const m = c.text.match(/block_id["':\s]+["']?([\w-]+)/);
        if (m) {
          anchorId = m[1];
          break;
        }
      }
    }
  }
  if (!anchorId) {
    // 没找到锚点，至少笔记是创建好了
    console.warn("[wps-note] 没拿到 first block_id，跳过正文写入");
    return { toolUsed: "create_note", raw: createResult, noteUrl: linkUrl, noteId };
  }

  // 5. edit_block —— 在第一个 block 后插入正文 XML
  const { result: editResult } = await callTool(url, apiKey, sid2, "edit_block", {
    note_id: noteId,
    op: "insert",
    anchor_id: anchorId,
    position: "after",
    content: xmlContent,
  });
  if (editResult?.isError) {
    const msg = (editResult.content || []).map((c) => c.text || JSON.stringify(c.data)).join("\n");
    // 笔记已创建，正文写入失败不算致命；把信息回传给前端
    console.warn(`[wps-note] edit_block 失败：${msg}`);
    return {
      toolUsed: "create_note (edit_block 失败)",
      raw: { create: createResult, editError: msg },
      noteUrl: linkUrl,
      noteId,
    };
  }

  return {
    toolUsed: "create_note + edit_block",
    raw: { create: createResult, edit: editResult },
    noteUrl: linkUrl,
    noteId,
  };
}
