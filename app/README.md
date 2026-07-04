# M7 本地网页入口

当前系统版本：`0.5`。这是学习机制半成品阶段；完成学习机制闭环后，才进入完整 `1.0` 版本。

本目录是项目的本地网页入口，用于把 AI 漫剧剧本分镜工作流包装成可重复使用的对话式工具。

网页形态参考 GPT、豆包、Gemini：左侧多个对话窗口和项目分组，中间可以在对话模式和画布模式之间切换，右上角设置模型供应商。

## 启动

客户试用时，优先双击项目根目录：

```text
启动助手.bat
```

需要关闭服务时，双击项目根目录：

```text
关闭服务.bat
```

维护人员也可以在项目根目录运行：

```powershell
node app/server.js
```

默认地址：

```text
http://127.0.0.1:17877
```

## 模型 API

支持两种方式提供 API Key：

1. DeepSeek：设置环境变量 `DEEPSEEK_API_KEY`，或在网页设置页输入 API Key。
2. OpenAI：设置环境变量 `OPENAI_API_KEY`，或在网页设置页输入 API Key。

本机模型配置保存到 `app/config/deepseek.local.json`。这是历史文件名，当前已支持多供应商配置，并会被客户打包脚本排除。

默认模型：

- DeepSeek：`deepseek-v4-flash`
- OpenAI：`gpt-5.5`

可选模型：

- `gpt-5.5`
- `deepseek-v4-pro`
- `deepseek-chat`，兼容旧模型名，官方文档提示会在 2026-07-24 废弃。

## 功能范围

- 多个对话窗口同时存在，互不串上下文。
- 对话可以归入项目分组；旧对话会自动落入默认项目。
- 每个对话自动保存到 `app/data/conversations/`。
- 每个对话同时绑定一个 `runs/` 运行目录，并保存 `chat.md`。
- 画布保存到 `app/data/canvases/`，用于管理小说、剧本、分镜脚本和备注节点。
- 画布小说节点可以调用 `/api/canvas/generate-script` 生成剧本节点。
- 画布剧本节点可以调用 `/api/canvas/plan-storyboards` 识别分集，再通过 `/api/canvas/generate-storyboards` 生成对应集数的分镜脚本节点。
- 后端系统提示保留 M6 技能路由：小说、剧本、分镜、样例、反馈会进入不同链路。
- 后端系统提示保留 M5 学习原则：偏好和质量反馈可沉淀，质量下降优先止损。
- 设置页可配置模型供应商、Base URL、模型和 API Key。

## 代码边界

网页应用代码集中放在 `app/`：

```text
app/
├── server.js
├── lib/
├── public/
├── config/
└── data/
```

画布和项目相关代码也属于网页应用程序本身：

- `app/lib/canvasState.js`：画布节点、连线、尺寸和位置的本地状态规则。
- `app/lib/episodeSplit.js`：从剧本内容中识别 `第1集`、`第2集` 等分集。
- `app/lib/projects.js`：对话项目分组和默认项目规则。
- `app/public/project-tree.js`：前端项目折叠状态辅助逻辑。

## 前端交互规则

- 任何前端功能只要会发起请求，且正常或异常情况下可能等待超过 1 秒，都必须提供可见的等待反馈。
- 模型生成、节点修改、归档检查、批量处理等长耗时动作，应优先使用遮罩层、局部 busy 层、按钮禁用或请求中动画，不能只依赖静默等待。
- 画布节点上的生成类请求统一优先使用 `setCanvasBusy(...)` 和 `.canvas-node-busy`，让用户能明确看到哪个节点正在处理。
- 如果请求通常很快但可能受网络、模型、文件大小影响变慢，至少需要状态文案；若会阻塞当前操作，则需要局部遮罩或动画。

`tools/` 中的 PowerShell 脚本是 M5 学习闭环和客户打包的本地辅助工具。网页应用自身的代码集中在 `app/`。
