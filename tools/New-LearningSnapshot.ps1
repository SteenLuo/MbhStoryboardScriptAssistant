param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "learning/snapshots",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  $outPath = if (Test-Path -LiteralPath $OutDir) {
    Resolve-Path -LiteralPath $OutDir
  } else {
    New-Item -ItemType Directory -Force -Path $OutDir
  }

  $reportPath = Join-Path $outPath.Path ("learning-snapshot-{0}.md" -f $Date)
  if ((Test-Path -LiteralPath $reportPath) -and -not $Force) {
    throw "快照已存在：$reportPath。若要覆盖，请添加 -Force。"
  }

  function Get-RelativePath {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $base = $rootPath.Path.TrimEnd('\') + '\'
    if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $full.Substring($base.Length).Replace('\', '/')
    }
    return $Path.Replace('\', '/')
  }

  function Get-Files {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
      return @(Get-ChildItem -LiteralPath $Path -File | Where-Object { $_.Name -ne "README.md" })
    }
    return @()
  }

  function Get-RunDirs {
    if (-not (Test-Path -LiteralPath "runs")) { return @() }
    return @(Get-ChildItem -LiteralPath "runs" -Directory | Sort-Object Name)
  }

  $candidateRules = Get-Files "learning/candidate-rules"
  $acceptedRules = Get-Files "learning/accepted-rules"
  $evalFiles = Get-Files "learning/evals"
  $evalTasks = Get-Files "learning/evals/tasks"
$skillCreatorTasks = Get-Files "learning/skill-creator-tasks"
  $regressionReports = Get-Files "learning/regression-reports"
  $conversationRecords = Get-Files "learning/conversation-records"
  $sampleReports = Get-Files "samples/_reports"
  $runDirs = Get-RunDirs

  $alignmentReviews = @()
  $coverageChecks = @()
  $runSummaries = @()
  if (Test-Path -LiteralPath "runs") {
    $alignmentReviews = @(Get-ChildItem -LiteralPath "runs" -Recurse -File -Filter "alignment-review.md")
    $coverageChecks = @(Get-ChildItem -LiteralPath "runs" -Recurse -File -Filter "coverage-check.md")
    $runSummaries = @(Get-ChildItem -LiteralPath "runs" -Recurse -File -Filter "run-summary.md")
  }

  $completedTaskLines = @()
  $taskCard = "learning/evals/tasks/M4新样例对齐任务卡.md"
  if (Test-Path -LiteralPath $taskCard) {
    $completedTaskLines = @(Select-String -LiteralPath $taskCard -Pattern "已完成" | ForEach-Object { $_.Line.Trim() })
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 学习闭环快照")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
$lines.Add("说明：本快照用于汇总当前学习资产和评测证据，帮助后续判断哪些资料可以继续观察、哪些资料应进入 skill-creator 任务。")
  $lines.Add("")

  $lines.Add("## 一、资产概览")
  $lines.Add("")
  $lines.Add("| 类型 | 数量 |")
  $lines.Add("| --- | --- |")
  $lines.Add("| 候选规则文件 | $($candidateRules.Count) |")
  $lines.Add("| 已确认规则文件 | $($acceptedRules.Count) |")
  $lines.Add("| 评测文件 | $($evalFiles.Count) |")
$lines.Add("| 评测任务卡 | $($evalTasks.Count) |")
$lines.Add("| skill-creator 任务 | $($skillCreatorTasks.Count) |")
$lines.Add("| 降质和回退记录 | $($regressionReports.Count) |")
$lines.Add("| 对话学习记录 | $($conversationRecords.Count) |")
$lines.Add("| 样例分拣 / 入库报告 | $($sampleReports.Count) |")
  $lines.Add("| 运行目录 | $($runDirs.Count) |")
  $lines.Add("| 对齐复核报告 | $($alignmentReviews.Count) |")
  $lines.Add("| 剧情覆盖核对 | $($coverageChecks.Count) |")
  $lines.Add("| 运行总结 | $($runSummaries.Count) |")
  $lines.Add("")

  $lines.Add("## 二、最新运行证据")
  $lines.Add("")
  $lines.Add("| 运行目录 | 关键文件 |")
  $lines.Add("| --- | --- |")
  foreach ($dir in ($runDirs | Sort-Object Name -Descending | Select-Object -First 10)) {
    $keyFiles = @()
    foreach ($name in @("alignment-review.md", "coverage-check.md", "run-summary.md", "comparison-report.md", "revision-report.md")) {
      $candidate = Join-Path $dir.FullName $name
      if (Test-Path -LiteralPath $candidate) {
        $keyFiles += $name
      }
    }
    if ($keyFiles.Count -eq 0) { $keyFiles = @("-") }
    $lines.Add(("| ``{0}`` | {1} |" -f (Get-RelativePath $dir.FullName), ($keyFiles -join "、")))
  }
  $lines.Add("")

  $lines.Add("## 三、已完成的新样例对齐任务")
  $lines.Add("")
  if ($completedTaskLines.Count -gt 0) {
    foreach ($line in $completedTaskLines) {
      $lines.Add("- $line")
    }
  } else {
    $lines.Add("- 暂未发现已完成任务行。")
  }
  $lines.Add("")

  $lines.Add("## 四、规则状态")
  $lines.Add("")
  $lines.Add("已确认规则文件：")
  $lines.Add("")
  foreach ($file in $acceptedRules) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($acceptedRules.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")
  $lines.Add("候选规则文件：")
  $lines.Add("")
  foreach ($file in $candidateRules) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($candidateRules.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")

  $lines.Add("对话学习记录：")
  $lines.Add("")
  foreach ($file in ($conversationRecords | Sort-Object Name -Descending | Select-Object -First 10)) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($conversationRecords.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")

  $lines.Add("## 五、当前判断")
  $lines.Add("")
  $lines.Add("- M4 已具备较完整的证据链：样例分拣、未知材料二次判断、运行记录、覆盖核对、正文对齐复核、题材规则证据评估。")
  $lines.Add("- 后续对话中的偏好、质量反馈、流程调整和反例，应先进入对话学习记录，再决定是否转成候选规则或降质记录。")
  $lines.Add("- 如果出现降质和回退记录，后续 skill-creator 任务必须优先处理降质风险。")
  $lines.Add("- 经营逆袭、修仙玄幻、豪门强女主等题材规则仍应留在候选区，等待跨剧目样例补证据。")
  $lines.Add("- 跨题材基础规则已更适合进入正式技能，例如字段完整、部分对应、一对多关系、目标时长校准、历史噪声修正。")
  $lines.Add("")

  $lines.Add("## 六、下一步建议")
  $lines.Add("")
  $lines.Add("1. 每次新增样例后，先运行 ``tools/New-InboxScanReport.ps1``。")
  $lines.Add("2. 对未知材料先写 ``unknown-material-review``，再决定是否进入 M4。")
  $lines.Add("3. 每完成一轮评测后，运行本工具生成新的学习快照。")
  $lines.Add("4. 每次对话结束前，如果本轮出现新偏好、质量反馈或可复用规则，运行 ``tools/New-ConversationLearningRecord.ps1``。")
  $lines.Add("5. 由原版 ``skill-creator`` 根据快照和证据评估决定是否修改正式技能。")
  $lines.Add("")

  Set-Content -LiteralPath $reportPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    ReportPath = $reportPath
    RunCount = $runDirs.Count
    AlignmentReviewCount = $alignmentReviews.Count
    CoverageCheckCount = $coverageChecks.Count
    CandidateRuleFileCount = $candidateRules.Count
    AcceptedRuleFileCount = $acceptedRules.Count
    RegressionReportCount = $regressionReports.Count
    ConversationRecordCount = $conversationRecords.Count
  }
} finally {
  Pop-Location
}





