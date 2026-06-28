param(
  [int]$Port = 17877
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[Mbh Assistant] $Message"
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-ProcessByIdIfMatches {
  param(
    [int]$ProcessId,
    [string]$RootPath
  )

  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (!$processInfo) {
    return $false
  }

  $commandLine = [string]$processInfo.CommandLine
  $normalizedRoot = [string]$RootPath
  if ($commandLine -notmatch "node" -and $commandLine -notmatch "powershell") {
    return $false
  }
  if (!$commandLine.Contains($normalizedRoot) -and $commandLine -notmatch "app[/\\]server\.js") {
    return $false
  }

  Stop-ProcessTree -ProcessId $ProcessId
  return $true
}

function Get-AssistantProcesses {
  param(
    [string]$RootPath,
    [int]$TargetPort
  )
  $escapedRoot = [regex]::Escape($RootPath)
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.CommandLine -and
      (
        ($_.CommandLine -match $escapedRoot -and $_.CommandLine -match "MBH_WEB_PORT" -and $_.CommandLine -match [regex]::Escape([string]$TargetPort)) -or
        ($TargetPort -eq 17877 -and $_.CommandLine -match "app[/\\]server\.js")
      )
    }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$runtimeDir = Join-Path $root "app\runtime"
$pidFiles = @((Join-Path $runtimeDir "app-server-$Port.pid"))
if ($Port -eq 17877) {
  $pidFiles += (Join-Path $runtimeDir "app-server.pid")
}
$stopped = 0

foreach ($pidFile in $pidFiles) {
  if (Test-Path $pidFile) {
    $pidText = (Get-Content -Path $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $pidNumber = 0
    if ([int]::TryParse($pidText, [ref]$pidNumber)) {
      if (Stop-ProcessByIdIfMatches -ProcessId $pidNumber -RootPath $root) {
        $stopped += 1
        Write-Step "Stopped service process from pid file: $pidNumber"
      }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }
}

$processes = @(Get-AssistantProcesses -RootPath $root -TargetPort $Port)
foreach ($processInfo in $processes) {
  try {
    Stop-Process -Id $processInfo.ProcessId -Force
    $stopped += 1
    Write-Step "Stopped assistant service process: $($processInfo.ProcessId)"
  } catch {
    Write-Step "Failed to stop process $($processInfo.ProcessId): $($_.Exception.Message)"
  }
}

if ($stopped -eq 0) {
  Write-Step "No running assistant service was found."
} else {
  Write-Step "Stop completed."
}
