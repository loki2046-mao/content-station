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
    `);

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

    console.log("[DB] 数据库初始化完成");
    return true;
  } catch (error) {
    console.error("[DB] 数据库初始化失败:", error);
    return false;
  }
}

export { schema };
export type Database = NonNullable<ReturnType<typeof getDb>>;
