param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [string]$Title = "未命名降质记录",

  [Parameter(Mandatory = $false)]
  [string]$Source = "对话反馈",

  [Parameter(Mandatory = $false)]
  [string]$Stage = "待判断",

  [Parameter(Mandatory = $false)]
  [string]$Symptom = "待补充",

  [Parameter(Mandatory = $false)]
  [string]$SuspectedRule = "待判断",

  [Parameter(Mandatory = $false)]
  [string]$Action = "先冻结可疑候选规则，等待复核",

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  $outDir = "learning/regression-reports"
  if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }

  $safeTitle = $Title -replace '[\\/:*?"<>|]', ''
  if ([string]::IsNullOrWhiteSpace($safeTitle)) { $safeTitle = "未命名降质记录" }
  $reportPath = Join-Path $outDir ("{0}-{1}.md" -f $Date, $safeTitle)

  if ((Test-Path -LiteralPath $reportPath) -and -not $Force) {
    throw "降质记录已存在：$reportPath。若要覆盖，请添加 -Force。"
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 降质和回退记录")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add("## 一、基本信息")
  $lines.Add("")
  $lines.Add("| 项目 | 内容 |")
  $lines.Add("| --- | --- |")
  $lines.Add("| 标题 | $Title |")
  $lines.Add("| 来源 | $Source |")
  $lines.Add("| 发生环节 | $Stage |")
  $lines.Add("| 表现 | $Symptom |")
  $lines.Add("| 可疑规则 / 技能 | $SuspectedRule |")
  $lines.Add("| 初步动作 | $Action |")
  $lines.Add("")
  $lines.Add("## 二、复核清单")
  $lines.Add("")
  $lines.Add("- 是否与最近一次候选规则有关：待判断")
  $lines.Add("- 是否与已确认规则有关：待判断")
  $lines.Add("- 是否与某次技能修改有关：待判断")
  $lines.Add("- 是否只是单次输入特殊：待判断")
  $lines.Add("- 是否需要回退：待判断")
  $lines.Add("")
  $lines.Add("## 三、处理建议")
  $lines.Add("")
  $lines.Add("1. 先不要把本次输出作为正向样例。")
  $lines.Add("2. 如果关联到候选规则，标记为暂停观察。")
  $lines.Add("3. 如果关联到已确认规则，生成技能进化草案复核是否需要收窄适用边界。")
  $lines.Add("4. 如果连续两次以上出现同类降质，应建立 M4 回归评测任务。")
  $lines.Add("")

  Set-Content -LiteralPath $reportPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    ReportPath = (Resolve-Path -LiteralPath $reportPath).Path
    Title = $Title
    Stage = $Stage
    SuspectedRule = $SuspectedRule
  }
} finally {
  Pop-Location
}

