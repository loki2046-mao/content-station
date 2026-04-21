/**
 * 骨架生成 Prompt
 * 输入选题+切口，输出结构化的文章骨架
 */

export function buildOutlinePrompt(params: {
  topic: string;
  angle?: string;
}): string {
  const { topic, angle } = params;

  let prompt = `你是一个擅长搭建文章结构的公众号写作教练。

请为以下内容生成一份完整的文章骨架。

选题：${topic}`;

  if (angle) {
    prompt += `\n写作切口：${angle}`;
  }

  prompt += `

骨架要包含：
1. 核心矛盾/核心张力：这篇文章围绕什么核心冲突或张力展开
2. 开头方式：具体怎么开头（不是"引入话题"这种废话，要有具体的场景/问题/事件）
3. 主体部分：3-5个递进的段落结构，每个段落标注：
   - 段落主题
   - 建议内容类型（体验叙述/观点输出/案例分析/数据论证/金句点睛）
   - 关键要点（2-3个具体的点）
   - 适合放什么素材
4. 结尾方式：怎么收尾（升华/呼应/行动号召/留白/提问）

请严格按以下JSON格式输出，不要输出其他内容：

\`\`\`json
{
  "coreTension": "核心矛盾描述",
  "opening": {
    "method": "开头方式名称",
    "description": "具体怎么写",
    "example": "开头第一句话示例"
  },
  "sections": [
    {
      "id": "1",
      "title": "段落主题",
      "contentType": "体验叙述",
      "keyPoints": ["要点1", "要点2", "要点3"],
      "materialSuggestion": "适合放什么类型的素材"
    }
  ],
  "ending": {
    "method": "结尾方式名称",
    "description": "具体怎么收",
    "example": "结尾句示例"
  }
}
\`\`\`

要求：
1. 骨架要有叙事逻辑，不是信息的堆砌
2. 主体部分之间要有递进关系，不是平行罗列
3. 每个部分的建议要具体到"写什么"而不是"应该怎样"
4. 保持公众号文章的节奏感：前半部分抓人，中间有料，结尾有味道`;

  return prompt;
}

/** 骨架生成的系统提示词 */
export const OUTLINE_SYSTEM_PROMPT =
  "你是一个深谙公众号写作节奏的内容架构师。你知道好文章不是信息的堆砌而是情绪的编排，每个段落都有存在的理由。你的建议具体、可执行、不说正确的废话。";
