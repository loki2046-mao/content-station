/**
 * 设置页面
 * 模型配置、标签管理、数据导入导出
 */
"use client";

import { useState, useEffect } from "react";
import { useApiGet, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/loading";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// 模型服务商分组
const PROVIDER_GROUPS = [
  {
    label: "🌍 国际",
    options: [
      { value: "openai", label: "OpenAI (GPT系列)" },
      { value: "anthropic", label: "Anthropic (Claude系列)" },
      { value: "gemini", label: "Google Gemini" },
    ],
  },
  {
    label: "🇨🇳 国内大模型",
    options: [
      { value: "deepseek", label: "DeepSeek" },
      { value: "qwen", label: "阿里 通义千问 (Qwen)" },
      { value: "doubao", label: "字节 豆包 (Doubao)" },
      { value: "zhipu", label: "智谱 GLM (ZhipuAI)" },
      { value: "moonshot", label: "月之暗面 (Kimi)" },
      { value: "baidu", label: "百度 文心 (ERNIE)" },
      { value: "minimax", label: "MiniMax" },
      { value: "hunyuan", label: "腾讯 混元 (Hunyuan)" },
      { value: "stepfun", label: "阶跃星辰 (Step)" },
      { value: "lingyiwanwu", label: "零一万物 (Yi)" },
      { value: "baichuan", label: "百川智能" },
    ],
  },
  {
    label: "💻 Coding 专用",
    options: [
      { value: "alibaba_coding", label: "阿里百炼（通义灵码）" },
      { value: "volcengine_coding", label: "火山引擎（豆包 Coding）" },
      { value: "zhipu_coding", label: "智谱 GLM（含 CodeGeeX）" },
      { value: "kimi_coding", label: "Kimi Coding Plan" },
      { value: "github_copilot", label: "GitHub Copilot" },
    ],
  },
  {
    label: "⚙️ 其他",
    options: [
      { value: "ollama", label: "Ollama (本地模型，API Key 填任意字符串)" },
      { value: "custom", label: "自定义 (OpenAI兼容)" },
    ],
  },
];

// 扁平化列表（用于 Select）
const PROVIDER_OPTIONS = PROVIDER_GROUPS.flatMap((g) => g.options);

// Base URL 预设
const BASE_URL_PRESETS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  doubao: "https://ark.cn-beijing.volces.com/api/v3",
  zhipu: "https://open.bigmodel.cn/api/paas/v4",
  moonshot: "https://api.moonshot.cn/v1",
  baidu: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat",
  minimax: "https://api.minimax.chat/v1",
  hunyuan: "https://api.hunyuan.cloud.tencent.com/v1",
  stepfun: "https://api.stepfun.com/v1",
  lingyiwanwu: "https://api.lingyiwanwu.com/v1",
  baichuan: "https://api.baichuan-ai.com/v1",
  alibaba_coding: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  volcengine_coding: "https://ark.cn-beijing.volces.com/api/v3",
  zhipu_coding: "https://open.bigmodel.cn/api/paas/v4",
  kimi_coding: "https://api.moonshot.cn/v1",
  github_copilot: "https://api.githubcopilot.com",
  ollama: "http://localhost:11434/v1",
  custom: "",
};

// 各 provider 的推荐默认模型
const DEFAULT_MODEL_PRESETS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  gemini: "gemini-2.0-flash",
  deepseek: "deepseek-chat",
  qwen: "qwen-plus",
  doubao: "doubao-pro-32k",
  zhipu: "glm-4-flash",
  moonshot: "moonshot-v1-8k",
  baidu: "ernie-4.0-8k",
  minimax: "abab6.5s-chat",
  hunyuan: "hunyuan-turbo",
  stepfun: "step-2-16k",
  lingyiwanwu: "yi-lightning",
  baichuan: "Baichuan4",
  alibaba_coding: "qwen-coder-plus",
  volcengine_coding: "doubao-coder-plus-32k",
  zhipu_coding: "glm-4-flash",
  kimi_coding: "moonshot-v1-8k",
  github_copilot: "gpt-4o",
  ollama: "qwen2.5:7b",
  custom: "",
};

export default function SettingsPage() {
  const { data: settingsData, refresh } = useApiGet<AnyRecord>("/api/settings");

  // 模型配置状态
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // 标签管理
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#B8623C");
  const [newTagCategory, setNewTagCategory] = useState("custom");

  // 初始化表单
  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      if (s.model_provider) setProvider(s.model_provider);
      if (s.api_key) setApiKey(s.api_key);
      if (s.base_url) setBaseUrl(s.base_url);
      if (s.default_model) setDefaultModel(s.default_model);
    }
  }, [settingsData]);

  // 当切换 provider 时同时更新 base URL 和默认模型
  const handleProviderChange = (value: string | null) => {
    if (!value) return;
    setProvider(value);
    if (BASE_URL_PRESETS[value] !== undefined) {
      setBaseUrl(BASE_URL_PRESETS[value]);
    }
    if (DEFAULT_MODEL_PRESETS[value]) {
      setDefaultModel(DEFAULT_MODEL_PRESETS[value]);
    }
  };

  // 保存模型配置
  const saveModelConfig = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          settings: {
            model_provider: provider,
            api_key: apiKey,
            base_url: baseUrl,
            default_model: defaultModel,
          },
        }),
      });
      toast.success("模型配置已保存");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const testConnection = async () => {
    if (!apiKey) {
      toast.error("请先输入 API Key");
      return;
    }
    setTesting(true);
    try {
      const result = await apiFetch<AnyRecord>("/api/model/test", {
        method: "POST",
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl,
          model: defaultModel,
        }),
      });
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "测试失败");
    } finally {
      setTesting(false);
    }
  };

  // 添加标签
  const addTag = async () => {
    if (!newTagName.trim()) {
      toast.error("标签名不能为空");
      return;
    }
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          addTag: {
            name: newTagName.trim(),
            color: newTagColor,
            category: newTagCategory,
          },
        }),
      });
      setNewTagName("");
      toast.success("标签已添加");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "添加失败");
    }
  };

  // 删除标签
  const deleteTag = async (tagId: string) => {
    try {
      await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ deleteTagId: tagId }),
      });
      toast.success("标签已删除");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  // 导出数据
  const exportData = () => {
    window.open("/api/data/export", "_blank");
  };

  // 导入数据
  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await apiFetch("/api/data/import", {
        method: "POST",
        body: JSON.stringify(data),
      });

      toast.success("数据导入成功");
      refresh();
    } catch (err) {
      toast.error("导入失败：文件格式有误");
    }
    // 清空 input
    e.target.value = "";
  };

  const allTags: AnyRecord[] = settingsData?.tags || [];

  return (
    <div className="space-y-6">
      <PageHeader title="设置" description="模型配置、标签管理、数据管理" />

      {/* 模型配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🤖 模型配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>模型服务商</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {PROVIDER_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="mt-1"
            />
          </div>

          <div>
            <Label>Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              国内 API 请填对应的代理地址。Ollama 本地模型默认 http://localhost:11434/v1，API Key 填任意字符串即可（本地模型不验证）。
            </p>
          </div>

          <div>
            <Label>默认模型</Label>
            <Input
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="mt-1"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveModelConfig} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? "保存中..." : "保存配置"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <><Spinner className="h-4 w-4 mr-2" /> 测试中...</> : "🔌 测试连接"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 标签管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏷️ 标签管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 已有标签 */}
          <div className="space-y-3">
            {["topic_type", "write_status", "custom"].map((category) => {
              const categoryTags = allTags.filter((t) => t.category === category);
              if (!categoryTags.length) return null;
              const categoryLabel = category === "topic_type" ? "选题类型" : category === "write_status" ? "写作状态" : "自定义";
              return (
                <div key={category}>
                  <p className="text-xs text-muted-foreground mb-1.5">{categoryLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {categoryTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs pr-1 flex items-center gap-1"
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                        <button
                          onClick={() => deleteTag(tag.id)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* 添加标签 */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>标签名</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="新标签名"
                className="mt-1"
              />
            </div>
            <div>
              <Label>颜色</Label>
              <Input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="mt-1 w-16 h-9 p-1"
              />
            </div>
            <div>
              <Label>分类</Label>
              <Select value={newTagCategory} onValueChange={(v) => setNewTagCategory(v || "topic_type")}>
                <SelectTrigger className="mt-1 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="topic_type">选题类型</SelectItem>
                  <SelectItem value="write_status">写作状态</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addTag} className="bg-primary hover:bg-primary/90">添加</Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💾 数据管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            导出全部数据为 JSON 文件，或从 JSON 文件导入数据。
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportData}>
              📥 导出数据
            </Button>
            <div>
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
                id="import-file"
              />
              <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                📤 导入数据
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
