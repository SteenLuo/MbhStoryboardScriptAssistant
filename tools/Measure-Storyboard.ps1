param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$Path
)

$ErrorActionPreference = "Stop"

foreach ($item in $Path) {
  $resolved = Resolve-Path -LiteralPath $item
  $text = Get-Content -LiteralPath $resolved -Encoding UTF8 -Raw

  $shotMatches = [regex]::Matches($text, '镜(?:号|头)\s*[:： ]?\s*\d+')
  $durationMatches = [regex]::Matches($text, '时长[:：]\s*(\d+)s')
  $durations = @($durationMatches | ForEach-Object { [int]$_.Groups[1].Value })
  $total = ($durations | Measure-Object -Sum).Sum
  if ($null -eq $total) {
    $total = 0
  }

  $fixed = [regex]::Matches($text, '运镜[:：][^\r\n]*(固定|固定镜头)').Count
  $motion = [regex]::Matches($text, '运镜[:：][^\r\n]*(推|拉|摇|移|跟|升|降|手持|甩|晃|横移|下摇|上移|推进|猛推|降格|升格)').Count
  $infoLayer = [regex]::Matches($text, '直播|弹幕|系统|手机|短信|聊天|面板|选项|奖励|转账|定位').Count
  $sceneCount = [regex]::Matches($text, '(?m)^(场次[:：]\s*)?\d+-\d+').Count

  [pscustomobject]@{
    File = $resolved.Path
    Scenes = $sceneCount
    Shots = $shotMatches.Count
    Durations = $durations.Count
    MissingDuration = $shotMatches.Count - $durations.Count
    TotalSeconds = [int]$total
    AvgSeconds = if ($durations.Count -gt 0) { [math]::Round($total / $durations.Count, 2) } else { 0 }
    FixedShots = $fixed
    MotionShots = $motion
    InfoLayerHits = $infoLayer
    HasEnding = ($text.Contains('【本集完】') -or ([regex]::IsMatch($text, '字幕[:：][^\r\n]*完')))
  }
}






