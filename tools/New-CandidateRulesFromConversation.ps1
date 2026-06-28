param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  $sourceDir = "learning/conversation-records"
  $outDir = "learning/candidate-rules"
  if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }

  $outPath = Join-Path $outDir ("{0}-对话学习候选规则草案.md" -f $Date)
  if ((Test-Path -LiteralPath $outPath) -and -not $Force) {
    throw "候选规则草案已存在：$outPath。若要覆盖，请添加 -Force。"
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

  function Get-TableValue {
    param([string]$Text, [string]$Key)
    foreach ($line in ($Text -split "`r?`n")) {
      if ($line -match "^\|\s*$([regex]::Escape($Key))\s*\|\s*(.*?)\s*\|$") {
        return $Matches[1].Trim()
      }
    }
    return ""
  }

  function Get-Section {
    param([string]$Text, [string]$Title)
    $lines = $Text -split "`r?`n"
    $capture = $false
    $items = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
      if ($line -match "^##\s+.*$([regex]::Escape($Title))") {
        $capture = $true
        continue
      }
      if ($capture -and $line -match "^##\s+") { break }
      if ($capture) { $items.Add($line) }
    }
    return (($items.ToArray() -join "`r`n").Trim())
  }

  $records = @()
  if (Test-Path -LiteralPath $sourceDir) {
    $records = @(Get-ChildItem -LiteralPath $sourceDir -File | Where-Object { $_.Name -ne "README.md" } | Sort-Object Name)
  }

  $candidates = @()
  foreach ($file in $records) {
    $text = Get-Content -LiteralPath $file.FullName -Encoding UTF8 -Raw
    $needLearning = Get-TableValue $text "是否需要学习"
    $learningAction = Get-TableValue $text "学习动作"
    $qualitySignal = Get-TableValue $text "质量信号"
    $materialType = Get-TableValue $text "材料类型"
    $title = Get-TableValue $text "标题"
    $summary = Get-Section $text "可学习内容"
    $evidence = Get-Section $text "证据"
    $nextAction = Get-Section $text "下一步"

    if ($needLearning -eq "是" -and $qualitySignal -ne "变差" -and $learningAction -ne "跳过") {
      $candidates += [pscustomobject]@{
        Title = if ($title) { $title } else { $file.BaseName }
        MaterialType = $materialType
        LearningAction = $learningAction
        Summary = $summary
        Evidence = $evidence
        NextAction = $nextAction
        Source = Get-RelativePath $file.FullName
      }
    }
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 对话学习候选规则草案")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add("说明：本文件由对话学习记录自动生成，只是候选规则草案，不等于正式规则。正式采用仍需经过评测、复核或用户确认。")
  $lines.Add("")
  $lines.Add("## 一、候选规则概览")
  $lines.Add("")
  $lines.Add("| 编号 | 标题 | 类型 | 建议动作 | 证据来源 |")
  $lines.Add("| --- | --- | --- | --- | --- |")
  $index = 1
  foreach ($item in $candidates) {
    $id = "D-{0:000}" -f $index
    $lines.Add("| $id | $($item.Title) | $($item.MaterialType) | $($item.LearningAction) | ``$($item.Source)`` |")
    $index += 1
  }
  if ($candidates.Count -eq 0) {
    $lines.Add("| - | 暂无可转候选规则的对话学习记录 | - | - | - |")
  }
  $lines.Add("")

  $lines.Add("## 二、候选规则详情")
  $lines.Add("")
  $index = 1
  foreach ($item in $candidates) {
    $id = "D-{0:000}" -f $index
    $lines.Add("### $id $($item.Title)")
    $lines.Add("")
    $lines.Add("候选规则：")
    $lines.Add("")
    if ($item.Summary) { $lines.Add($item.Summary) } else { $lines.Add("待从对话记录中进一步提炼。") }
    $lines.Add("")
    $lines.Add("证据：")
    $lines.Add("")
    if ($item.Evidence) { $lines.Add($item.Evidence) } else { $lines.Add("见来源记录。") }
    $lines.Add("")
    $lines.Add("下一步：")
    $lines.Add("")
    if ($item.NextAction) { $lines.Add($item.NextAction) } else { $lines.Add("进入 skill-evolution 复核。") }
    $lines.Add("")
    $lines.Add("来源：``$($item.Source)``")
    $lines.Add("")
    $index += 1
  }

  $lines.Add("## 三、采用门槛")
  $lines.Add("")
  $lines.Add("- 单条对话记录不能直接升级正式规则。")
  $lines.Add("- 与已有正式规则一致时，可作为补充证据。")
  $lines.Add("- 与已有规则冲突时，先进入评测或询问使用人员。")
  $lines.Add("- 如果后续出现质量下降，应暂停强化相关候选规则。")
  $lines.Add("")

  Set-Content -LiteralPath $outPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    DraftPath = (Resolve-Path -LiteralPath $outPath).Path
    ConversationRecordCount = $records.Count
    CandidateCount = $candidates.Count
  }
} finally {
  Pop-Location
}

