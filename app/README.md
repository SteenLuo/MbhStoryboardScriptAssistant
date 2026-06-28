# M7 本地网页入口

本目录是项目的本地网页入口，用于把 AI 漫剧剧本分镜工作流包装成可重复使用的对话式工具。

网页形态参考 GPT、豆包、Gemini：左侧多个对话窗口，中间一个对话框，右上角设置模型供应商。

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
- 每个对话自动保存到 `app/data/conversations/`。
- 每个对话同时绑定一个 `runs/` 运行目录，并保存 `chat.md`。
- 后端系统提示保留 M6 技能路由：小说、剧本、分镜、样例、反馈会进入不同链路。
- 后端系统提示保留 M5 学习原则：偏好和质量反馈可沉淀，质量下降优先止损。
- 设置页可配置模型供应商、Base URL、模型和 API Key。

## 代码边界

网页应用代码集中放在 `app/`：

```text
app/
├── server.js
├── public/
├── config/
└── data/
```

`tools/` 中的 PowerShell 脚本是 M5 学习闭环的本地辅助工具。M7 网页应用自身的代码集中在 `app/`。
