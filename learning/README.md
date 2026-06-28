# 学习目录

本目录用于承载项目的自主学习结果。

它不存放原始样例，原始样例放在 `samples/`。

## 目录结构

```text
learning/
├── candidate-rules/   候选规则，尚未正式采用
├── accepted-rules/    已确认规则
├── conversation-records/ 对话学习记录
├── evals/             评测样例和技能改进对比
├── regression-reports/ 降质和回退记录
├── templates/         对话结束学习检查等模板
└── skill-evolution-reports/ 技能进化报告
```

## 当前关键文件

- `candidate-rules/2026-06-08-ai漫剧样例学习候选规则.md`
- `accepted-rules/2026-06-10-第一批已确认规则.md`
- `evals/M4第一批评测基准.md`
- `evals/tasks/M4评测任务卡.md`
- `skill-evolution-reports/2026-06-10-第一次技能进化报告.md`

## 原则

- 候选规则可以自动生成。
- 正式规则必须经过确认。
- 每条规则都要能追溯证据来源。
- 不因为一次反馈直接改正式技能。
- 后续对话中出现新偏好、流程要求、样例解释或质量反馈时，先写入对话学习记录；普通问答静默跳过。
- 发现学习后输出质量下降时，先记录降质和回退风险，不继续强化可疑规则。
