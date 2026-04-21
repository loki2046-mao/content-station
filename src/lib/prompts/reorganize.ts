/**
 * 素材重组 Prompt
 * 输入多个素材，输出候选文章结构
 */

export function buildReorganizePrompt(materials: string[]): string {
  const materialList = materials
    .map((m, i) => `素材${i + 1}：${m}`)
    .join("\n\n");

  return `你是一个擅长从碎片素材中发现文章可能性的内容策划。

我有以下素材，请帮我分析它们之间的关联，并给出2-3个候选的文章结构方案。

${materialList}

请严格按以下JSON格式输出，不要输出其他内容：

\`\`\`json
[
  {
    "id": "1",
    "theme": "文章主题",
    "angle": "切入角度",
    "structure": "简要结构描述（用→连接各部分）",
    "materialUsage": [
      {"materialIndex": 1, "usage": "这个素材在文章中怎么用"},
      {"materialIndex": 2, "usage": "这个素材在文章中怎么用"}
    ],
    "feasibility": "high/medium/low",
    "reason": "为什么可行/不可行"
  }
]
\`\`\`

要求：
1. 每个方案的主题和角度要有差异
2. 不是每个素材都必须用到，但要说明哪些用了、怎么用
3. feasibility 基于素材的丰富度和文章的完整度判断
4. 方案要适合公众号传播`;
}

/** 素材重组的系统提示词 */
export const REORGANIZE_SYSTEM_PROMPT =
  "你是一个擅长从碎片中发现叙事线索的内容编辑。你能看到素材之间隐藏的关联，并把它们编织成有吸引力的文章结构。";
