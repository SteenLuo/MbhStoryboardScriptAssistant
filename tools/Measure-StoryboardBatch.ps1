param(
  [Parameter(Mandatory = $false)]
  [string]$Root = "runs",

  [Parameter(Mandatory = $false)]
  [string]$Pattern = "*storyboard*.md",

  [Parameter(Mandatory = $false)]
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
$measureScript = Join-Path $PSScriptRoot "Measure-Storyboard.ps1"

$files = Get-ChildItem -LiteralPath $rootPath -Recurse -File -Filter $Pattern |
  Where-Object {
    $_.Name -match 'storyboard|分镜'
  } |
  Sort-Object FullName

$results = foreach ($file in $files) {
  & $measureScript -Path $file.FullName
}

if ($Json) {
  $results | ConvertTo-Json -Depth 4
} else {
  $results
}



