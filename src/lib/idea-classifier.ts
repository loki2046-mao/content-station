/**
 * 外脑收件箱规则分类器
 * 基于关键词/长度/结构判断 suggested_type
 * 不依赖 AI，纯规则。预留 classifyWithAI 接口。
 */

const TITLE_PATTERNS = [
  /^[为什么|如何|怎么|这|那|我|你|他|她].{0,20}[？?！!]$/,
  /[0-9０-９][个只件种]/,
  /《.{2,20}》/,
  /[|｜]\s*.+\s*[|｜]/,
];
const OPINION_KEYWORDS = ["我认为", "我觉得", "本质上", "其实", "真相是", "问题在于", "核心是", "关键是", "根本原因"];
const PRODUCT_KEYWORDS = ["GPT", "Claude", "Gemini", "Midjourney", "Stable Diffusion", "Sora", "DALL-E", "Flux", "AI工具", "AI产品", "模型", "测评", "对比"];
const TOPIC_KEYWORDS = ["可以写", "值得写", "选题", "想写", "准备写", "下次写", "文章方向"];
const QUOTE_PATTERNS = [
  /^".+"/,
  /^「.+」/,
  /^『.+』/,
];

export type SuggestedType = 'title_inspiration' | 'opinion' | 'topic' | 'product_obs' | 'quote' | 'raw';

export function classify(text: string): { suggestedType: SuggestedType; suggestedTags: string[] } {
  const t = text.trim();
  const tags: string[] = [];

  // 引用句型
  if (QUOTE_PATTERNS.some(p => p.test(t))) {
    return { suggestedType: 'quote', suggestedTags: ['金句'] };
  }
  // 标题型
  if (TITLE_PATTERNS.some(p => p.test(t)) || (t.length < 30 && (t.endsWith('？') || t.endsWith('!')))) {
    tags.push('标题灵感');
    return { suggestedType: 'title_inspiration', suggestedTags: tags };
  }
  // 选题
  if (TOPIC_KEYWORDS.some(k => t.includes(k))) {
    return { suggestedType: 'topic', suggestedTags: ['选题'] };
  }
  // 产品观察
  if (PRODUCT_KEYWORDS.some(k => t.includes(k))) {
    tags.push('产品观察');
    return { suggestedType: 'product_obs', suggestedTags: tags };
  }
  // 观点
  if (OPINION_KEYWORDS.some(k => t.includes(k)) || t.length > 80) {
    return { suggestedType: 'opinion', suggestedTags: ['观点'] };
  }

  return { suggestedType: 'raw', suggestedTags: [] };
}

// 预留 AI 分类接口（第一版不实现）
export async function classifyWithAI(_text: string): Promise<{ suggestedType: SuggestedType; suggestedTags: string[] }> {
  throw new Error('AI 分类尚未实现');
}
