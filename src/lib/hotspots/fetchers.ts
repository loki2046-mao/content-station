/**
 * 热点抓取逻辑
 *
 * 设计思路：
 * - 可靠的公开 API 渠道（HN API）直接 fetch
 * - 其他渠道通过搜索型方式或外部推送（POST /api/hotspots）写入
 * - fetchAllHotspots() 作为统一入口，合并所有可自动抓取的渠道
 */

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
    const data = await res.json();

    const cards = data?.data?.cards?.[0]?.content || [];
    const items: HotspotEntry[] = [];

    for (const card of cards.slice(0, 20)) {
      items.push({
        title: card.word || card.query || "",
        url: card.url || card.rawUrl || "",
        heatScore: parseInt(card.hotScore || "0", 10),
        summary: card.desc || "",
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
        heatScore: parseInt(item.num || "0", 10),
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
        heatScore: Math.round(entry.detail_text ? parseInt(entry.detail_text) : 0),
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
 * 统一入口：抓取所有可自动获取的热点源
 * 使用 Promise.allSettled 确保单个渠道失败不影响整体
 */
export async function fetchAllHotspots(): Promise<HotspotEntry[]> {
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
