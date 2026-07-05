param(
  [switch]$KeepLearningData
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BaselineSkills = Join-Path $Root "baselines\initial-skills\skills"
$ActiveSkills = Join-Path $Root "skills"
$LearningRoot = Join-Path $Root "learning"

function Assert-UnderRoot {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Label
  )
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  if (-not $resolvedPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label path is outside workspace: $resolvedPath"
  }
}

function Remove-IfExists {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Force
  }
}

Assert-UnderRoot -Path $BaselineSkills -Label "Baseline skills"
Assert-UnderRoot -Path $ActiveSkills -Label "Active skills"
Assert-UnderRoot -Path $LearningRoot -Label "Learning root"

if (-not (Test-Path -LiteralPath $BaselineSkills)) {
  throw "Missing initial skills baseline: $BaselineSkills"
}
if ([System.IO.Path]::GetFileName($ActiveSkills) -ne "skills") {
  throw "Refusing to reset unexpected active skills path: $ActiveSkills"
}

if (Test-Path -LiteralPath $ActiveSkills) {
  Remove-Item -LiteralPath $ActiveSkills -Recurse -Force
}
Copy-Item -LiteralPath $BaselineSkills -Destination $ActiveSkills -Recurse -Force

if (-not $KeepLearningData) {
  New-Item -ItemType Directory -Force -Path $LearningRoot | Out-Null
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText((Join-Path $LearningRoot "events.jsonl"), "", $utf8NoBom)
  $emptyRuleset = @'
{
  "version": 0,
  "lastGoodVersion": 0,
  "updatedAt": "",
  "rules": []
}
'@
  [System.IO.File]::WriteAllText((Join-Path $LearningRoot "current-ruleset.json"), $emptyRuleset, $utf8NoBom)

  $cleanupPatterns = @(
    "ruleset-history\*.json",
    "conversation-records\*.md",
    "candidate-rules\*.md",
    "candidate-rules\*.json",
    "skill-evolution-reports\*.json",
    "snapshots\learning-snapshot-*.md",
    "evidence\*.json",
    "samples\*.json",
    "evals\*.json"
  )
  foreach ($pattern in $cleanupPatterns) {
    Get-ChildItem -Path (Join-Path $LearningRoot $pattern) -File -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -ne "README.md") {
        Remove-Item -LiteralPath $_.FullName -Force
      }
    }
  }
}

Write-Host "[Reset] Skills restored from baselines\\initial-skills."
if ($KeepLearningData) {
  Write-Host "[Reset] Learning runtime data kept."
} else {
  Write-Host "[Reset] Learning runtime data cleared."
}
