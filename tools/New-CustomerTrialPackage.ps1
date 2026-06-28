param(
  [string]$BaseName = "MbhStoryboardScriptAssistant-CustomerTrial",
  [string]$BaseVersion = "0.1.0",
  [ValidateSet("Both", "Full", "NoSkillOverwrite")]
  [string]$Mode = "Both"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[Package] $Message"
}

function Assert-UnderRoot {
  param(
    [string]$RootPath,
    [string]$TargetPath
  )
  $rootFull = [IO.Path]::GetFullPath($RootPath)
  $targetFull = [IO.Path]::GetFullPath($TargetPath)
  if (!$targetFull.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe path outside root: $targetFull"
  }
}

function Get-RelativePathCompat {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )
  $baseFull = [IO.Path]::GetFullPath($BasePath).TrimEnd("\") + "\"
  $targetFull = [IO.Path]::GetFullPath($TargetPath)
  if (!$targetFull.StartsWith($baseFull, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Target path is outside base path: $targetFull"
  }
  return $targetFull.Substring($baseFull.Length)
}

function Parse-Version {
  param([string]$Text)
  if ($Text -notmatch "^(\d+)\.(\d+)\.(\d+)$") {
    throw "Version must look like 0.1.0, got: $Text"
  }
  return [pscustomobject]@{
    Major = [int]$Matches[1]
    Minor = [int]$Matches[2]
    Patch = [int]$Matches[3]
  }
}

function Get-NextPackageVersion {
  param(
    [string]$DistPath,
    [string]$FallbackVersion
  )

  $versions = @()
  if (Test-Path $DistPath) {
    $versions = Get-ChildItem -LiteralPath $DistPath -Filter "*.zip" -File -ErrorAction SilentlyContinue |
      ForEach-Object {
        if ($_.Name -match "-v(\d+)\.(\d+)\.(\d+)\.zip$") {
          [pscustomobject]@{
            Major = [int]$Matches[1]
            Minor = [int]$Matches[2]
            Patch = [int]$Matches[3]
          }
        }
      }
  }

  if (!$versions -or $versions.Count -eq 0) {
    $base = Parse-Version -Text $FallbackVersion
    $base.Patch += 1
    return $base
  }

  $latest = $versions | Sort-Object Major, Minor, Patch -Descending | Select-Object -First 1
  $latest.Patch += 1
  return $latest
}

function Copy-FileIfExists {
  param(
    [string]$SourceRoot,
    [string]$StageRoot,
    [string]$RelativePath
  )
  $source = Join-Path $SourceRoot $RelativePath
  if (!(Test-Path $source)) {
    return
  }
  $target = Join-Path $StageRoot $RelativePath
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

function Copy-CleanDirectory {
  param(
    [string]$SourceRoot,
    [string]$StageRoot,
    [string]$RelativePath,
    [string[]]$SkipRelative = @()
  )

  $sourceDir = Join-Path $SourceRoot $RelativePath
  if (!(Test-Path $sourceDir)) {
    return
  }

  $sourceFull = [IO.Path]::GetFullPath($sourceDir)
  $targetBase = Join-Path $StageRoot $RelativePath
  New-Item -ItemType Directory -Path $targetBase -Force | Out-Null

  Get-ChildItem -LiteralPath $sourceDir -Recurse -Force | ForEach-Object {
    $full = [IO.Path]::GetFullPath($_.FullName)
    $relativeFromRoot = (Get-RelativePathCompat -BasePath $SourceRoot -TargetPath $full).Replace("\", "/")
    foreach ($skip in $SkipRelative) {
      $normalizedSkip = $skip.Replace("\", "/").TrimEnd("/")
      if ($relativeFromRoot -eq $normalizedSkip -or $relativeFromRoot.StartsWith("$normalizedSkip/", [StringComparison]::OrdinalIgnoreCase)) {
        return
      }
    }

    $relativeFromDir = Get-RelativePathCompat -BasePath $sourceFull -TargetPath $full
    $target = Join-Path $targetBase $relativeFromDir
    if ($_.PSIsContainer) {
      New-Item -ItemType Directory -Path $target -Force | Out-Null
    } else {
      New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }
}

function New-TextFile {
  param(
    [string]$Path,
    [string[]]$Lines
  )
  New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Test-CleanPackage {
  param(
    [string]$StageRoot,
    [bool]$ExpectSkills
  )

  $blockedPatterns = @(
    "app/config/deepseek.local.json",
    "app/config/app.local.json",
    ".env",
    ".env.local",
    "app/data/conversations",
    "app/runtime",
    "runs",
    ".git",
    ".gitignore",
    "app-server.out.log",
    "app-server.err.log"
  )

  $hits = @()
  Get-ChildItem -LiteralPath $StageRoot -Recurse -Force | ForEach-Object {
    $relative = (Get-RelativePathCompat -BasePath $StageRoot -TargetPath $_.FullName).Replace("\", "/")
    foreach ($pattern in $blockedPatterns) {
      if ($relative -eq $pattern -or $relative.StartsWith("$pattern/", [StringComparison]::OrdinalIgnoreCase)) {
        $hits += $relative
      }
    }
  }

  if ($hits.Count -gt 0) {
    throw "Package contains blocked private/runtime files: $($hits -join ', ')"
  }

  $skillsPath = Join-Path $StageRoot "skills"
  if ($ExpectSkills -and !(Test-Path $skillsPath)) {
    throw "Full package must include skills."
  }
  if (!$ExpectSkills -and (Test-Path $skillsPath)) {
    throw "NoSkillOverwrite package must not include skills."
  }
}

function Copy-RootBatEntries {
  param(
    [string]$SourceRoot,
    [string]$StageRoot
  )
  Get-ChildItem -LiteralPath $SourceRoot -Filter "*.bat" -File | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch "New-CustomerTrialPackage") {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $StageRoot $_.Name) -Force
    }
  }
}

function New-CustomerPackage {
  param(
    [string]$RootPath,
    [string]$DistPath,
    [string]$BuildRoot,
    [string]$PackageName,
    [string]$Version,
    [bool]$IncludeSkills
  )

  $packageFolderName = "$PackageName-v$Version"
  $stage = Join-Path $BuildRoot $packageFolderName
  $zipPath = Join-Path $DistPath "$packageFolderName.zip"

  Assert-UnderRoot -RootPath $DistPath -TargetPath $BuildRoot
  if (Test-Path $BuildRoot) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force
  }
  if (Test-Path $zipPath) {
    throw "Target zip already exists: $zipPath"
  }

  Write-Step "Building clean package: $packageFolderName"
  New-Item -ItemType Directory -Path $stage -Force | Out-Null

  Get-ChildItem -LiteralPath $RootPath -Filter "*.md" -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stage $_.Name) -Force
  }
  Copy-FileIfExists -SourceRoot $RootPath -StageRoot $stage -RelativePath ".env.example"
  Copy-RootBatEntries -SourceRoot $RootPath -StageRoot $stage

  Copy-CleanDirectory -SourceRoot $RootPath -StageRoot $stage -RelativePath "app" -SkipRelative @(
    "app/.gitignore",
    "app/config/deepseek.local.json",
    "app/config/app.local.json",
    "app/data",
    "app/runtime"
  )
  Copy-CleanDirectory -SourceRoot $RootPath -StageRoot $stage -RelativePath "docs"
  Copy-CleanDirectory -SourceRoot $RootPath -StageRoot $stage -RelativePath "tools" -SkipRelative @(
    "tools/New-CustomerTrialPackage.ps1"
  )

  if ($IncludeSkills) {
    Copy-CleanDirectory -SourceRoot $RootPath -StageRoot $stage -RelativePath "skills"
  }

  Copy-FileIfExists -SourceRoot $RootPath -StageRoot $stage -RelativePath "learning/README.md"
  Copy-CleanDirectory -SourceRoot $RootPath -StageRoot $stage -RelativePath "learning/templates"

  $emptyDirs = @(
    "learning/accepted-rules",
    "learning/candidate-rules",
    "learning/conversation-records",
    "learning/evals",
    "learning/regression-reports",
    "learning/snapshots",
    "learning/skill-evolution-reports",
    "samples/_inbox",
    "samples/_reports"
  )
  foreach ($dir in $emptyDirs) {
    $target = Join-Path $stage $dir
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    New-TextFile -Path (Join-Path $target "README.txt") -Lines @(
      "This directory is intentionally empty in the customer trial package.",
      "Runtime data created by the customer will be stored here."
    )
  }

  Copy-FileIfExists -SourceRoot $RootPath -StageRoot $stage -RelativePath "samples/README.md"

  New-TextFile -Path (Join-Path $stage "VERSION.txt") -Lines @("v$Version")
  New-TextFile -Path (Join-Path $stage "PACKAGE-CONTENTS.txt") -Lines @(
    "Clean customer trial package.",
    "",
    "Version: v$Version",
    "Mode: $(if ($IncludeSkills) { 'Full initial package with skills' } else { 'Update package without skills overwrite' })",
    "",
    "Excluded on purpose:",
    "- .env and .env.local",
    "- app/config/deepseek.local.json",
    "- app/config/app.local.json",
    "- app/data/conversations",
    "- app/runtime",
    "- runs",
    "- existing learning records and evaluation outputs",
    "- existing sample source files",
    "",
    "Skill policy:",
    "$(if ($IncludeSkills) { '- This package includes the initial skills directory.' } else { '- This package does not include the skills directory, so it will not overwrite customer skills.' })",
    "",
    "Customer entry points:",
    "- startup BAT in the package root",
    "- stop BAT in the package root"
  )

  Test-CleanPackage -StageRoot $stage -ExpectSkills $IncludeSkills

  Write-Step "Creating zip: $zipPath"
  Compress-Archive -LiteralPath $stage -DestinationPath $zipPath -CompressionLevel Optimal
  Remove-Item -LiteralPath $BuildRoot -Recurse -Force

  Write-Step "Done: $zipPath"
  return $zipPath
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Path $dist -Force | Out-Null

$next = Get-NextPackageVersion -DistPath $dist -FallbackVersion $BaseVersion
$version = "$($next.Major).$($next.Minor).$($next.Patch)"
$buildRoot = Join-Path $dist "_package-build"

$targets = @()
if ($Mode -eq "Both" -or $Mode -eq "Full") {
  $targets += [pscustomobject]@{
    Name = "$BaseName-Full"
    IncludeSkills = $true
  }
}
if ($Mode -eq "Both" -or $Mode -eq "NoSkillOverwrite") {
  $targets += [pscustomobject]@{
    Name = "$BaseName-NoSkillOverwrite"
    IncludeSkills = $false
  }
}

$created = @()
foreach ($target in $targets) {
  $created += New-CustomerPackage -RootPath $root -DistPath $dist -BuildRoot $buildRoot -PackageName $target.Name -Version $version -IncludeSkills $target.IncludeSkills
}

Write-Step "Created package count: $($created.Count)"
foreach ($item in $created) {
  Write-Step "Package: $item"
}
