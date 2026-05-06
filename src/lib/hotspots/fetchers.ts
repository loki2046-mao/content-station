/**
 * 热点抓取逻辑
 *
 * 设计思路：
 * - fetchAllHotspots() 默认使用 Cola 选题来源配置
 * - 每个来源用 searchQuery 拉取新闻搜索 RSS，保证“立即抓取”和 Cola 配置一致
 * - 公共热榜抓取器保留为可选能力，但不再默认混入 Hacker News 等泛技术源
 */
import { COLA_TOPIC_SOURCES, TopicSourceConfig } from "@/lib/hotspots/sources";

/** 热点条目统一格式 */
export interface HotspotEntry {
  title: string;
  url: string;
  heatScore: number;
  summary: string;
  author: string;
  source: string;
  tags: string[];
}

type AnyRecord = Record<string, unknown>;

const DEFAULT_ITEMS_PER_TOPIC_SOURCE = 5;

function asArray<T = AnyRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = Number.parseInt(text || "0", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function topicPriorityScore(priority: TopicSourceConfig["priority"]): number {
  if (priority === "high") return 900;
  if (priority === "medium") return 600;
  return 300;
}

function buildGoogleNewsRssUrl(source: TopicSourceConfig): string {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${source.searchQuery} when:2d`);
  url.searchParams.set("hl", "zh-CN");
  url.searchParams.set("gl", "CN");
  url.searchParams.set("ceid", "CN:zh-Hans");
  return url.toString();
}

function buildBingNewsRssUrl(source: TopicSourceConfig): string {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", source.searchQuery);
  url.searchParams.set("format", "rss");
  url.searchParams.set("cc", "cn");
  url.searchParams.set("setlang", "zh-Hans");
  return url.toString();
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cleanXmlText(text: string): string {
  return decodeXml(text)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getXmlTagText(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanXmlText(match[1]) : "";
}

function cleanNewsTitle(title: string, publisher: string): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

// 垃圾标题过滤：过滤博彩、广告、乱码等
const SPAM_PATTERNS = [
  /Results for ["\s]*=/i,         // Results for "=...
  /官网[：:]/,                      // 官网：xxx.tw
  /TG[：:]/i,                       // TG: 电报联系
  /\.tw｝/,                         // .tw｝ 博彩域名
  /\.(byc|jcz|lof|rjf|bcz)"\s*-/,  // 乱码后缀
  /Bastion X/i,                     // 具体垃圾词
  /整合市場/,
  /高效決策/,
  /投資行為/,
  /博彩|賭博|彩票|老虎機/,
];

function isSpamTitle(title: string): boolean {
  return SPAM_PATTERNS.some((pattern) => pattern.test(title));
}

function parseNewsRss(xml: string, source: TopicSourceConfig): HotspotEntry[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return itemBlocks
    .slice(0, DEFAULT_ITEMS_PER_TOPIC_SOURCE * 3) // 多取一些，过滤后保留足够数量
    .map((block, index) => {
      const publisher = getXmlTagText(block, "source");
      const rawTitle = getXmlTagText(block, "title");
      const title = cleanNewsTitle(rawTitle, publisher);
      if (!title) return null;
      if (isSpamTitle(title)) return null; // 过滤垃圾

      const pubDate = getXmlTagText(block, "pubDate");
      const summary = getXmlTagText(block, "description");
      const url = getXmlTagText(block, "link");
      const tags = [source.name, source.type, source.priority, publisher].filter(Boolean);

      return {
        title,
        url,
        heatScore: topicPriorityScore(source.priority) - index,
        summary: summary || `来自 Cola 选题来源「${source.name}」：${source.searchQuery}`,
        author: publisher,
        source: source.name,
        tags,
        fetchedAt: pubDate,
      } as HotspotEntry & { fetchedAt?: string };
    })
    .filter((item): item is HotspotEntry => Boolean(item))
    .slice(0, DEFAULT_ITEMS_PER_TOPIC_SOURCE);
}

async function fetchNewsRss(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`News RSS ${res.status}`);
  return res.text();
}

async function fetchTopicSourceNews(source: TopicSourceConfig): Promise<HotspotEntry[]> {
  const rssUrls = [buildGoogleNewsRssUrl(source), buildBingNewsRssUrl(source)];
  let lastError: unknown = null;

  for (const rssUrl of rssUrls) {
    try {
      const items = parseNewsRss(await fetchNewsRss(rssUrl), source);
      if (items.length > 0) return items;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`[Hotspot] Cola 来源「${source.name}」抓取失败:`, lastError);
  return [];
}

export async function fetchColaTopicSources(
  sources: readonly TopicSourceConfig[] = COLA_TOPIC_SOURCES
): Promise<HotspotEntry[]> {
  const activeSources = sources.filter((source) => source.enabled !== false);
  const results = await Promise.allSettled(activeSources.map(fetchTopicSourceNews));

  const allItems: HotspotEntry[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  return allItems;
}

/**
 * 抓取 Hacker News Top Stories（前 20 条）
 * 使用公开 Firebase API，无需认证
 */
export async function fetchHackerNews(): Promise<HotspotEntry[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HN API ${res.status}`);
    const ids: number[] = await res.json();
    const top20 = ids.slice(0, 20);

    // 并行获取每条 story 的详情
    const stories = await Promise.allSettled(
      top20.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          next: { revalidate: 0 },
        });
        if (!r.ok) return null;
        return r.json();
      })
    );

    const items: HotspotEntry[] = [];
    for (const result of stories) {
      if (result.status === "fulfilled" && result.value) {
        const s = result.value;
        items.push({
          title: s.title || "",
          url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
          heatScore: s.score || 0,
          summary: s.text ? s.text.slice(0, 200) : "",
          author: s.by || "",
          source: "hackernews",
          tags: ["HackerNews", "Tech"],
        });
      }
    }
    return items;
  } catch (error) {
    console.error("[Hotspot] HN 抓取失败:", error);
    return [];
  }
}

/**
 * 抓取百度热搜（前 20 条）
 * 尝试直接 fetch 百度热搜页面，解析 JSON 数据
 */
export async function fetchBaiduHot(): Promise<HotspotEntry[]> {
  try {
    const res = await fetch("https://top.baidu.com/api/board?platform=wise&tab=realtime", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Baidu API ${res.status}`);
    const data = (await res.json()) as AnyRecord;

    const cards = asArray<AnyRecord>((data.data as AnyRecord | undefined)?.cards);
    const entries = cards.flatMap((card) => {
      const content = asArray<AnyRecord>(card.content);
      return content.flatMap((entry) => asArray<AnyRecord>(entry.content).concat(entry));
    });
    const items: HotspotEntry[] = [];

    for (const card of entries.slice(0, 20)) {
      const title = String(card.word || card.query || "").trim();
      if (!title) continue;
      items.push({
        title,
        url: String(card.url || card.rawUrl || ""),
        heatScore: toNumber(card.hotScore),
        summary: String(card.desc || ""),
        author: "",
        source: "baidu",
        tags: ["百度热搜"],
      });
    }
    return items;
  } catch (error) {
    console.error("[Hotspot] 百度热搜抓取失败:", error);
    return [];
  }
}

/**
 * 抓取微博热搜
 * 使用微博 AJAX API
 */
export async function fetchWeiboHot(): Promise<HotspotEntry[]> {
  try {
    const res = await fetch("https://weibo.com/ajax/side/hotSearch", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Weibo API ${res.status}`);
    const data = await res.json();

    const realtime = data?.data?.realtime || [];
    const items: HotspotEntry[] = [];

    for (const item of realtime.slice(0, 20)) {
      items.push({
        title: item.note || item.word || "",
        url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(item.word || "")}%23`,
        heatScore: toNumber(item.num),
        summary: item.label_name || "",
        author: "",
        source: "weibo",
        tags: ["微博热搜"],
      });
    }
    return items;
  } catch (error) {
    console.error("[Hotspot] 微博热搜抓取失败:", error);
    return [];
  }
}

/**
 * 抓取知乎热榜
 */
export async function fetchZhihuHot(): Promise<HotspotEntry[]> {
  try {
    const res = await fetch("https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=20", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Zhihu API ${res.status}`);
    const data = await res.json();

    const list = data?.data || [];
    const items: HotspotEntry[] = [];

    for (const entry of list.slice(0, 20)) {
      const target = entry.target || {};
      items.push({
        title: target.title || "",
        url: target.url ? `https://www.zhihu.com/question/${target.id}` : "",
        heatScore: Math.round(toNumber(entry.detail_text)),
        summary: target.excerpt || "",
        author: "",
        source: "zhihu",
        tags: ["知乎热榜"],
      });
    }
    return items;
  } catch (error) {
    console.error("[Hotspot] 知乎热榜抓取失败:", error);
    return [];
  }
}

/**
 * 统一入口：按 Cola 选题来源配置抓取。
 * 使用 Promise.allSettled 确保单个来源失败不影响整体。
 */
export async function fetchAllHotspots(
  sources: readonly TopicSourceConfig[] = COLA_TOPIC_SOURCES
): Promise<HotspotEntry[]> {
  return fetchColaTopicSources(sources);
}

/**
 * 可选公共热榜入口。
 * 保留给未来需要“全网泛热榜”时显式调用，避免默认立即抓取混入 Hacker News。
 */
export async function fetchPublicHotspotFeeds(): Promise<HotspotEntry[]> {
  const results = await Promise.allSettled([
    fetchHackerNews(),
    fetchBaiduHot(),
    fetchWeiboHot(),
    fetchZhihuHot(),
  ]);

  const allItems: HotspotEntry[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  return allItems;
}
