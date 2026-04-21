# 公众号内容工作站 MVP

从选题到标题到骨架，一站式公众号内容创作工具。

## 功能

- **选题池** — 管理所有公众号选题，支持标签和状态管理
- **切口分析** — AI 分析话题，找到 6 个不同的写作切口方向
- **标题生成** — AI 生成多套完整标题方案（主标题/副标题/封面大字/朋友圈导语）
- **骨架生成** — AI 搭建结构化文章骨架，支持编辑调整
- **素材库** — 收集管理写作素材（观点/金句/例子/灵感）
- **数据导入导出** — JSON 格式，不被平台锁死

## 技术栈

- **框架**: Next.js 14+ (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **数据库**: Turso (libSQL) 云端 SQLite
- **ORM**: Drizzle ORM
- **模型**: 支持 OpenAI / Anthropic / Gemini / 国内兼容 API

## 本地开发

### 1. 安装依赖

```bash
cd content-station
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

本地开发可使用本地 SQLite：

```
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 配置模型

进入 **设置** 页面，填写：
- 模型服务商（OpenAI / Anthropic / Gemini / 自定义）
- API Key
- Base URL（国内 API 填代理地址）
- 默认模型名称

点击"测试连接"确认可用。

## Turso 数据库创建

### 1. 安装 Turso CLI

```bash
# macOS
brew install tursodatabase/tap/turso

# 或通过脚本安装
curl -sSfL https://get.tur.so/install.sh | bash
```

### 2. 登录并创建数据库

```bash
turso auth login
turso db create content-station
```

### 3. 获取连接信息

```bash
turso db show content-station --url
turso db tokens create content-station
```

将 URL 和 Token 填入 `.env.local`。

## Vercel 部署

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "初始提交"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. 在 Vercel 中导入项目

- 登录 [vercel.com](https://vercel.com)
- 点击 "New Project" → 选择 GitHub 仓库
- 框架自动识别为 Next.js

### 3. 配置环境变量

在 Vercel 项目设置中添加：
- `TURSO_DATABASE_URL` — Turso 数据库 URL
- `TURSO_AUTH_TOKEN` — Turso 认证 Token

### 4. 部署

推送代码后 Vercel 会自动构建和部署。

## 模型配置说明

所有 AI 功能依赖外部模型 API。支持以下配置：

| 服务商 | Base URL | 推荐模型 |
|--------|----------|----------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini, gpt-4o |
| Anthropic | `https://api.anthropic.com` | claude-sonnet-4-20250514 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | gemini-2.0-flash |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat |
| 其他兼容 API | 对应的 Base URL | 对应的模型名 |

API Key 和配置信息保存在数据库中，不会写入代码。

## 项目结构

```
content-station/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── api/                # API Routes
│   │   │   ├── topics/         # 选题 CRUD
│   │   │   ├── analyze/        # 切口分析
│   │   │   ├── analyses/       # 分析记录
│   │   │   ├── titles/         # 标题生成
│   │   │   ├── outlines/       # 骨架生成
│   │   │   ├── materials/      # 素材管理
│   │   │   ├── settings/       # 设置管理
│   │   │   ├── data/           # 数据导入导出
│   │   │   └── model/          # 模型测试
│   │   ├── topics/             # 选题池页面
│   │   ├── analyze/            # 切口分析页面
│   │   ├── titles/             # 标题生成页面
│   │   ├── outline/            # 骨架生成页面
│   │   ├── materials/          # 素材库页面
│   │   ├── settings/           # 设置页面
│   │   ├── layout.tsx          # 根布局
│   │   └── page.tsx            # Dashboard
│   ├── components/             # 共享组件
│   │   ├── ui/                 # shadcn/ui 组件
│   │   ├── nav-sidebar.tsx     # 导航栏
│   │   ├── loading.tsx         # 加载状态
│   │   ├── page-header.tsx     # 页面标题
│   │   └── status-badge.tsx    # 状态 Badge
│   ├── hooks/                  # React Hooks
│   │   └── use-api.ts          # API 调用 Hook
│   └── lib/                    # 核心逻辑
│       ├── db/                 # 数据库
│       │   ├── schema.ts       # Drizzle Schema
│       │   ├── index.ts        # 连接管理
│       │   └── ensure-init.ts  # 自动初始化
│       ├── providers/          # 模型 Provider
│       │   ├── base.ts         # 统一接口
│       │   ├── openai.ts       # OpenAI 兼容
│       │   ├── anthropic.ts    # Anthropic
│       │   └── index.ts        # 工厂函数
│       ├── prompts/            # Prompt 模板
│       │   ├── analyze.ts      # 切口分析
│       │   ├── titles.ts       # 标题生成
│       │   ├── outline.ts      # 骨架生成
│       │   └── reorganize.ts   # 素材重组
│       ├── api-helpers.ts      # API 工具函数
│       └── utils.ts            # 通用工具
├── drizzle.config.ts           # Drizzle 配置
├── .env.example                # 环境变量模板
└── README.md
```
