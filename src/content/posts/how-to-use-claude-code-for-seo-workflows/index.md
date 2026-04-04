---
title: 如何使用Claude Code搭建SEO工作流
published: 2026-04-05
description: "完整的Claude Code SEO工作流搭建指南，涵盖快速安装、全站审计、单页优化以及Google API接入，帮助开发者将SEO诊断整合到终端工作流中。"
image: "./cover.webp"
tags: ["seo", "claude code", "skills"]
category: "学习笔记"
draft: false
lang: "zh-CN"
---

SEO 工具有很多，如 [SEMrush](https://semrush.com/)、[Ahrefs](https://ahrefs.com/)、[Similarweb](https://www.similarweb.com/) 等，但大多数都是以 SaaS 形态运行在浏览器当中。但如果你是开发者，或者自己在维护站点，这种模式并不总是高效的，理想中的工具应该是可以融入到 AI Agent 工作流中，并输出可执行的优化建议。

Claude SEO 正是这样的，它是一个运行在 Claude Code 里的 Skills 集合，通过 `/seo ...` 命令把站点诊断、内容分析、Schema 校验、Core Web Vitals、GEO、Local SEO、Google API 等这些都整合到了一个工作流中。

::github{repo="AgriciDaniel/claude-seo"}

## 快速安装

环境准备：

- Python 3.10+

- Claude Code CLI

在 Windows 里搭建环境，可以看这篇文章：[使用Scoop+Mise搭建统一的Windows开发环境](https://blog.zsdy.dev/posts/building-a-windows-development-environment-with-scoop-and-mise)

### Unix / macOS / Linux

```bash
git clone --depth 1 https://github.com/AgriciDaniel/claude-seo.git

bash claude-seo/install.sh
```

### Windows

```bash
git clone --depth 1 https://github.com/AgriciDaniel/claude-seo.git

powershell -ExecutionPolicy Bypass -File claude-seo\install.ps1
```

### 依赖安装

我们进入 `~/.claude/skills/seo` 文件夹，可以找到 `requirements.txt` 文件，里面列出了所有之后会用到的依赖。我们需要安装这些依赖，现在依次执行以下命令：

创建虚拟环境：

```bash
uv venv
```

激活环境：

```bash
.venv\Scripts\activate
```

安装依赖：

```bash
uv pip install -r requirements.txt
```

## 快速上手

### 全站审查

当我们接手一个新站点的时候，建议先跑这个命令：

```bash
/seo audit https://example.com
```

与只覆盖单一指标的工具不同，`/seo audit` 是从整站的视角出发，综合评估技术 SEO、内容质量、Schema、性能和图片优化等关键维度，并输出一份可执行的诊断报告。

它的执行逻辑并非简单地抓取首页，而是按整站工作流组织多维度分析：

1. 拉取首页
2. 识别业务类型
3. 抓取站点内部链接，最多分析 500 个页面
4. 并行调度多个分析代理
5. 汇总各维度评分与优先级
6. 输出统一报告与行动建议

通常会覆盖以下维度：

- 技术 SEO
- 内容质量
- Schema
- Sitemap
- Core Web Vitals
- 页面视觉与移动端体验
- GEO

满足其他条件时，还会进一步扩展：

- 本地 SEO（站点被识别为本地业务时）
- Maps 数据（本地业务且已接入 DataForSEO MCP 时）
- Google 官方数据（已配置 Google API 凭证时）
- 外链数据（已配置外链数据源时）

该诊断评分采用加权模型，各维度权重如下：

| 维度                | 权重 |
| ------------------- | ---: |
| Content Quality     |  23% |
| Technical SEO       |  22% |
| On-Page SEO         |  20% |
| Schema              |  10% |
| Performance (CWV)   |  10% |
| AI Search Readiness |  10% |
| Images              |   5% |

### 单页优化

如果问题已经锁定到了具体某一个页面时，用 `/seo page` 会比全站审计更高效：

```bash
/seo page https://example.com/xxx
```

主要聚焦以下几个方向：

- 标题、描述、H1-H6、URL 结构是否合理
- 页面内容是否具备足够的主题深度、可读性和 E-E-A-T 信号
- 是否缺少 title、description、canonical、hreflang、Open Graph 等关键标签
- 当前页面是否已实现结构化数据，以及是否存在可补充的 Schema 机会
- 图片是否存在 alt 缺失、体积过大、尺寸未声明、格式不当或未懒加载等问题
- 是否存在可能影响 LCP、INP、CLS 的风险，例如首屏资源过重、JS 过多、图片尺寸缺失等

这个命令尤其适合分析**首页**、**功能页**、**聚合页**和**关键转化页**等核心页面。对电商站而言，**分类页**和**产品详情页**也是重要的分析对象。

### 技术 SEO

SEO 绝非只是“写好文案”，当搜索引擎无法顺利抓取、索引或渲染你的页面时，再优质的内容也难以获得应有的曝光。技术基建，往往才是优先该解的结。

```bash
/seo technical https://example.com
```

这个命令相当于一次工程视角的 SEO 体检，重点检查：

- 搜索引擎能否正常抓取页面，robots.txt、sitemap、noindex 设置是否存在问题
- canonical、hreflang 等索引控制信号是否配置正确
- HTTPS、混合内容、安全响应头等基础安全项是否到位
- URL 结构、重定向链、目录层级、尾斜杠策略是否规范
- 移动端体验是否存在明显缺陷，如 viewport、字号、触控区域和横向滚动问题
- 页面是否存在可能影响 LCP、INP、CLS 的技术瓶颈；若已接入 Google 数据，还可结合真实 CrUX / PSI 指标判断
- 结构化数据是否已实现、是否存在错误
- JavaScript 渲染是否影响内容抓取、索引判断以及关键 SEO 标签输出

Next.js、Nuxt、Astro 这类 SSR / SSG / 混合渲染的站点建议优先跑这个。因为很多问题不在文案，在抓取、渲染和索引的这条链路没有打通。

## 命令速查表

主入口是 `/seo`，它会根据不同的命令路由到对应子技能，以下是一些常见的命令：

| 命令                          | 功能描述                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| `/seo audit <url>`            | 全站诊断，支持并行子代理调度                                  |
| `/seo page <url>`             | 单页深度分析                                                  |
| `/seo sitemap <url>`          | 分析现有 XML 站点地图                                         |
| `/seo sitemap generate`       | 基于行业模板生成新站点地图                                    |
| `/seo schema <url>`           | Schema.org 结构化数据的检测、校验与生成                       |
| `/seo images <url>`           | 图片优化分析                                                  |
| `/seo technical <url>`        | 技术 SEO 审计，覆盖 9 大类别                                  |
| `/seo content <url>`          | E-E-A-T 与内容质量分析                                        |
| `/seo geo <url>`              | AI Overviews / 生成式引擎优化                                 |
| `/seo plan <type>`            | 战略 SEO 规划，支持 SaaS、本地、电商、出版、代理商等场景      |
| `/seo programmatic <url>`     | 程序化 SEO 分析与规划                                         |
| `/seo competitor-pages <url>` | 竞品对比页面生成                                              |
| `/seo local <url>`            | 本地 SEO 分析，包括 Google 商家资料、引用、评价与地图包       |
| `/seo maps [command]`         | 地图情报分析，包括地理网格、GBP 审计、评价与竞争对手          |
| `/seo hreflang <url>`         | Hreflang / 国际化 SEO 审计与生成                              |
| `/seo google [command] [url]` | Google SEO API 接入，包括 GSC、PageSpeed、CrUX、Indexing、GA4 |
| `/seo google report [type]`   | 生成报告，支持导出 PDF、HTML 和 Excel                         |

## 接入 Google API

Claude SEO 的一个优势在于，它并不只是"抓页面、解析 HTML"，还支持接入 Google 官方数据，将爬虫视角与搜索引擎视角结合起来进行分析。

`/seo google` 这一组命令正是基于这些数据能力，实现更接近真实搜索表现的分析结果。

除了分析外，`/seo google` 还能导出正式报告（PDF / HTML / Excel），适合团队复盘、客户汇报或阶段性交付。

很多人第一次接触 `/seo google` 时，容易踩两个坑：

1. 直接跑命令，但还没配好 Google 凭证
2. 配好了凭证，却不知道从哪条命令开始

以下是从零开始的完整配置流程。

### 第一步：创建 Google Cloud Project

进入 [Google Cloud Console](https://console.cloud.google.com)：

1. 点击项目选择器
2. 新建一个项目
3. 命名，比如 `claude-seo`
4. 创建后切换到该项目

这个 Project 是后续所有 API 配置的容器。

### 第二步：启用需要的 API

进入 `APIs & Services > Library`，至少启用以下 API：

| API                        | 对应能力                                   |
| -------------------------- | ------------------------------------------ |
| Google Search Console API  | Search Analytics、URL Inspection、Sitemaps |
| PageSpeed Insights API     | Lighthouse 实验室数据                      |
| Chrome UX Report API       | CrUX 实时字段数据与历史趋势                |
| Web Search Indexing API    | Indexing API                               |
| Google Analytics Data API  | GA4 自然流量                               |
| Knowledge Graph Search API | 实体验证（可选）                           |

### 第三步：创建 API Key

进入 `APIs & Services > Credentials > Create Credentials > API key`

创建完成后，进行 API 限制：

1. 打开这个 API Key 的设置页
2. 命名，比如 `claude-seo-google-api`
3. 找到 `API restrictions`
4. 只勾选上一步启用的 API

### 第四步：创建 Service Account

进入 `IAM & Admin > Service Accounts > Create Service Account`

账号命名随意，比如 `claude-seo`，创建完后：

1. 打开这个 Service Account
2. 进入 `Keys`
3. 选择 `Add Key > Create new key > JSON`
4. 下载 JSON 文件

建议存放路径：

```bash
~/.config/claude-seo/service_account.json
```

后续授权时会用到里面的 `client_email` 字段。

### 第五步：给 GSC 授权

进入 [Google Search Console](https://search.google.com/search-console)：

1. 打开对应的 Property
2. 进入 `Settings > Users and permissions`
3. 添加用户
4. 粘贴 Service Account JSON 中的 `client_email`
5. 权限建议：
    - 只读分析：`Full`
    - 要用 Indexing API：`Owner`

### 第六步：给 GA4 授权

进入 [Google Analytics](https://analytics.google.com)：

1. 打开对应的 GA4 Property
2. 进入 `Property Access Management`
3. 添加用户
4. 粘贴同一个 `client_email`
5. 至少授予 `Viewer` 权限

同时记下 GA4 Property ID，例如：

```text
123456789
```

在 Claude SEO 配置中通常写为：

```text
properties/123456789
```

### 第七步：写 Claude SEO 配置文件

创建配置文件：

```bash
~/.config/claude-seo/google-api.json
```

写入以下内容：

```json
{
	"service_account_path": "~/.config/claude-seo/service_account.json",
	"api_key": "ABcdEf...",
	"default_property": "sc-domain:example.com",
	"ga4_property_id": "properties/123456789"
}
```

字段说明：

- `service_account_path`：指向刚才下载的 JSON 文件路径
- `api_key`：在 Credentials 中创建的 API Key
- `default_property`：默认的 Search Console Property
- `ga4_property_id`：GA4 Property ID

### 第八步：验证配置

改完配置先别急着用，跑一下验证：

```bash
python scripts/google_auth.py --check
```

想看结构化输出加 `--json`：

```bash
python scripts/google_auth.py --check --json
```

查看当前层级：

```bash
python scripts/google_auth.py --tier
```

层级含义：

- `tier -1`：没有配置任何凭证
- `tier 0`：只有 API Key
- `tier 1`：有 API Key + Service Account / OAuth
- `tier 2`：在 Tier 1 基础上加了 GA4 Property

每次改完配置都建议跑一次验证。

### 第九步：开始进行 Google 数据分析

配置完成后，可以开始使用以下命令：

```bash
# 分析页面性能和真实用户体验
/seo google pagespeed https://example.com
/seo google crux https://example.com
/seo google crux-history https://example.com

# 查看 Google 真实搜索表现
/seo google gsc sc-domain:example.com

# 确认某个 URL 是否已被索引
/seo google inspect https://example.com/xxx

# 批量检查一组页面的索引状态
/seo google inspect-batch urls.txt

# 查看 sitemap 的提交状态、错误和警告
/seo google sitemaps

# 查看自然流量和 landing page
/seo google ga4 properties/123456789
/seo google ga4-pages properties/123456789

# 导出报告
/seo google report full # 适合整体 Google 视角的综合报告
/seo google report cwv-audit # 适合性能分析的专项报告
/seo google report indexation # 适合收录状态的检查报告
/seo google report gsc-performance # 适合 Search Console 表现的汇报
```

> 由于 Claude Code 运行在终端环境中，即便开了代理，也可能会出现无法访问 Google API 的情况，此时只需启用 TUN 模式即可。

一般情况下，建议使用的顺序为：整站审计 → 关键页面 → 专项分析 → Google 数据验证 → 本地 / 国际化 / GEO 等扩展场景。

## 扩展能力

基础分析跑顺之后，可以进一步启用扩展功能。安装和使用细节看各扩展目录下的 `README.md` 文件。

### Firecrawl：整站地图、JS 渲染与深度抓取

SPA 或者 JS 渲染的站点（React / Vue）用这个比较合适，做更完整的站点 map 和 crawl。

安装：

```bash
./extensions/firecrawl/install.sh
```

常用命令：

```bash
/seo firecrawl map <url>
/seo firecrawl crawl <url>
/seo firecrawl scrape <url>
/seo firecrawl search <query> <url>
```

### DataForSEO：关键词、SERP、竞品、外链

做实时 SERP 研究、关键词研究、外链画像、竞品分析的时候用。

安装：

```bash
./extensions/dataforseo/install.sh
```

常用命令：

```bash
/seo dataforseo serp best coffee shops
/seo dataforseo keywords seo tools
/seo dataforseo backlinks example.com
/seo dataforseo ai-mentions your brand
/seo dataforseo ai-scrape your brand name
```

### Banana：图像生成

用于生成 OG 图、博客头图、信息图。

安装：

```bash
./extensions/banana/install.sh
```

常用命令：

```bash
/seo image-gen og "Professional SaaS dashboard"
/seo image-gen hero "AI-powered content creation"
/seo image-gen batch "Product photography" 3
```
