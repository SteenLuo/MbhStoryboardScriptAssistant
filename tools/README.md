# 本地工具

这里存放可重复使用的本地检查脚本。

## Measure-Storyboard.ps1

用途：统计分镜文件的基础指标。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Measure-Storyboard.ps1" -Path "runs\20260610-221500-新房信息层分镜评测\generated-storyboard.md"
```

多文件统计可用 PowerShell 数组：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { & 'tools\Measure-Storyboard.ps1' -Path @('a.md','b.md') }"
```

输出指标：

- 场次数。
- 镜头数。
- 时长字段数。
- 缺失时长字段数。
- 总时长。
- 平均单镜时长。
- 固定镜头数。
- 运镜线索数。
- 信息层命中数。
- 是否有本集完标记。

## Measure-StoryboardBatch.ps1

用途：批量扫描目录里的分镜文件并输出指标。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Measure-StoryboardBatch.ps1" -Root "runs"
```

默认扫描 `runs/` 下文件名包含 `storyboard` 或 `分镜` 的 Markdown 文件。

## Scan-SampleInbox.ps1

用途：扫描 `samples/_inbox/` 和 `samples/` 根目录散落文件，按文件名初步判断材料类型、剧目名和集数。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Scan-SampleInbox.ps1" -Root "samples" -Json
```

注意：这是第一轮文件名扫描，不代替正文阅读和对应关系判断。

## New-InboxScanReport.ps1

用途：基于 `Scan-SampleInbox.ps1` 生成 Markdown 分拣报告，默认写入 `samples/_reports/inbox-scan-日期.md`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-InboxScanReport.ps1" -Root "samples" -OutDir "samples/_reports" -Force
```

报告包含：

- 扫描概览。
- 文件清单。
- 可能关联组。
- 是否命中待补样例清单。
- 待确认问题。
- 下一步建议。

## New-LearningSnapshot.ps1

用途：汇总当前学习资产、运行证据、评测任务和规则状态，默认写入 `learning/snapshots/learning-snapshot-日期.md`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-LearningSnapshot.ps1" -Force
```

报告包含：

- 学习资产概览。
- 最新运行证据。
- 已完成的新样例对齐任务。
- 候选规则和已确认规则入口。
- 下一步建议。

## New-SkillEvolutionDraft.ps1

用途：基于最新学习快照生成技能进化草案，默认写入 `learning/skill-evolution-reports/skill-evolution-draft-日期.md`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-SkillEvolutionDraft.ps1" -Force
```

草案只用于待审，不会自动修改正式技能。

## New-M4TaskDraft.ps1

用途：基于最新投放区扫描报告、未知材料二次判断和学习快照，自动生成 M4 评测任务草案。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-M4TaskDraft.ps1" -Force
```

草案只用于待审，不会自动执行评测或升级正式规则。

## Invoke-AutoLearningCycle.ps1

用途：材料投放后的无感学习入口。按顺序运行投放区扫描、M4 任务草案、学习快照、技能进化草案。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Invoke-AutoLearningCycle.ps1" -Force
```

使用场景：用户投放新材料后，由系统自动调用；使用人员不需要主动触发学习。

## New-ConversationLearningRecord.ps1

用途：记录对话结束前自动判断出的可学习信息，例如用户偏好、流程要求、样例解释、质量反馈或需要跳过学习的原因，写入 `learning/conversation-records/`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-ConversationLearningRecord.ps1" -Title "对话学习应无感发生" -NeedLearning "是" -MaterialType "流程偏好" -QualitySignal "无明显变化" -LearningAction "候选规则" -Summary "用户希望后续对话结束时由系统自动判断是否需要学习，不要求用户主动触发。" -Evidence "用户明确说后续对话中进行学习，每次对话结束后判断是否需要总结或学习。" -NextAction "写入 sample-ingest 和 skill-evolution 的学习流程。" -Force
```

普通问答不必生成记录；出现质量下降时，还要配合 `New-QualityRegressionRecord.ps1`。

## New-CandidateRulesFromConversation.ps1

用途：把 `learning/conversation-records/` 中值得学习的对话记录整理成候选规则草案，默认写入 `learning/candidate-rules/日期-对话学习候选规则草案.md`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-CandidateRulesFromConversation.ps1" -Force
```

草案不会自动进入正式规则，仍需评测、复核或用户确认。

## New-QualityRegressionRecord.ps1

用途：记录学习后输出质量下降、学偏、退步或用户明确不满意的情况，写入 `learning/regression-reports/`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-QualityRegressionRecord.ps1" -Title "分镜学习后运镜变乱" -Stage "分镜生成" -Symptom "运镜过多且不服务剧情" -SuspectedRule "运镜和构图候选规则" -Force
```

该记录用于触发回退复核，不会自动删除正式规则。

## New-RegressionEvalTask.ps1

用途：把 `learning/regression-reports/` 中的降质记录整理成 M5 回归评测任务，默认写入 `learning/evals/tasks/M5-regression-task-日期.md`。

示例：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\New-RegressionEvalTask.ps1" -Force
```

该任务用于判断是输入特殊、候选规则问题、正式规则问题，还是技能修改导致退步。
