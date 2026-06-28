param(
  [Parameter(Mandatory = $false)]
  [string]$Root = "samples",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "samples/_reports",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
$outPath = if (Test-Path -LiteralPath $OutDir) {
  Resolve-Path -LiteralPath $OutDir
} else {
  New-Item -ItemType Directory -Force -Path $OutDir
}

$scanScript = Join-Path $PSScriptRoot "Scan-SampleInbox.ps1"
$reportPath = Join-Path $outPath.Path ("inbox-scan-{0}.md" -f $Date)

if ((Test-Path -LiteralPath $reportPath) -and -not $Force) {
  throw "报告已存在：$reportPath。若要覆盖，请添加 -Force。"
}

$json = (& $scanScript -Root $rootPath.Path -Json) -join "`n"
$items = @()
if (-not [string]::IsNullOrWhiteSpace($json)) {
  $parsed = ConvertFrom-Json -InputObject $json
  $items = @($parsed)
}

function Get-GapHits {
  param([pscustomobject]$Item)

  $text = "{0} {1} {2}" -f $Item.Name, $Item.TitleGuess, $Item.MaterialType
  $hits = New-Object System.Collections.Generic.List[string]

  if ($text -match "经营|摆摊|开店|电商|卖货|杂货|八零|直播带货") {
    $hits.Add("经营逆袭")
  }
  if ($text -match "身份|马甲|老板|富豪|土豪|隐藏|反转|打脸") {
    $hits.Add("身份反转")
  }
  if ($text -match "修仙|玄幻|欧皇|盲盒|天道|宗门|灵根|神藏") {
    $hits.Add("修仙玄幻")
  }
  if ($text -match "豪门|替嫁|少奶奶|司爷|千金|退婚|强女主") {
    $hits.Add("豪门强女主")
  }
  if ($text -match "直播|系统|弹幕|手机|面板|短信|聊天|欧皇") {
    $hits.Add("信息层边界")
  }

  if ($hits.Count -eq 0) {
    return ""
  }
  return (($hits | Select-Object -Unique) -join "、")
}

function Get-StudyLevel {
  param([pscustomobject]$Item)

  if ($Item.MaterialType -eq "未知") {
    return "先读正文"
  }
  if ($Item.MaterialType -match "/") {
    return "混合材料，需拆分"
  }
  return "可入库初判"
}

$grouped = $items |
  Group-Object TitleGuess |
  Sort-Object Name

$novelCount = @($items | Where-Object { $_.MaterialType -match '小说' }).Count
$scriptCount = @($items | Where-Object { $_.MaterialType -match '剧本' }).Count
$storyboardCount = @($items | Where-Object { $_.MaterialType -match '分镜' }).Count
$unknownCount = @($items | Where-Object { $_.MaterialType -eq '未知' }).Count

$lines = New-Object System.Collections.Generic.List[string]

$lines.Add("# 样例投放区扫描报告")
$lines.Add("")
$lines.Add("生成日期：$Date")
$lines.Add("")
$lines.Add(("扫描范围：``{0}``" -f $rootPath.Path))
$lines.Add("")
$lines.Add("说明：本报告基于文件名做第一轮判断，不代替正文阅读和对应关系确认。")
$lines.Add("")

$lines.Add("## 一、扫描概览")
$lines.Add("")
$lines.Add("| 指标 | 数量 |")
$lines.Add("| --- | --- |")
$lines.Add("| 文件总数 | $($items.Count) |")
$lines.Add("| 小说初判 | $novelCount |")
$lines.Add("| 剧本初判 | $scriptCount |")
$lines.Add("| 分镜初判 | $storyboardCount |")
$lines.Add("| 未知材料 | $unknownCount |")
$lines.Add("")

$lines.Add("## 二、文件清单")
$lines.Add("")
$lines.Add("| 文件 | 类型初判 | 剧目猜测 | 集数猜测 | 题材缺口命中 | 处理建议 |")
$lines.Add("| --- | --- | --- | --- | --- | --- |")
foreach ($item in $items) {
  $gapHits = Get-GapHits -Item $item
  $episode = if ([string]::IsNullOrWhiteSpace($item.EpisodeGuess)) { "-" } else { $item.EpisodeGuess }
  $gaps = if ([string]::IsNullOrWhiteSpace($gapHits)) { "-" } else { $gapHits }
  $lines.Add(("| ``{0}`` | {1} | {2} | {3} | {4} | {5} |" -f $item.Name, $item.MaterialType, $item.TitleGuess, $episode, $gaps, $item.Suggestion))
}
$lines.Add("")

$lines.Add("## 三、可能关联组")
$lines.Add("")
$lines.Add("| 剧目猜测 | 文件数 | 材料类型 | 集数线索 | 初步判断 |")
$lines.Add("| --- | --- | --- | --- | --- |")
foreach ($group in $grouped) {
  $groupItems = @($group.Group)
  $types = (($groupItems | ForEach-Object { $_.MaterialType } | Select-Object -Unique) -join "、")
  $episodes = (($groupItems | ForEach-Object { $_.EpisodeGuess } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) -join "、")
  if ([string]::IsNullOrWhiteSpace($episodes)) { $episodes = "-" }

  $hasScript = $groupItems | Where-Object { $_.MaterialType -match "剧本" }
  $hasStoryboard = $groupItems | Where-Object { $_.MaterialType -match "分镜" }
  $hasNovel = $groupItems | Where-Object { $_.MaterialType -match "小说" }
  $judgement = if ($hasScript -and $hasStoryboard) {
    "可能剧本-分镜配对"
  } elseif ($hasNovel -and $hasStoryboard) {
    "可能小说/原文-分镜观察组"
  } elseif ($hasNovel -and $hasScript) {
    "可能小说-剧本组"
  } elseif ($groupItems.Count -gt 1) {
    "同名材料组，需读正文"
  } else {
    "单文件，需读正文"
  }

  $lines.Add("| $($group.Name) | $($groupItems.Count) | $types | $episodes | $judgement |")
}
$lines.Add("")

$lines.Add("## 四、命中待补样例清单")
$lines.Add("")
$gapRows = foreach ($item in $items) {
  $gapHits = Get-GapHits -Item $item
  if (-not [string]::IsNullOrWhiteSpace($gapHits)) {
    [pscustomobject]@{
      Name = $item.Name
      Gaps = $gapHits
      Suggestion = "读正文确认后，判断是否进入 M4 评测"
    }
  }
}

if ($gapRows) {
  $lines.Add("| 文件 | 可能补足的缺口 | 建议 |")
  $lines.Add("| --- | --- | --- |")
  foreach ($row in $gapRows) {
    $lines.Add(("| ``{0}`` | {1} | {2} |" -f $row.Name, $row.Gaps, $row.Suggestion))
  }
} else {
  $lines.Add("本轮未从文件名命中明确题材缺口。")
}
$lines.Add("")

$lines.Add("## 五、待确认问题")
$lines.Add("")
$unknownItems = @($items | Where-Object { $_.MaterialType -eq "未知" })
if ($unknownItems.Count -gt 0) {
  foreach ($item in $unknownItems) {
    $lines.Add(("- ``{0}`` 暂无法从文件名判断材料类型，需要读正文后确认。" -f $item.Name))
  }
} else {
  $lines.Add("- 暂无必须向使用人员确认的问题；下一步先读正文二次确认。")
}
$lines.Add("")

$lines.Add("## 六、下一步建议")
$lines.Add("")
$lines.Add("1. 对未知材料先读正文，判断小说 / 剧本 / 分镜 / 混合材料。")
$lines.Add("2. 对可能关联组按一部剧归拢，再按集数建立或更新 ``samples/剧目/``。")
$lines.Add("3. 对命中待补样例清单的材料，优先判断是否能进入 M4 评测。")
$lines.Add("4. 如果剧本和分镜无法确认对应关系，再向使用人员提出简短确认问题。")
$lines.Add("")

Set-Content -LiteralPath $reportPath -Encoding UTF8 -Value ($lines -join "`r`n")

[pscustomobject]@{
  ReportPath = $reportPath
  FileCount = $items.Count
  UnknownCount = $unknownItems.Count
  GroupCount = $grouped.Count
}





