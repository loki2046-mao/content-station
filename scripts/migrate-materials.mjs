#!/usr/bin/env node
/**
 * 一次性迁移脚本：把旧数据搬到统一 materials 表
 * - content_items（外脑）→ materials with source_origin='external_brain'
 * - content_materials（测评）→ materials with source_origin='eval'
 *
 * 运行方式（项目根目录下）：
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate-materials.mjs
 *
 * 默认是 dry-run，加 --apply 才真正写入：
 *   node scripts/migrate-materials.mjs --apply
 *
 * 幂等：通过 materials.metadata.contentItemId / contentMaterialId 去重，重复运行不会重复插入。
 * 不会删除旧表里的数据，只做单向复制。
 */

import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");

function env(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ 缺少环境变量 ${name}`);
    process.exit(1);
  }
  return v;
}

const client = createClient({
  url: env("TURSO_DATABASE_URL"),
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [name],
  });
  return r.rows.length > 0;
}

async function alreadyMigrated(metadataKey, sourceId) {
  // 通过 metadata 里的 key 检测是否已经迁移过
  const r = await client.execute({
    sql: `SELECT id FROM materials WHERE metadata LIKE ? LIMIT 1`,
    args: [`%"${metadataKey}":"${sourceId}"%`],
  });
  return r.rows.length > 0;
}

const ALLOWED_EI_TYPES = new Set([
  "ei_opinion",
  "ei_title",
  "ei_topic",
  "ei_product_obs",
  "ei_quote",
]);

async function migrateContentItems() {
  if (!(await tableExists("content_items"))) {
    console.log("ℹ️  content_items 表不存在，跳过");
    return { total: 0, migrated: 0, skipped: 0 };
  }
  const r = await client.execute("SELECT * FROM content_items");
  let migrated = 0;
  let skipped = 0;
  for (const row of r.rows) {
    if (await alreadyMigrated("contentItemId", row.id)) {
      skipped++;
      continue;
    }
    const eiType = String(row.item_type || "");
    const mirrorType = ALLOWED_EI_TYPES.has(eiType) ? eiType : "ei_opinion";
    const metadata = JSON.stringify({
      contentItemId: row.id,
      inboxId: row.source_inbox_id || "",
      eiType,
      title: row.title || "",
      relatedTopic: row.related_topic || "",
      relatedProduct: row.related_product || "",
      legacy: true,
    });
    if (APPLY) {
      await client.execute({
        sql: `INSERT INTO materials (id, content, type, tags, topic_ids, source_type, source_id, source_origin, metadata, created_at)
              VALUES (?, ?, ?, ?, '[]', ?, ?, 'external_brain', ?, ?)`,
        args: [
          randomUUID(),
          row.content,
          mirrorType,
          row.tags || "[]",
          "external_brain",
          row.id,
          metadata,
          row.created_at || new Date().toISOString(),
        ],
      });
    }
    migrated++;
  }
  return { total: r.rows.length, migrated, skipped };
}

async function migrateContentMaterials() {
  if (!(await tableExists("content_materials"))) {
    console.log("ℹ️  content_materials 表不存在，跳过");
    return { total: 0, migrated: 0, skipped: 0 };
  }
  const r = await client.execute("SELECT * FROM content_materials");
  let migrated = 0;
  let skipped = 0;
  for (const row of r.rows) {
    if (await alreadyMigrated("contentMaterialId", row.id)) {
      skipped++;
      continue;
    }
    const content =
      row.extractable_insight ||
      row.highlights ||
      row.issues ||
      row.task_description ||
      "（无内容）";
    let titleDirections = [];
    let articleAngles = [];
    try {
      titleDirections = row.title_directions ? JSON.parse(row.title_directions) : [];
    } catch {}
    try {
      articleAngles = row.article_angles ? JSON.parse(row.article_angles) : [];
    } catch {}
    const metadata = JSON.stringify({
      contentMaterialId: row.id,
      testSubject: row.test_subject || "",
      evalGoal: row.eval_goal || "",
      taskDescription: row.task_description || "",
      resultSummary: row.result_summary || "",
      highlights: row.highlights || "",
      issues: row.issues || "",
      titleDirections,
      articleAngles,
      legacy: true,
    });
    if (APPLY) {
      await client.execute({
        sql: `INSERT INTO materials (id, content, type, tags, topic_ids, source_type, source_id, source_origin, metadata, created_at)
              VALUES (?, ?, 'eval_result', '["测评"]', '[]', ?, ?, 'eval', ?, ?)`,
        args: [
          randomUUID(),
          content,
          row.source_type || "eval_result",
          row.source_id || row.id,
          metadata,
          row.created_at || new Date().toISOString(),
        ],
      });
    }
    migrated++;
  }
  return { total: r.rows.length, migrated, skipped };
}

async function main() {
  console.log(APPLY ? "🚀 APPLY 模式：将真正写入数据" : "🧪 DRY-RUN 模式：仅统计，不写入（加 --apply 真正执行）");
  console.log("");

  const ci = await migrateContentItems();
  console.log(`📥 content_items：共 ${ci.total} 条，待迁移 ${ci.migrated} 条，已迁移过 ${ci.skipped} 条`);

  const cm = await migrateContentMaterials();
  console.log(`📥 content_materials：共 ${cm.total} 条，待迁移 ${cm.migrated} 条，已迁移过 ${cm.skipped} 条`);

  console.log("");
  console.log("✅ 完成。旧表数据未删除，可继续保留作为安全备份。");
  if (!APPLY) {
    console.log("👉 确认数字无误后，加 --apply 真正执行：");
    console.log("   node scripts/migrate-materials.mjs --apply");
  }
}

main().catch((e) => {
  console.error("❌ 迁移失败：", e);
  process.exit(1);
});
