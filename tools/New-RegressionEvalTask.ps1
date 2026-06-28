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
  $sourceDir = "learning/regression-reports"
  $outDir = "learning/evals/tasks"
  if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }

  $outPath = Join-Path $outDir ("M5-regression-task-{0}.md" -f $Date)
  if ((Test-Path -LiteralPath $outPath) -and -not $Force) {
    throw "降质回归评测任务已存在：$outPath。若要覆盖，请添加 -Force。"
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

  $reports = @()
  if (Test-Path -LiteralPath $sourceDir) {
    $reports = @(Get-ChildItem -LiteralPath $sourceDir -File | Where-Object { $_.Name -ne "README.md" } | Sort-Object Name)
  }

  $items = @()
  foreach ($file in $reports) {
    $text = Get-Content -LiteralPath $file.FullName -Encoding UTF8 -Raw
    $items += [pscustomobject]@{
      Title = Get-TableValue $text "标题"
      Stage = Get-TableValue $text "发生环节"
      Symptom = Get-TableValue $text "表现"
      SuspectedRule = Get-TableValue $text "可疑规则 / 技能"
      Action = Get-TableValue $text "初步动作"
      Source = Get-RelativePath $file.FullName
    }
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# M5 降质回归评测任务")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add("说明：本任务由降质和回退记录自动生成。目标不是证明系统一定错了，而是防止学习后质量下降继续扩散。")
  $lines.Add("")
  $lines.Add("## 一、任务清单")
  $lines.Add("")
  $lines.Add("| 编号 | 标题 | 环节 | 表现 | 可疑规则 / 技能 | 状态 |")
  $lines.Add("| --- | --- | --- | --- | --- | --- |")
  $index = 1
  foreach ($item in $items) {
    $id = "RG-{0:000}" -f $index
    $title = if ($item.Title) { $item.Title } else { "未命名降质" }
    $lines.Add("| $id | $title | $($item.Stage) | $($item.Symptom) | $($item.SuspectedRule) | 待复核 |")
    $index += 1
  }
  if ($items.Count -eq 0) {
    $lines.Add("| - | 暂无降质记录 | - | - | - | 无需执行 |")
  }
  $lines.Add("")

  $lines.Add("## 二、回归评测方法")
  $lines.Add("")
  $lines.Add("每条降质记录至少执行以下检查：")
  $lines.Add("")
  $lines.Add("1. 找到降质发生前后的输出。")
  $lines.Add("2. 对比字段完整性、剧情覆盖、逻辑连续性、时长和镜头合理性。")
  $lines.Add("3. 判断是否与候选规则、已确认规则或技能修改有关。")
  $lines.Add("4. 如果只是单次输入特殊，标为观察。")
  $lines.Add("5. 如果确实与规则有关，建议冻结、收窄或回退。")
  $lines.Add("")

  $lines.Add("## 三、证据入口")
  $lines.Add("")
  foreach ($item in $items) {
    $lines.Add("- ``$($item.Source)``")
  }
  if ($items.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")

  $lines.Add("## 四、通过标准")
  $lines.Add("")
  $lines.Add("- 降质问题已能定位到输入特殊、候选规则、正式规则或技能修改之一。")
  $lines.Add("- 对可疑规则给出继续观察、冻结、收窄或回退建议。")
  $lines.Add("- 降质输出没有被纳入正向样例。")
  $lines.Add("")

  Set-Content -LiteralPath $outPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    TaskPath = (Resolve-Path -LiteralPath $outPath).Path
    RegressionReportCount = $reports.Count
    TaskCount = $items.Count
  }
} finally {
  Pop-Location
}

