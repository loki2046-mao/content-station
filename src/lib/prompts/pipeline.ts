/**
 * Pipeline 各阶段 LLM Prompt 模板
 * 统一 JSON 输出，中文风格，参考 analyze.ts / outline.ts 的写法
 */

/** 系统提示词 */
export const PIPELINE_SYSTEM_PROMPT =
  "你是一个经验丰富的公众号内容策划师和写手，了解中文互联网的传播规律。你的建议具体、可执行、接地气，不说正确的废话，不用AI味道浓的套话。所有输出必须是严格合法的JSON格式。";

// ─────────────────────────────────────────────
// Stage 1: 选题分析
// ─────────────────────────────────────────────
export function buildTopicAnalysisPrompt(params: {
  title: string;
  note?: string;
}): string {
  const { title, note } = params;
  return `你是一个资深公众号内容策划，现在需要分析一个选题，给出2-3个最适合公众号传播的写作切口。

文章标题（选题方向）：${title}${note ? `\n备注信息：${note}` : ""}

请分析这个选题，输出2-3个不同的写作切口角度。每个角度要有明显差异，适合不同的读者心理和传播场景。

角度类型参考：
- 实用干货型（教方法、给工具）
- 观点输出型（有立场、有态度）
- 故事叙述型（有情节、有共鸣）
- 盘点分析型（梳理现象、给结论）
- 反常识型（打破认知、引发好奇）

请严格按以下JSON格式输出，不要输出其他内容，不要用markdown包裹：

{
  "angles": [
    {
      "name": "切口名称（4-8个字）",
      "description": "这个切口的具体写法：写什么、从哪个视角切入、核心内容是什么",
      "targetAudience": "这篇文章最适合谁看，他们读完能得到什么",
      "articleType": "观点文/体验文/教程文/故事文/盘点文",
      "spreadPotential": "传播潜力分析：为什么这个角度适合公众号传播"
    }
  ]
}

要求：
1. 2-3个切口，不要全是同一种类型
2. 每个切口要有实质性差异，不能只是换个说法
3. description 要具体到"怎么写"而不是"应该写什么"
4. targetAudience 要精准，不要写"广大读者"这种废话`;
}

// ─────────────────────────────────────────────
// Stage 2: 素材收集建议
// ─────────────────────────────────────────────
export function buildMaterialSuggestionPrompt(params: {
  title: string;
  angle: string;
  existingMaterials: Array<{ id: string; content: string; type: string; tags: string }>;
}): string {
  const { title, angle, existingMaterials } = params;

  const materialsText =
    existingMaterials.length > 0
      ? existingMaterials
          .map(
            (m, i) =>
              `素材${i + 1}（${m.type}）[标签:${m.tags}]：${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}`
          )
          .join("\n")
      : "（素材库暂无相关素材）";

  return `你是一个公众号写作助手，现在要帮作者整理写文章用的素材。

文章选题：${title}
写作切口：${angle}

已有素材库（匹配结果）：
${materialsText}

请分析：
1. 已有素材中哪些对这篇文章有用（可以用来做案例、引用、佐证）
2. 写这篇文章还缺什么素材（具体缺什么类型的素材，从哪里能找到）

请严格按以下JSON格式输出，不要输出其他内容，不要用markdown包裹：

{
  "usefulMaterials": [
    {
      "id": "素材ID（用已有素材的id字段）",
      "content": "素材内容摘要",
      "howToUse": "这个素材怎么用到文章里，放在哪个部分，起什么作用"
    }
  ],
  "suggestions": [
    {
      "type": "缺什么类型的素材（案例/数据/引用/图片/个人经历等）",
      "description": "具体需要什么样的素材",
      "findWhere": "可以从哪里找到（微博/知乎/自身经历/行业报告等）"
    }
  ],
  "summary": "总体判断：现有素材够不够用，写这篇文章最重要的素材是什么"
}

要求：
1. usefulMaterials 只列真正有用的，不要凑数
2. suggestions 要具体，不要写"收集相关素材"这种废话
3. 如果素材库里没有匹配的，usefulMaterials 可以为空数组`;
}

// ─────────────────────────────────────────────
// Stage 3: 骨架生成
// ─────────────────────────────────────────────
export function buildSkeletonPrompt(params: {
  title: string;
  angle: string;
  materialSummary?: string;
}): string {
  const { title, angle, materialSummary } = params;

  return `你是一个擅长搭文章结构的公众号写作教练。

请为以下文章生成一个完整的写作骨架。

文章标题（方向）：${title}
写作切口：${angle}${materialSummary ? `\n可用素材情况：${materialSummary}` : ""}

骨架要体现：
- 好的叙事逻辑（不是信息堆砌，是情绪/认知的编排）
- 开头抓人，中间有料，结尾有味道
- 各章节之间有递进关系，不是平行罗列

请严格按以下JSON格式输出，不要输出其他内容，不要用markdown包裹：

{
  "sections": [
    {
      "title": "章节标题（可以是小标题，也可以是描述性短语）",
      "keyPoints": [
        "这个章节要表达的核心观点或内容（具体，不是标题的复述）",
        "关键素材或案例的位置"
      ],
      "estimatedWords": 300,
      "contentType": "开头引入/观点输出/案例展开/数据佐证/情感共鸣/结尾升华"
    }
  ],
  "totalEstimatedWords": 2000,
  "writingTip": "写这篇文章最重要的一点提示（比如：语气要接地气，不要太学术；要有第一人称的亲历感；等等）"
}

要求：
1. 章节数量：3-6个（根据内容复杂度决定，不要强行凑数）
2. estimatedWords 每章合理估算，总字数控制在1500-3000字
3. keyPoints 要具体到"写什么"，不是"这章很重要"
4. 整个骨架读下来应该有完整的起承转合`;
}

// ─────────────────────────────────────────────
// Stage 4: 初稿撰写
// ─────────────────────────────────────────────
export function buildDraftWritingPrompt(params: {
  title: string;
  angle: string;
  skeleton: string;
  materialSummary?: string;
}): string {
  const { title, angle, skeleton, materialSummary } = params;

  return `你是一个擅长写公众号文章的写手，文风接地气、有个人温度、不AI。

请根据以下信息，写一篇完整的公众号初稿。

文章标题：${title}
写作切口：${angle}
文章骨架：
${skeleton}
${materialSummary ? `\n可用素材参考：\n${materialSummary}` : ""}

写作要求：
1. 用 Markdown 格式输出全文
2. 开头不要用"在这个xxx的时代"这种套话，要有代入感
3. 正文要有自己的判断和立场，不只是描述
4. 语气像一个真实的人在写，有温度，偶尔可以有个人经历感
5. 不要堆砌术语，要让普通读者能读懂
6. 结尾要有力，可以是金句、反问或行动号召，不要虎头蛇尾
7. 字数控制在骨架预估范围内，不要水

请严格按以下JSON格式输出，不要输出其他内容，不要用markdown代码块包裹整个JSON：

{
  "content": "全文Markdown内容（在这里放完整正文，包含标题、各章节、结尾）",
  "wordCount": 2000
}

注意：content字段里的值是Markdown文本，可以包含 ## 标题、**加粗** 等Markdown语法，但整个JSON本身不要用markdown代码块包裹。`;
}

// ─────────────────────────────────────────────
// Stage 6: 封面设计
// ─────────────────────────────────────────────
export function buildCoverDesignPrompt(params: {
  title: string;
  angle: string;
  draftSummary?: string;
}): string {
  const { title, angle, draftSummary } = params;

  return `你是一个公众号封面设计顾问，擅长把文章内容转化成有传播力的封面方案。

文章标题：${title}
写作切口：${angle}${draftSummary ? `\n文章主要内容：${draftSummary}` : ""}

请给出3个封面设计方案，包含封面大字（标题）和视觉方向描述。

封面大字要求：
- 6个字以内
- 有视觉冲击力，适合做大字放在封面图上
- 和正文标题可以不同，封面更追求视觉效果

视觉描述要求：
- 说清楚封面图的主视觉是什么（人物/场景/图表/纯文字/插画）
- 颜色风格（深色/浅色/某种色调）
- 整体感觉（活泼/严肃/温暖/科技感/生活感）

请严格按以下JSON格式输出，不要输出其他内容，不要用markdown包裹：

{
  "titleOptions": [
    {
      "coverText": "封面大字（6字以内）",
      "style": "标题风格（悬念型/结论型/情绪型/反问型）",
      "reason": "为什么这个封面大字适合这篇文章"
    }
  ],
  "visualDescription": "整体视觉方向建议：描述封面图的主视觉元素、颜色风格、整体调性",
  "imagePrompt": "可以直接用于AI生图的英文prompt（简洁，描述画面构成）"
}

要求：
1. titleOptions 给3个方案，风格要有差异
2. visualDescription 要具体，给出有操作性的方向
3. imagePrompt 要简洁有效，适合 Midjourney/DALL-E 使用`;
}

/**
 * 解析 LLM 返回的 JSON，支持 markdown 代码块包裹的情况
 */
export function parseLLMJson<T = unknown>(raw: string): T {
  let str = raw.trim();

  // 去掉 markdown 代码块
  const fenceMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    str = fenceMatch[1].trim();
  }

  // 尝试直接解析
  try {
    return JSON.parse(str) as T;
  } catch {
    // 尝试找到第一个 { 或 [ 到最后一个 } 或 ]
    const objMatch = str.match(/(\{[\s\S]*\})/);
    const arrMatch = str.match(/(\[[\s\S]*\])/);
    const match = objMatch || arrMatch;
    if (match) {
      return JSON.parse(match[1]) as T;
    }
    throw new Error(`无法解析LLM输出为JSON: ${str.slice(0, 200)}`);
  }
}
