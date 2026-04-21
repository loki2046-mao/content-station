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

// ============ AI 测评工作台 ============

// 测评项目
export const evalProjects = sqliteTable("eval_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  goalType: text("goal_type").default(""),
  modelType: text("model_type", { enum: ["text", "image", "video", "agent"] }).notNull().default("text"),
  status: text("status", { enum: ["draft", "active", "completed"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 维度库（可复用）
export const evalDimensions = sqliteTable("eval_dimensions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  modelType: text("model_type").notNull().default("text"),
  isTemplate: integer("is_template").notNull().default(0),
  templateName: text("template_name").default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 项目-维度关联
export const evalProjectDimensions = sqliteTable("eval_project_dimensions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  dimensionId: text("dimension_id").notNull(),
});

// 测试 Case
export const evalCases = sqliteTable("eval_cases", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  dimensionId: text("dimension_id").default(""),
  title: text("title").notNull(),
  description: text("description").default(""),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull().default("medium"),
  status: text("status", { enum: ["draft", "active"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Prompt（挂在 Case 下）
export const evalPrompts = sqliteTable("eval_prompts", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull(),
  modelTarget: text("model_target").default(""),
  content: text("content").notNull(),
  difficulty: text("difficulty").default("medium"),
  isSaved: integer("is_saved").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 测试结果
export const evalTestResults = sqliteTable("eval_test_results", {
  id: text("id").primaryKey(),
  promptId: text("prompt_id").default(""),
  caseId: text("case_id").notNull(),
  modelUsed: text("model_used").default(""),
  testedAt: text("tested_at").notNull().default(sql`(datetime('now'))`),
  outputUrl: text("output_url").default(""),
  rating: text("rating", { enum: ["success", "fail", "crash", "exceed"] }).default("success"),
  highlights: text("highlights").default(""),
  issues: text("issues").default(""),
  worthWriting: integer("worth_writing").notNull().default(0),
  extractableInsight: text("extractable_insight").default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 提炼观点
export const evalInsights = sqliteTable("eval_insights", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  sourceResultId: text("source_result_id").default(""),
  content: text("content").notNull(),
  tags: text("tags").default("[]"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 素材库（测评 + 内容创作共用）
export const contentMaterials = sqliteTable("content_materials", {
  id: text("id").primaryKey(),
  sourceType: text("source_type", { enum: ["eval_result", "eval_insight", "manual"] }).notNull().default("manual"),
  sourceId: text("source_id").default(""),
  testSubject: text("test_subject").default(""),
  evalGoal: text("eval_goal").default(""),
  evalDimension: text("eval_dimension").default(""),
  taskDescription: text("task_description").default(""),
  resultSummary: text("result_summary").default(""),
  highlights: text("highlights").default(""),
  issues: text("issues").default(""),
  extractableInsight: text("extractable_insight").default(""),
  titleDirections: text("title_directions").default(""),
  articleAngles: text("article_angles").default(""),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 多类型模型配置
export const evalModelConfigs = sqliteTable("eval_model_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  modelType: text("model_type", { enum: ["text", "image", "video", "agent"] }).notNull().default("text"),
  provider: text("provider").default(""),
  apiKey: text("api_key").default(""),
  baseUrl: text("base_url").default(""),
  modelName: text("model_name").default(""),
  extraConfig: text("extra_config").default("{}"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ============ 类型导出 ============
export type EvalProject = typeof evalProjects.$inferSelect;
export type NewEvalProject = typeof evalProjects.$inferInsert;
export type EvalDimension = typeof evalDimensions.$inferSelect;
export type NewEvalDimension = typeof evalDimensions.$inferInsert;
export type EvalCase = typeof evalCases.$inferSelect;
export type NewEvalCase = typeof evalCases.$inferInsert;
export type EvalPrompt = typeof evalPrompts.$inferSelect;
export type NewEvalPrompt = typeof evalPrompts.$inferInsert;
export type EvalTestResult = typeof evalTestResults.$inferSelect;
export type NewEvalTestResult = typeof evalTestResults.$inferInsert;
export type EvalInsight = typeof evalInsights.$inferSelect;
export type NewEvalInsight = typeof evalInsights.$inferInsert;
export type ContentMaterial = typeof contentMaterials.$inferSelect;
export type NewContentMaterial = typeof contentMaterials.$inferInsert;
export type EvalModelConfig = typeof evalModelConfigs.$inferSelect;
export type NewEvalModelConfig = typeof evalModelConfigs.$inferInsert;

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
