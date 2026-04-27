/**
 * 数据库连接
 * 使用 Turso (libSQL) + Drizzle ORM
 * 从环境变量读取连接配置，连接失败时不会让应用崩溃
 */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// 数据库连接状态
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _connectionError: string | null = null;

/**
 * 获取数据库实例
 * 连接失败时返回 null，不抛异常
 */
export function getDb() {
  if (_db) return _db;
  if (_connectionError) return null;

  try {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      _connectionError = "未配置 TURSO_DATABASE_URL 环境变量";
      console.error(`[DB] ${_connectionError}`);
      return null;
    }

    const client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });

    _db = drizzle(client, { schema });
    console.log("[DB] 数据库连接成功");
    return _db;
  } catch (error) {
    _connectionError = `数据库连接失败: ${error}`;
    console.error(`[DB] ${_connectionError}`);
    return null;
  }
}

/**
 * 获取连接错误信息
 */
export function getDbError(): string | null {
  return _connectionError;
}

/**
 * 初始化数据库表结构
 * 在应用启动时调用，确保表存在
 */
export async function initDb() {
  const db = getDb();
  if (!db) return false;

  try {
    // 使用 raw SQL 创建表（Drizzle 的 push 需要 drizzle-kit CLI）
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });

    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT DEFAULT '',
        summary TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'unprocessed',
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        topic_id TEXT,
        input_text TEXT NOT NULL,
        result TEXT DEFAULT '[]',
        model_used TEXT DEFAULT '',
        is_favorited INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS titles (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        analysis_id TEXT,
        input_context TEXT DEFAULT '',
        result TEXT DEFAULT '[]',
        favorites TEXT DEFAULT '[]',
        model_used TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS outlines (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        analysis_id TEXT,
        result TEXT DEFAULT '{}',
        edited_result TEXT,
        model_used TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        topic_ids TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#B8623C',
        category TEXT DEFAULT 'custom'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS eval_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        goal_type TEXT DEFAULT '',
        model_type TEXT NOT NULL DEFAULT 'text',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_dimensions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model_type TEXT NOT NULL DEFAULT 'text',
        is_template INTEGER NOT NULL DEFAULT 0,
        template_name TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_project_dimensions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        dimension_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS eval_cases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        dimension_id TEXT DEFAULT '',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        difficulty TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_prompts (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        model_target TEXT DEFAULT '',
        content TEXT NOT NULL,
        difficulty TEXT DEFAULT 'medium',
        is_saved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_test_results (
        id TEXT PRIMARY KEY,
        prompt_id TEXT DEFAULT '',
        case_id TEXT NOT NULL,
        model_used TEXT DEFAULT '',
        tested_at TEXT NOT NULL DEFAULT (datetime('now')),
        output_url TEXT DEFAULT '',
        rating TEXT DEFAULT 'success',
        highlights TEXT DEFAULT '',
        issues TEXT DEFAULT '',
        worth_writing INTEGER NOT NULL DEFAULT 0,
        extractable_insight TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_insights (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_result_id TEXT DEFAULT '',
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS content_materials (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL DEFAULT 'manual',
        source_id TEXT DEFAULT '',
        test_subject TEXT DEFAULT '',
        eval_goal TEXT DEFAULT '',
        eval_dimension TEXT DEFAULT '',
        task_description TEXT DEFAULT '',
        result_summary TEXT DEFAULT '',
        highlights TEXT DEFAULT '',
        issues TEXT DEFAULT '',
        extractable_insight TEXT DEFAULT '',
        title_directions TEXT DEFAULT '',
        article_angles TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS eval_model_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model_type TEXT NOT NULL DEFAULT 'text',
        provider TEXT DEFAULT '',
        api_key TEXT DEFAULT '',
        base_url TEXT DEFAULT '',
        model_name TEXT DEFAULT '',
        extra_config TEXT DEFAULT '{}',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS idea_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#888888',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inbox_items (
        id TEXT PRIMARY KEY,
        raw_content TEXT NOT NULL,
        source_type TEXT DEFAULT 'web',
        quick_type TEXT DEFAULT '',
        suggested_type TEXT DEFAULT 'raw',
        suggested_tags TEXT DEFAULT '[]',
        status TEXT DEFAULT 'inbox',
        promoted_to_id TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT '',
        content TEXT NOT NULL,
        item_type TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        related_topic TEXT DEFAULT '',
        related_product TEXT DEFAULT '',
        source_inbox_id TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS topic_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'in_progress',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topic_cards (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        zone_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        card_status TEXT DEFAULT 'active',
        source_type TEXT DEFAULT 'manual',
        is_pinned INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topic_summaries (
        id TEXT PRIMARY KEY,
        project_id TEXT UNIQUE NOT NULL,
        recommended_angle TEXT,
        recommended_platform TEXT,
        spread_summary TEXT,
        next_action TEXT,
        export_status TEXT DEFAULT 'not_exported',
        last_exported_at INTEGER,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hotspot_items (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        heat_score INTEGER DEFAULT 0,
        summary TEXT,
        author TEXT,
        tags TEXT DEFAULT '[]',
        status TEXT DEFAULT 'new',
        adopted_topic_id TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        topic_id TEXT,
        current_stage TEXT DEFAULT 'topic',
        status TEXT DEFAULT 'active',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS article_steps (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        input TEXT DEFAULT '{}',
        output TEXT DEFAULT '{}',
        decision TEXT,
        error TEXT DEFAULT '',
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // === 增量迁移：新增字段 ===
    // materials 表加 source_type / source_id
    try { await client.execute("ALTER TABLE materials ADD COLUMN source_type TEXT DEFAULT ''"); } catch { /* 已存在则忽略 */ }
    try { await client.execute("ALTER TABLE materials ADD COLUMN source_id TEXT DEFAULT ''"); } catch { /* 已存在则忽略 */ }
    // titles 表加 status
    try { await client.execute("ALTER TABLE titles ADD COLUMN status TEXT DEFAULT 'done'"); } catch { /* 已存在则忽略 */ }
    // outlines 表加 status
    try { await client.execute("ALTER TABLE outlines ADD COLUMN status TEXT DEFAULT 'done'"); } catch { /* 已存在则忽略 */ }
    // analyses 表加 status / error
    try { await client.execute("ALTER TABLE analyses ADD COLUMN status TEXT DEFAULT 'done'"); } catch { /* 已存在则忽略 */ }
    try { await client.execute("ALTER TABLE analyses ADD COLUMN error TEXT DEFAULT ''"); } catch { /* 已存在则忽略 */ }
    // titles 表加 error
    try { await client.execute("ALTER TABLE titles ADD COLUMN error TEXT DEFAULT ''"); } catch { /* 已存在则忽略 */ }
    // outlines 表加 error
    try { await client.execute("ALTER TABLE outlines ADD COLUMN error TEXT DEFAULT ''"); } catch { /* 已存在则忽略 */ }

    // 插入默认标签（如果不存在）
    const defaultTags = [
      // 选题类型
      { id: "tag-ai-product", name: "AI产品", color: "#B8623C", category: "topic_type" },
      { id: "tag-industry", name: "行业观察", color: "#5B8C5A", category: "topic_type" },
      { id: "tag-experience", name: "个人体验", color: "#4A90D9", category: "topic_type" },
      { id: "tag-philosophy", name: "哲学思考", color: "#9B59B6", category: "topic_type" },
      { id: "tag-tutorial", name: "教程干货", color: "#E67E22", category: "topic_type" },
      { id: "tag-tool-review", name: "工具测评", color: "#1ABC9C", category: "topic_type" },
      // 写作状态
      { id: "tag-write-now", name: "可立刻写", color: "#27AE60", category: "write_status" },
      { id: "tag-observe", name: "待观察", color: "#F39C12", category: "write_status" },
      { id: "tag-not-fit", name: "不适合公众号", color: "#95A5A6", category: "write_status" },
    ];

    for (const tag of defaultTags) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO tags (id, name, color, category) VALUES (?, ?, ?, ?)",
        args: [tag.id, tag.name, tag.color, tag.category],
      });
    }

    // 插入默认设置（如果不存在）
    const defaultSettings = [
      { key: "model_provider", value: JSON.stringify("openai") },
      { key: "api_key", value: JSON.stringify("") },
      { key: "base_url", value: JSON.stringify("https://api.openai.com/v1") },
      { key: "default_model", value: JSON.stringify("gpt-4o-mini") },
      { key: "site_title", value: JSON.stringify("公众号内容工作站") },
    ];

    for (const s of defaultSettings) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [s.key, s.value],
      });
    }

    // 插入预设维度（如果维度表为空）
    const dimCountResult = await client.execute("SELECT COUNT(*) as cnt FROM eval_dimensions");
    const dimCount = Number((dimCountResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);
    if (dimCount === 0) {
      const presetDimensions = [
        // 图片模型
        { id: "dim-img-text", name: "中文文字能力", model_type: "image", template_name: "图片模型基础维度" },
        { id: "dim-img-layout", name: "排版设计能力", model_type: "image", template_name: "图片模型基础维度" },
        { id: "dim-img-follow", name: "指令遵循", model_type: "image", template_name: "图片模型基础维度" },
        { id: "dim-img-char", name: "角色一致性", model_type: "image", template_name: "图片模型基础维度" },
        { id: "dim-img-style", name: "风格控制", model_type: "image", template_name: "图片模型基础维度" },
        { id: "dim-img-detail", name: "细节稳定性", model_type: "image", template_name: "图片模型基础维度" },
        // 视频模型
        { id: "dim-vid-lens", name: "镜头语言", model_type: "video", template_name: "视频模型基础维度" },
        { id: "dim-vid-motion", name: "动作连续性", model_type: "video", template_name: "视频模型基础维度" },
        { id: "dim-vid-physics", name: "物理合理性", model_type: "video", template_name: "视频模型基础维度" },
        { id: "dim-vid-subject", name: "主体一致性", model_type: "video", template_name: "视频模型基础维度" },
        { id: "dim-vid-camera", name: "运镜执行", model_type: "video", template_name: "视频模型基础维度" },
        { id: "dim-vid-rhythm", name: "节奏控制", model_type: "video", template_name: "视频模型基础维度" },
        // 文本模型
        { id: "dim-txt-understanding", name: "指令理解", model_type: "text", template_name: "文本模型基础维度" },
        { id: "dim-txt-longform", name: "长文生成", model_type: "text", template_name: "文本模型基础维度" },
        { id: "dim-txt-reasoning", name: "推理能力", model_type: "text", template_name: "文本模型基础维度" },
        { id: "dim-txt-chinese", name: "中文表达", model_type: "text", template_name: "文本模型基础维度" },
        { id: "dim-txt-format", name: "格式遵循", model_type: "text", template_name: "文本模型基础维度" },
        { id: "dim-txt-creative", name: "创意能力", model_type: "text", template_name: "文本模型基础维度" },
        // Agent 维度
        { id: "dim-agent-decompose", name: "任务拆解", model_type: "agent", template_name: "Agent基础维度" },
        { id: "dim-agent-tool", name: "工具调用", model_type: "agent", template_name: "Agent基础维度" },
        { id: "dim-agent-context", name: "上下文保持", model_type: "agent", template_name: "Agent基础维度" },
        { id: "dim-agent-output", name: "输出完整度", model_type: "agent", template_name: "Agent基础维度" },
        { id: "dim-agent-selfcorrect", name: "自主纠错", model_type: "agent", template_name: "Agent基础维度" },
        { id: "dim-agent-deliverable", name: "结果可交付性", model_type: "agent", template_name: "Agent基础维度" },
      ];
      for (const dim of presetDimensions) {
        await client.execute({
          sql: "INSERT OR IGNORE INTO eval_dimensions (id, name, model_type, is_template, template_name) VALUES (?, ?, ?, 1, ?)",
          args: [dim.id, dim.name, dim.model_type, dim.template_name],
        });
      }
    }

    console.log("[DB] 数据库初始化完成");
    return true;
  } catch (error) {
    console.error("[DB] 数据库初始化失败:", error);
    return false;
  }
}

export { schema };
export type Database = NonNullable<ReturnType<typeof getDb>>;
