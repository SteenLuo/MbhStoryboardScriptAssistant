# 本地技能目录

本目录存放当前项目专用的 AI 漫剧技能，不是全局 Codex 技能。

技能按职责分层，不平铺：

```text
skills/
├── 00-orchestrator/     总控入口和技能路由
├── 01-input-analysis/   输入整理和类型判断
├── 02-script/           剧本生成、评审、改写和定稿
├── 03-storyboard/       分镜生成和分镜评审
├── 04-learning/         既有样例入库和规则提炼
└── 05-evolution/        技能改进、评测和版本演进
```

当前第一批技能：

- `00-orchestrator/mbh-workflow`：AI 漫剧剧本分镜总控入口。
- `01-input-analysis/novel-intake`：小说或 AI 漫剧剧本输入整理。
- `02-script/script-generate`：根据小说生成 AI 漫剧剧本。
- `02-script/script-hard-issue-review`：从剧本自身出发，全面审查硬伤、逻辑漏洞、伏笔兑现、人物连续性和返修优先级。
- `02-script/script-manju-adaptation-analysis`：独立评估剧本是否适合 AI 漫剧立项、市场与受众是否匹配、AIGC 制作是否可控，并输出改编策略。
- `02-script/script-review-rewrite`：AI 漫剧剧本评审和改写。
- `03-storyboard/storyboard-generate`：根据剧本生成 AI 漫剧分镜。
- `04-learning/sample-ingest`：学习已有 AI 漫剧剧本和分镜样例，沉淀学习记录和规则建议。
- `05-evolution/skill-creator`：直接内置 Codex 原版 skill-creator，用于创建、修改、更新和验证正式 skill。

## 使用原则

- 技能说明以中文为主。
- 英文目录名仅用于工具兼容。
- 每个技能只做一类事。
- 学习记录、沉淀规则材料和技能版本分开。
- 样例学习不能直接污染正式技能。
- 用户主动技能学习或明确要求改 skill 时，由总控路由到 `05-evolution/skill-creator`，不要另造简化版技能创建器，也不要再走旧技能进化入口。
- 总控技能只负责路由，不替代专业技能。
