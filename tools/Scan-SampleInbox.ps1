param(
  [Parameter(Mandatory = $false)]
  [string]$Root = "samples",

  [Parameter(Mandatory = $false)]
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
$inboxPath = Join-Path $rootPath.Path "_inbox"

$typeWords = @("剧本", "分镜", "小说", "改写稿", "完本", "草稿", "定稿")
$episodePattern = "第[一二三四五六七八九十百0-9]+[集章节]|[0-9]+[-_ ]?第?[集章节]"

function Get-MaterialType {
  param([string]$Name)

  $types = New-Object System.Collections.Generic.List[string]
  if ($Name -match "小说|完本") { $types.Add("小说") }
  if ($Name -match "剧本|改写稿") { $types.Add("剧本") }
  if ($Name -match "分镜|镜头") { $types.Add("分镜") }
  if ($types.Count -eq 0) { $types.Add("未知") }
  return ($types -join "/")
}

function Get-TitleGuess {
  param([string]$BaseName)

  $episode = [regex]::Match($BaseName, $episodePattern)
  $title = $BaseName
  foreach ($word in $typeWords) {
    $title = $title -replace [regex]::Escape($word), ""
  }
  $title = $title -replace $episodePattern, ""
  $title = $title -replace "[\[\]【】（）()《》!！\-_\s]+", ""
  if ([string]::IsNullOrWhiteSpace($title)) {
    if ($episode.Success) {
      return $episode.Value
    }
    return $BaseName
  }
  return $title
}

function Normalize-SeriesTitle {
  param(
    [string]$Title,
    [string]$BaseName
  )

  $source = "{0} {1}" -f $Title, $BaseName
  if ($source -match "八零") { return "八零杂货铺" }
  if ($source -match "欧皇|盲盒带我") { return "欧皇盲盒" }
  if ($source -match "司爷|少奶奶") { return "司爷少奶奶" }
  return $Title
}

$files = @()

if (Test-Path -LiteralPath $inboxPath) {
  $files += Get-ChildItem -LiteralPath $inboxPath -File |
    Where-Object {
      $_.Name -notin @("README.md")
    }
}

$files += Get-ChildItem -LiteralPath $rootPath -File |
  Where-Object {
    $_.Name -notin @("README.md", "待补样例清单.md")
  }

$results = foreach ($file in ($files | Sort-Object FullName)) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $episode = [regex]::Match($base, $episodePattern)
  $materialType = Get-MaterialType -Name $base
  $titleGuess = Get-TitleGuess -BaseName $base
  $titleGuess = Normalize-SeriesTitle -Title $titleGuess -BaseName $base
  $suggestion = if ($materialType -eq "未知") {
    "先读正文再判断"
  } elseif ($materialType -match "剧本|分镜|小说") {
    "按剧目归拢后判断对应关系"
  } else {
    "待确认"
  }

  [pscustomobject]@{
    File = $file.FullName
    Name = $file.Name
    Extension = $file.Extension
    MaterialType = $materialType
    TitleGuess = $titleGuess
    EpisodeGuess = if ($episode.Success) { $episode.Value } else { "" }
    SizeBytes = $file.Length
    Suggestion = $suggestion
  }
}

if ($Json) {
  $results | ConvertTo-Json -Depth 4
} else {
  $results
}




