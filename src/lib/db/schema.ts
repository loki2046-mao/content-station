/**
 * 数据库 Schema 定义
 * 使用 Drizzle ORM + SQLite (Turso/libSQL)
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============ 选题池 ============
export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(), // UUID
  title: text("title").notNull(),
  source: text("source").default(""), // 来源（链接/手动/导入）
  summary: text("summary").default(""), // 摘要
  status: text("status", {
    enum: ["unprocessed", "analyzed", "drafted", "published", "paused"],
  })
    .notNull()
    .default("unprocessed"),
  tags: text("tags").default("[]"), // JSON 数组
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ 切口分析 ============
export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  topicId: text("topic_id"), // 可为空，支持直接输入
  inputText: text("input_text").notNull(), // 输入的话题文本
  result: text("result").default("[]"), // JSON：6个切口的完整数据
  modelUsed: text("model_used").default(""),
  isFavorited: integer("is_favorited", { mode: "boolean" }).default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ 标题方案 ============
export const titles = sqliteTable("titles", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull(),
  analysisId: text("analysis_id"), // 关联切口分析（可选）
  inputContext: text("input_context").default(""), // 输入上下文
  result: text("result").default("[]"), // JSON：生成结果
  favorites: text("favorites").default("[]"), // JSON：收藏的标题ID
  modelUsed: text("model_used").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ 文章骨架 ============
export const outlines = sqliteTable("outlines", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull(),
  analysisId: text("analysis_id"), // 关联切口分析（可选）
  result: text("result").default("{}"), // JSON：骨架内容
  editedResult: text("edited_result"), // JSON：用户编辑后的版本，可为空
  modelUsed: text("model_used").default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ 素材库 ============
export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type", {
    enum: ["opinion", "quote", "title_inspiration", "example", "opening", "closing"],
  }).notNull(),
  tags: text("tags").default("[]"), // JSON 数组
  topicIds: text("topic_ids").default("[]"), // JSON：关联选题ID列表
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ 标签管理 ============
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#B8623C"), // 默认赤铜色
  category: text("category").default("custom"), // 选题类型/写作状态/自定义
});

// ============ 配置 ============
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").default("{}"), // JSON
});

// ============ 类型导出 ============
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type Title = typeof titles.$inferSelect;
export type NewTitle = typeof titles.$inferInsert;
export type Outline = typeof outlines.$inferSelect;
export type NewOutline = typeof outlines.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Setting = typeof settings.$inferSelect;
