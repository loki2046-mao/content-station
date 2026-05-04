import { v4 as uuid } from "uuid";
import { gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { hotspotItems } from "@/lib/db/schema";
import { fetchAllHotspots, HotspotEntry } from "@/lib/hotspots/fetchers";

type Db = NonNullable<ReturnType<typeof getDb>>;
type NewHotspotItem = typeof hotspotItems.$inferInsert;

export interface ExternalHotspotItem {
  title?: unknown;
  url?: unknown;
  heat_score?: unknown;
  heatScore?: unknown;
  summary?: unknown;
  author?: unknown;
  source?: unknown;
  tags?: unknown;
}

export interface SaveHotspotsInput {
  items?: unknown;
  autoFetch?: unknown;
}

export interface SaveHotspotsResult {
  total: number;
  inserted: number;
  duplicates: number;
  skippedEmptyTitle: number;
  sources: string[];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value ?? "0").replace(/[^\d.-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => String(tag).trim()).filter(Boolean);
}

function normalizeTitle(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function rowFromItem(item: ExternalHotspotItem | HotspotEntry, now: string): NewHotspotItem | null {
  const title = normalizeTitle(item.title);
  if (!title) return null;
  const heatScore =
    "heat_score" in item && item.heat_score !== undefined ? item.heat_score : item.heatScore;

  return {
    id: uuid(),
    source: normalizeTitle(item.source) || "unknown",
    title,
    url: normalizeTitle(item.url),
    heatScore: toNumber(heatScore),
    summary: normalizeTitle(item.summary),
    author: normalizeTitle(item.author),
    tags: JSON.stringify(normalizeTags(item.tags)),
    status: "new",
    fetchedAt: now,
    createdAt: now,
  };
}

export async function saveHotspots(
  db: Db,
  input: SaveHotspotsInput
): Promise<SaveHotspotsResult> {
  const now = new Date().toISOString();
  const rows: NewHotspotItem[] = [];
  let skippedEmptyTitle = 0;

  if (Array.isArray(input.items)) {
    for (const item of input.items as ExternalHotspotItem[]) {
      const row = rowFromItem(item, now);
      if (row) rows.push(row);
      else skippedEmptyTitle += 1;
    }
  }

  if (input.autoFetch) {
    const fetched = await fetchAllHotspots();
    for (const item of fetched) {
      const row = rowFromItem(item, now);
      if (row) rows.push(row);
      else skippedEmptyTitle += 1;
    }
  }

  if (rows.length === 0) {
    return {
      total: 0,
      inserted: 0,
      duplicates: 0,
      skippedEmptyTitle,
      sources: [],
    };
  }

  const existingRows = await db
    .select({ title: hotspotItems.title, source: hotspotItems.source })
    .from(hotspotItems)
    .where(gte(hotspotItems.fetchedAt, new Date(Date.now() - 3 * 86400000).toISOString()));

  const existingSet = new Set(existingRows.map((row) => `${row.source}::${row.title}`));
  const batchSet = new Set<string>();
  const deduped = rows.filter((row) => {
    const key = `${row.source}::${row.title}`;
    if (existingSet.has(key) || batchSet.has(key)) return false;
    batchSet.add(key);
    return true;
  });

  if (deduped.length > 0) {
    for (let i = 0; i < deduped.length; i += 50) {
      await db.insert(hotspotItems).values(deduped.slice(i, i + 50));
    }
  }

  return {
    total: rows.length,
    inserted: deduped.length,
    duplicates: rows.length - deduped.length,
    skippedEmptyTitle,
    sources: Array.from(new Set(rows.map((row) => row.source))).sort(),
  };
}
