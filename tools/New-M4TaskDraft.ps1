param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$InboxReportPath = "",

  [Parameter(Mandatory = $false)]
  [string]$UnknownReviewPath = "",

  [Parameter(Mandatory = $false)]
  [string]$SnapshotPath = "",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "learning/evals/tasks",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  function Get-LatestFile {
    param(
      [string]$Dir,
      [string]$Filter
    )
    if (-not (Test-Path -LiteralPath $Dir)) { return $null }
    $files = @(Get-ChildItem -LiteralPath $Dir -File -Filter $Filter | Sort-Object Name -Descending)
    if ($files.Count -eq 0) { return $null }
    return $files[0]
  }

  function Get-RelativePath {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    $full = [System.IO.Path]::GetFullPath($Path)
    $base = $rootPath.Path.TrimEnd('\') + '\'
    if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $full.Substring($base.Length).Replace('\', '/')
    }
    return $Path.Replace('\', '/')
  }

  function Split-MarkdownRow {
    param([string]$Line)
    $trimmed = $Line.Trim()
    if (-not $trimmed.StartsWith("|")) { return @() }
    $cells = $trimmed.Trim("|").Split("|") | ForEach-Object { $_.Trim().Trim([char]0x60) }
    return @($cells)
  }

  function Get-TableRowsAfterHeading {
    param(
      [string[]]$Lines,
      [string]$HeadingPattern
    )
    $rows = @()
    $inSection = $false
    foreach ($line in $Lines) {
      if ($line -match $HeadingPattern) {
        $inSection = $true
        continue
      }
      if ($inSection -and $line -match "^## ") {
        break
      }
      if (-not $inSection) { continue }
      if ($line -notmatch "^\|") { continue }
      if ($line -match "^\|\s*-+") { continue }
      $cells = Split-MarkdownRow -Line $line
      if ($cells.Count -gt 0 -and $cells[0] -notmatch "文件|剧目猜测|指标") {
        $rows += ,$cells
      }
    }
    return $rows
  }

  $inboxFile = if ([string]::IsNullOrWhiteSpace($InboxReportPath)) {
    Get-LatestFile -Dir "samples/_reports" -Filter "inbox-scan-*.md"
  } else {
    Get-Item -LiteralPath $InboxReportPath
  }
  if ($null -eq $inboxFile) { throw "未找到 inbox-scan 报告。请先运行 tools/New-InboxScanReport.ps1。" }

  $unknownFile = if ([string]::IsNullOrWhiteSpace($UnknownReviewPath)) {
    Get-LatestFile -Dir "samples/_reports" -Filter "unknown-material-review-*.md"
  } elseif (Test-Path -LiteralPath $UnknownReviewPath) {
    Get-Item -LiteralPath $UnknownReviewPath
  } else {
    $null
  }

  $snapshotFile = if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    Get-LatestFile -Dir "learning/snapshots" -Filter "learning-snapshot-*.md"
  } elseif (Test-Path -LiteralPath $SnapshotPath) {
    Get-Item -LiteralPath $SnapshotPath
  } else {
    $null
  }

  $outPath = if (Test-Path -LiteralPath $OutDir) {
    Resolve-Path -LiteralPath $OutDir
  } else {
    New-Item -ItemType Directory -Force -Path $OutDir
  }

  $draftPath = Join-Path $outPath.Path ("M4-task-draft-{0}.md" -f $Date)
  if ((Test-Path -LiteralPath $draftPath) -and -not $Force) {
    throw "任务草案已存在：$draftPath。若要覆盖，请添加 -Force。"
  }

  $inboxLines = @(Get-Content -LiteralPath $inboxFile.FullName -Encoding UTF8)
  $fileRows = Get-TableRowsAfterHeading -Lines $inboxLines -HeadingPattern "^## 二、文件清单"
  $groupRows = Get-TableRowsAfterHeading -Lines $inboxLines -HeadingPattern "^## 三、可能关联组"

  $unknownMap = @{}
  if ($null -ne $unknownFile) {
    $unknownLines = @(Get-Content -LiteralPath $unknownFile.FullName -Encoding UTF8)
    $unknownRows = Get-TableRowsAfterHeading -Lines $unknownLines -HeadingPattern "^## 一、判断结论"
    foreach ($row in $unknownRows) {
      if ($row.Count -ge 5) {
        $unknownMap[$row[0]] = [pscustomobject]@{
          BodyType = $row[2]
          Title = $row[3]
          Relation = $row[4]
        }
      }
    }
  }

  $snapshotText = ""
  if ($null -ne $snapshotFile) {
    $snapshotText = Get-Content -LiteralPath $snapshotFile.FullName -Encoding UTF8 -Raw
  }

  $tasks = New-Object System.Collections.Generic.List[object]
  foreach ($group in $groupRows) {
    if ($group.Count -lt 5) { continue }
    $title = $group[0]
    $fileCount = $group[1]
    $types = $group[2]
    $episodes = $group[3]
    $judgement = $group[4]

    $groupFiles = @($fileRows | Where-Object { $_.Count -ge 6 -and $_[2] -eq $title })
    $gapHits = @($groupFiles | ForEach-Object { $_[4] } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne "-" } | Select-Object -Unique)
    $hasUnknown = @($groupFiles | Where-Object { $_[1] -eq "未知" }).Count -gt 0
    $hasScript = $types -match "剧本"
    $hasStoryboard = $types -match "分镜"
    $hasNovel = $types -match "小说"
    $knownUnknowns = @($groupFiles | Where-Object { $unknownMap.ContainsKey($_[0]) })

    $relation = if ($knownUnknowns.Count -gt 0) {
      (($knownUnknowns | ForEach-Object { $unknownMap[$_[0]].Relation } | Select-Object -Unique) -join "；")
    } elseif ($hasScript -and $hasStoryboard) {
      "剧本 -> 分镜候选"
    } elseif ($hasNovel -and $hasStoryboard) {
      "小说 / 原文 -> 分镜观察候选"
    } elseif ($hasUnknown) {
      "待正文二次判断"
    } else {
      $judgement
    }

    $taskType = if ($hasUnknown -and $knownUnknowns.Count -eq 0) {
      "未知材料二次判断"
    } elseif ($hasScript -and $hasStoryboard) {
      "正文对齐 / 覆盖复核"
    } elseif ($hasNovel -and $hasStoryboard) {
      "观察样例覆盖复核"
    } elseif ($knownUnknowns.Count -gt 0) {
      "按二次判断进入 M4"
    } else {
      "待观察"
    }

    $priority = if ($gapHits.Count -gt 0) { "高" } elseif ($hasScript -and $hasStoryboard) { "中" } else { "低" }
    $titleKey = if ($title -match "欧皇") {
      "欧皇"
    } elseif ($title -match "八零") {
      "八零"
    } elseif ($title -match "司爷|少奶奶") {
      "司爷少奶奶|少奶奶"
    } elseif ($title -match "第十七") {
      "第十七"
    } elseif ($title -match "新房") {
      "新房"
    } else {
      [regex]::Escape($title)
    }
    $hasRunEvidence = $false
    if (Test-Path -LiteralPath "runs") {
      $hasRunEvidence = @(
        Get-ChildItem -LiteralPath "runs" -Directory |
          Where-Object { $_.Name -match $titleKey }
      ).Count -gt 0
    }
    $status = if (($snapshotText -match $titleKey) -or $hasRunEvidence) { "已有相关证据，避免重复；新文件变化时再执行" } else { "待审" }
    $needAsk = if ($taskType -eq "未知材料二次判断") { "否，先读正文" } elseif ($relation -match "待确认") { "可能" } else { "否" }

    $tasks.Add([pscustomobject]@{
      Title = $title
      FileCount = $fileCount
      Types = $types
      Episodes = $episodes
      Relation = $relation
      TaskType = $taskType
      GapHits = if ($gapHits.Count -gt 0) { ($gapHits -join "、") } else { "-" }
      Priority = $priority
      NeedAsk = $needAsk
      Status = $status
    })
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# M4 评测任务草案")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add(("来源扫描报告：``{0}``" -f (Get-RelativePath $inboxFile.FullName)))
  if ($null -ne $unknownFile) {
    $lines.Add(("未知材料二次判断：``{0}``" -f (Get-RelativePath $unknownFile.FullName)))
  }
  if ($null -ne $snapshotFile) {
    $lines.Add(("学习快照：``{0}``" -f (Get-RelativePath $snapshotFile.FullName)))
  }
  $lines.Add("")
  $lines.Add("说明：本文件是自动生成的待审任务草案。它用于让学习过程无感发生，不代表已经执行评测，也不会自动升级正式规则。")
  $lines.Add("")

  $lines.Add("## 一、任务概览")
  $lines.Add("")
  $lines.Add("| 剧目组 | 文件数 | 材料类型 | 集数线索 | 关系判断 | 建议任务 | 题材缺口 | 优先级 | 是否需要询问 | 状态 |")
  $lines.Add("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
  foreach ($task in $tasks) {
    $lines.Add(("| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} | {8} | {9} |" -f $task.Title, $task.FileCount, $task.Types, $task.Episodes, $task.Relation, $task.TaskType, $task.GapHits, $task.Priority, $task.NeedAsk, $task.Status))
  }
  if ($tasks.Count -eq 0) {
    $lines.Add("| - | 0 | - | - | - | - | - | - | - | 未发现任务 |")
  }
  $lines.Add("")

  $lines.Add("## 二、自动执行建议")
  $lines.Add("")
  foreach ($task in ($tasks | Sort-Object Priority, Title)) {
    $lines.Add(("### {0}" -f $task.Title))
    $lines.Add("")
    $lines.Add(("- 建议任务：{0}" -f $task.TaskType))
    $lines.Add(("- 样例关系：{0}" -f $task.Relation))
    $lines.Add(("- 题材缺口：{0}" -f $task.GapHits))
    $lines.Add(("- 使用人员参与：{0}" -f $task.NeedAsk))
    $lines.Add(("- 当前状态：{0}" -f $task.Status))
    $lines.Add("")
  }

  $lines.Add("## 三、无感学习规则")
  $lines.Add("")
  $lines.Add("1. 用户投放材料后，系统先生成扫描报告，不要求用户整理目录。")
  $lines.Add("2. 文件名能判断关系时，先自动成组；正文只做二次确认。")
  $lines.Add("3. 未知材料先读正文，不立即询问用户。")
  $lines.Add("4. 任务草案只进入待审，不自动升级题材规则。")
  $lines.Add("5. 只有正文对齐后仍无法判断关键关系时，才向使用人员提出简短问题。")
  $lines.Add("")

  $lines.Add("## 四、下一步")
  $lines.Add("")
  $lines.Add("1. 对状态为待审的高优先级任务执行正文对齐或覆盖复核。")
  $lines.Add("2. 执行后写入 ``runs/``，再更新学习快照。")
  $lines.Add("3. 由 ``New-SkillEvolutionDraft.ps1`` 生成技能进化草案。")
  $lines.Add("")

  Set-Content -LiteralPath $draftPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    DraftPath = $draftPath
    TaskCount = $tasks.Count
    HighPriorityCount = @($tasks | Where-Object { $_.Priority -eq "高" }).Count
    InboxReport = $inboxFile.FullName
    UnknownReview = if ($null -ne $unknownFile) { $unknownFile.FullName } else { "" }
    Snapshot = if ($null -ne $snapshotFile) { $snapshotFile.FullName } else { "" }
  }
} finally {
  Pop-Location
}







