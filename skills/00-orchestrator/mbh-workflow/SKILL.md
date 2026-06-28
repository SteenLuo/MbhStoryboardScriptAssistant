---
name: mbh-workflow
description: AI漫剧剧本分镜总控技能。用于用户提供小说、剧本、分镜、反馈或样例时，选择正确链路并调度输入整理、剧本生成、剧本评审、分镜生成、样例学习和技能进化。
---

# AI漫剧剧本分镜总控

## 作用

这是项目的简单入口，不替代专业技能。

它负责判断用户给的是什么材料、应该走哪条链路、产物应该保存到哪里、是否需要进入学习闭环。

## 三条主链路

### 小说到剧本再到分镜

适用：用户提供小说、章节、故事梗概、原文片段。

流程：

```text
novel-intake
-> script-generate
-> script-review-rewrite
-> storyboard-generate
-> sample-ingest / skill-evolution
```

### 剧本评审改写再到分镜

适用：用户提供已有剧本，但不确定质量是否能直接进入分镜。

流程：

```text
script-review-rewrite
-> storyboard-generate
-> sample-ingest / skill-evolution
```

### 认可剧本直接到分镜

适用：用户明确说明剧本已认可，或只要求“按这个剧本生成分镜”。

流程：

```text
storyboard-generate
-> sample-ingest / skill-evolution
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
-> New-InboxScanReport
-> New-M4TaskDraft
-> New-LearningSnapshot
-> New-SkillEvolutionDraft
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
-> New-LearningSnapshot
-> New-SkillEvolutionDraft
```

## 运行目录原则

每次真实运行都应保存到 `runs/` 下的独立目录。

推荐使用 M7 本地网页入口：

```powershell
node app/server.js
```

## 质量门槛

- 不清楚输入类型时，先做输入整理，不直接生成分镜。
- 剧本质量不稳定时，先评审或轻改，再进入分镜。
- 分镜不通过时，必须给出去向：小修、重新生成分镜、返回剧本评审。
- 样例学习只能生成候选规则，不能静默改正式规则。
- 用户反馈质量下降时，优先记录降质和回退风险。

## 参考文件

- `../../../docs/技能路由说明.md`
- `../../../docs/项目说明.md`
- `../../../docs/分镜标准格式.md`
- `../../../docs/当前里程碑节点.md`
- `../../../app/README.md`
