---
name: mbh-workflow
description: AI漫剧剧本分镜总控技能。用于用户提供小说、剧本、分镜、反馈、样例或技能学习要求时，选择正确链路，并按稳定 skill 驱动架构调度输入整理、剧本生成、剧本评审、分镜生成、学习资料沉淀、样例学习和原版 skill-creator。
---

# AI漫剧剧本分镜总控

## 作用

这是项目的简单入口，不替代专业技能。

它负责判断用户给的是什么材料、应该走哪条链路、产物应该保存到哪里、是否需要进入学习资料库、样例学习或原版 `skill-creator`。

当前阶段采用稳定 skill 驱动生成：实时生成链路只读取必要基础 skill 和正式可调用小技能。学习资料库只做证据留痕、状态解释和纠错入口，不自动参与本轮生成。凡是创建、修改、更新或沉淀正式 skill 的动作，交给原版 `skill-creator`，由总控判断何时调用。

## 三条主链路

### 小说到剧本再到分镜

适用：用户提供小说、章节、故事梗概、原文片段。

流程：

```text
novel-intake
-> script-generate
-> script-review-rewrite
-> storyboard-generate
-> sample-ingest / skill-creator
```

### 剧本评审改写再到分镜

适用：用户提供已有剧本，但不确定质量是否能直接进入分镜。

流程：

```text
script-hard-issue-review
-> script-review-rewrite
-> storyboard-generate
-> sample-ingest / skill-creator
```

如果用户只要求剧本硬伤评审、逻辑漏洞清单、伏笔未兑现或人物前后矛盾清单，只执行 `script-hard-issue-review`，不自动进入改写或分镜。

### 漫剧适配与立项分析

适用：用户提供已有剧本，希望判断是否适合做成 AI 漫剧、是否值得立项、市场与受众是否匹配、前几集留存和追更动力是否成立、AIGC 制作是否可控，或需要改编策略清单。

流程：

```text
script-manju-adaptation-analysis
-> 如需修订，再进入 script-review-rewrite
-> 如剧本已确认，再进入 storyboard-generate
```

如果用户只要求“漫剧分析”“立项建议”“市场适配”“AIGC 制作可控性”“改编策略”，优先执行 `script-manju-adaptation-analysis`，不要用 `script-hard-issue-review` 替代。已有硬伤报告时，可以作为适配风险输入，但不要重复生成全量硬伤清单。

### 剧本改写再到分镜

适用：用户已经认可评审问题，要求按问题修订剧本，或要求把剧本调整到可分镜状态。

流程：

```text
script-review-rewrite
-> storyboard-generate
-> sample-ingest / skill-creator
```

### 认可剧本直接到分镜

适用：用户明确说明剧本已认可，或只要求“按这个剧本生成分镜”。

流程：

```text
storyboard-generate
-> sample-ingest / skill-creator
```

## 辅助链路

### 样例学习

适用：

- 用户投放历史剧本、分镜或混合材料。
- 用户解释样例之间的关系。
- 用户希望系统学习格式、风格、镜头偏好。

流程：

```text
sample-ingest
-> 写入学习记录 / 样例报告
-> 必要时建议评测任务；涉及正式 skill 创建或修改时交给 skill-creator
```

### 对话学习

适用：

- 用户给出长期偏好。
- 用户纠正流程。
- 用户反馈质量变好或变差。
- 用户解释某些样例可学或不可学。

流程：

```text
New-ConversationLearningRecord
-> 如质量下降，New-QualityRegressionRecord
-> 明确长期规则时保存为学习资料库沉淀材料
-> 用户主动要求技能学习、创建或修改 skill 时，进入 skill-creator
```

### 技能创建和修改

适用：

- 用户主动点击“技能学习”，并要求系统学习长期生成规则、格式约束或工作流。
- 用户明确要求创建、生成、修改、更新、重构某个 skill。
- 用户要求把学习记录、样例结论或稳定规则沉淀到正式 `SKILL.md`、`references/`、`scripts/` 或 `assets/`。

流程：

```text
skill-creator
-> 理解具体使用场景和触发条件
-> 规划 SKILL.md / references / scripts / assets
-> 生成或修改技能文件
-> 运行格式校验和真实任务验证
```

边界：

- 总控只负责判断何时进入 `skill-creator`，不在总控里重写一套技能创建逻辑。
- 自动识别到的普通学习记录只进入学习资料库；没有用户主动技能学习或明确 skill 修改要求时，不直接改正式 skill。
- 旧 `skill-evolution` 技能已退役；历史草案只作为学习资料库中的旧证据查看，不再作为可调用技能入口。

## 运行目录原则

每次真实运行都应保存到 `runs/` 下的独立目录。

推荐使用 M7 本地网页入口：

```powershell
node app/server.js
```

## 质量门槛

- 不清楚输入类型时，先做输入整理，不直接生成分镜。
- 剧本质量不稳定时，先用 `script-hard-issue-review` 查硬伤；需要修订稿时，再进入 `script-review-rewrite`。
- 需要判断剧本是否适合 AI 漫剧立项、市场与受众是否匹配、AIGC 制作是否可控时，使用 `script-manju-adaptation-analysis`，不要混入全量硬伤评审。
- 分镜不通过时，必须给出去向：小修、重新生成分镜、返回剧本评审。
- 样例学习只沉淀学习记录、样例观察和规则建议，不能静默改正式技能。
- 用户主动技能学习或明确提出正式 skill 修改时，使用原版 `skill-creator` 承接创建、修改、校验和回归验证；不要在总控里临时拼一个简化版技能创建器。
- 明确可程序检查的交付约束，例如“分镜台词每句 20 字以内”，必须进入稳定分镜 skill 的提示和生成后硬规则校验；学习资料库记录只能作为后续调用 `skill-creator` 改 skill 的证据。
- 用户反馈质量下降时，优先记录降质和回退风险。

## 参考文件

- `../../../docs/技能路由说明.md`
- `../../../docs/项目说明.md`
- `../../../docs/分镜标准格式.md`
- `../../../docs/当前里程碑节点.md`
- `../../../app/README.md`
