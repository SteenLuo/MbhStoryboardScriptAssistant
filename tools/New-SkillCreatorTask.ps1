param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "learning/skill-creator-tasks",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
$outFullPath = Join-Path $rootPath.Path $OutDir
New-Item -ItemType Directory -Force -Path $outFullPath | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$taskId = "skill-creator-task-$Date"
$taskPath = Join-Path $outFullPath "$taskId.md"
$taskMetadataPath = Join-Path $outFullPath "$taskId.json"

if ((Test-Path -LiteralPath $taskPath) -and -not $Force) {
  throw "Skill creator task already exists: $taskPath. Use -Force to overwrite."
}

function Get-RelativeFiles {
  param([Parameter(Mandatory = $true)][string]$RelativeDir)
  $dir = Join-Path $rootPath.Path $RelativeDir
  if (-not (Test-Path -LiteralPath $dir)) { return @() }
  return @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "README.md" })
}

$snapshots = Get-RelativeFiles "learning/snapshots" | Sort-Object LastWriteTime -Descending
$candidateRules = Get-RelativeFiles "learning/candidate-rules"
$conversationRecords = Get-RelativeFiles "learning/conversation-records"
$regressionReports = Get-RelativeFiles "learning/regression-reports"
$evalFiles = @()
$evalRoot = Join-Path $rootPath.Path "learning/evals"
if (Test-Path -LiteralPath $evalRoot) {
  $evalFiles = @(Get-ChildItem -LiteralPath $evalRoot -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "README.md" })
}

$latestSnapshot = if ($snapshots.Count -gt 0) { $snapshots[0].FullName } else { "" }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# skill-creator 任务")
$lines.Add("")
$lines.Add("生成日期：$Date")
$lines.Add("")
$lines.Add("## 一、任务性质")
$lines.Add("")
$lines.Add("本文件是给原版 skill-creator 使用的待执行任务，不等于已经修改正式 skill。")
$lines.Add("只有执行任务、修改对应 skill 文件并完成验证后，后续生成才可能读取新能力。")
$lines.Add("")
$lines.Add("## 二、证据来源")
$lines.Add("")
$lines.Add("| 类型 | 数量 |")
$lines.Add("| --- | ---: |")
$lines.Add("| 学习快照 | $($snapshots.Count) |")
$lines.Add("| 候选规则 | $($candidateRules.Count) |")
$lines.Add("| 对话学习记录 | $($conversationRecords.Count) |")
$lines.Add("| 降质记录 | $($regressionReports.Count) |")
$lines.Add("| 评测文件 | $($evalFiles.Count) |")
$lines.Add("")
$lines.Add("## 三、建议交给 skill-creator 的任务")
$lines.Add("")
$lines.Add("1. 读取最新学习快照、候选规则、对话学习记录、降质记录和评测文件。")
$lines.Add("2. 判断是否需要创建新 skill、修改现有 SKILL.md、补 references、补 scripts，或仅保留为学习资料。")
$lines.Add("3. 对每个建议修改写清楚使用场景、触发条件、文件落点、验证命令和回退方式。")
$lines.Add("4. 未验证前不得宣称已影响生成。")
$lines.Add("")
$lines.Add("## 四、最新学习快照")
$lines.Add("")
if ($latestSnapshot) {
  $lines.Add('`' + $latestSnapshot + '`')
} else {
  $lines.Add("暂无学习快照。")
}
$lines.Add("")

[System.IO.File]::WriteAllText($taskPath, ($lines -join "`r`n"), $utf8NoBom)

$metadata = [ordered]@{
  taskId = $taskId
  skillId = "skill-creator"
  title = "学习资料整理为 skill-creator 待执行任务"
  status = "saved"
  summary = "由自动学习闭环汇总证据，交给原版 skill-creator 判断是否创建或修改正式 skill。"
  proposedFiles = @(
    "skills/*/SKILL.md",
    "skills/*/references/",
    "skills/*/scripts/",
    "skills/*/assets/"
  )
  sourceEventIds = @()
  relatedRecordIds = @()
  affectsGeneration = $false
  taskMarkdownPath = $taskPath
  taskMetadataPath = $taskMetadataPath
  snapshotPath = $latestSnapshot
  evidenceCounts = [ordered]@{
    snapshots = $snapshots.Count
    candidateRules = $candidateRules.Count
    conversationRecords = $conversationRecords.Count
    regressionReports = $regressionReports.Count
    evalFiles = $evalFiles.Count
  }
  createdAt = (Get-Date).ToString("o")
  updatedAt = (Get-Date).ToString("o")
}

$metadataJson = $metadata | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($taskMetadataPath, ($metadataJson + "`r`n"), $utf8NoBom)

[pscustomobject]@{
  TaskPath = (Resolve-Path -LiteralPath $taskPath).Path
  JsonPath = (Resolve-Path -LiteralPath $taskMetadataPath).Path
  TaskId = $taskId
  SkillId = "skill-creator"
  AffectsGeneration = $false
}

