param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [string]$Title = "未命名对话学习",

  [Parameter(Mandatory = $false)]
  [ValidateSet("是", "否", "待判断")]
  [string]$NeedLearning = "待判断",

  [Parameter(Mandatory = $false)]
  [ValidateSet("小说", "剧本", "分镜", "反馈", "质量问题", "流程偏好", "普通问答", "其他")]
  [string]$MaterialType = "反馈",

  [Parameter(Mandatory = $false)]
  [ValidateSet("是", "否", "未判断")]
  [string]$Accepted = "未判断",

  [Parameter(Mandatory = $false)]
  [ValidateSet("变好", "变差", "无明显变化", "待判断")]
  [string]$QualitySignal = "待判断",

  [Parameter(Mandatory = $false)]
  [ValidateSet("候选规则", "降质记录", "更新快照", "跳过", "待评测")]
  [string]$LearningAction = "待评测",

  [Parameter(Mandatory = $false)]
  [string]$Summary = "待补充",

  [Parameter(Mandatory = $false)]
  [string]$Evidence = "待补充",

  [Parameter(Mandatory = $false)]
  [string]$NextAction = "待判断",

  [Parameter(Mandatory = $false)]
  [string]$RelatedFiles = "无",

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  $outDir = "learning/conversation-records"
  if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }

  $safeTitle = $Title -replace '[\\/:*?"<>|]', ''
  if ([string]::IsNullOrWhiteSpace($safeTitle)) { $safeTitle = "未命名对话学习" }
  $recordPath = Join-Path $outDir ("{0}-{1}.md" -f $Date, $safeTitle)

  if ((Test-Path -LiteralPath $recordPath) -and -not $Force) {
    throw "对话学习记录已存在：$recordPath。若要覆盖，请添加 -Force。"
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 对话学习记录")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add("## 一、判断结论")
  $lines.Add("")
  $lines.Add("| 项目 | 内容 |")
  $lines.Add("| --- | --- |")
  $lines.Add("| 标题 | $Title |")
  $lines.Add("| 是否需要学习 | $NeedLearning |")
  $lines.Add("| 材料类型 | $MaterialType |")
  $lines.Add("| 是否已采纳 | $Accepted |")
  $lines.Add("| 质量信号 | $QualitySignal |")
  $lines.Add("| 学习动作 | $LearningAction |")
  $lines.Add("| 关联文件 | $RelatedFiles |")
  $lines.Add("")
  $lines.Add("## 二、可学习内容")
  $lines.Add("")
  $lines.Add($Summary)
  $lines.Add("")
  $lines.Add("## 三、证据")
  $lines.Add("")
  $lines.Add($Evidence)
  $lines.Add("")
  $lines.Add("## 四、下一步")
  $lines.Add("")
  $lines.Add($NextAction)
  $lines.Add("")
  $lines.Add("## 五、处理原则")
  $lines.Add("")
  $lines.Add("- 如果是否需要学习为[否]，本记录仅作为跳过依据，不进入规则升级。")
  $lines.Add("- 如果质量信号为[变差]，必须优先生成或关联降质和回退记录。")
  $lines.Add("- 如果学习动作是[候选规则]，仍需经过样例评测或用户反馈验证，不能直接写入正式 skill。")
  $lines.Add("")

  Set-Content -LiteralPath $recordPath -Encoding UTF8 -Value ($lines -join "`r`n")

  [pscustomobject]@{
    RecordPath = (Resolve-Path -LiteralPath $recordPath).Path
    Title = $Title
    NeedLearning = $NeedLearning
    MaterialType = $MaterialType
    QualitySignal = $QualitySignal
    LearningAction = $LearningAction
  }
} finally {
  Pop-Location
}


