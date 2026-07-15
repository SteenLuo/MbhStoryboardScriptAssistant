param(
  [int]$Port = 17877,
  [switch]$NoOpenBrowser
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[Mbh Assistant] $Message"
}

function Open-AssistantPage {
  param([string]$TargetUrl)
  if ($NoOpenBrowser) {
    Write-Step "Browser launch skipped."
    return
  }
  Start-Process $TargetUrl
}

function Test-AssistantHttp {
  param([int]$TargetPort)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$TargetPort/" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-AssistantStatus {
  param([int]$TargetPort)
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$TargetPort/api/status" -UseBasicParsing -TimeoutSec 2
  } catch {
    return $null
  }
}

function Normalize-PathForCompare {
  param([string]$Path)
  if (!$Path) {
    return ""
  }
  try {
    return ([IO.Path]::GetFullPath($Path)).TrimEnd([char[]]@("\", "/")).ToLowerInvariant()
  } catch {
    return ""
  }
}

function Get-NodeCommand {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }
  return $null
}

function Start-NodeInstaller {
  $downloadDir = Join-Path $env:TEMP "MbhStoryboardScriptAssistant"
  New-Item -ItemType Directory -Path $downloadDir -Force | Out-Null
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $indexUrl = "https://nodejs.org/dist/index.json"

  Write-Step "Node.js was not found. Checking the latest official LTS installer."
  $versions = Invoke-RestMethod -Uri $indexUrl
  $ltsVersion = ($versions | Where-Object { $_.lts } | Select-Object -First 1).version
  if (!$ltsVersion) {
    throw "Could not find a Node.js LTS version from $indexUrl"
  }

  $installerName = "node-$ltsVersion-$arch.msi"
  $installerPath = Join-Path $downloadDir $installerName
  $nodeUrl = "https://nodejs.org/dist/$ltsVersion/$installerName"

  Write-Step "Downloading Node.js LTS installer: $nodeUrl"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath

  Write-Step "Installer saved to: $installerPath"
  Write-Step "Please finish the installer, then double-click the root startup BAT again."
  Start-Process -FilePath $installerPath
}

function Test-PortInUse {
  param([int]$TargetPort)
  $connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  return [bool]$connection
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDir = Join-Path $root "app"
$serverFile = Join-Path $appDir "server.js"
$runtimeDir = Join-Path $appDir "runtime"
$pidFile = Join-Path $runtimeDir "app-server-$Port.pid"
$outLog = Join-Path $runtimeDir "app-server.out.log"
$errLog = Join-Path $runtimeDir "app-server.err.log"
$url = "http://127.0.0.1:$Port"

if (!(Test-Path $serverFile)) {
  throw "Server entry was not found: $serverFile"
}

$node = Get-NodeCommand
if (!$node) {
  Start-NodeInstaller
  exit 0
}

Write-Step "Node.js is ready: $node"

if (Test-AssistantHttp -TargetPort $Port) {
  $status = Get-AssistantStatus -TargetPort $Port
  $serviceRoot = [string]$status.rootPath
  $currentRoot = [string]$root
  $serviceRootKey = Normalize-PathForCompare -Path $serviceRoot
  $currentRootKey = Normalize-PathForCompare -Path $currentRoot

  if ($serviceRootKey -and $serviceRootKey -eq $currentRootKey) {
    Write-Step "Service is already running."
    Open-AssistantPage -TargetUrl $url
    exit 0
  }

  Write-Host ""
  Write-Host "Port $Port is already running from a different or unknown package folder."
  if ($serviceRoot) {
    Write-Host "Running service folder: $serviceRoot"
  } else {
    Write-Host "Running service folder: unknown, likely an older package."
  }
  Write-Host "Current package folder: $currentRoot"
  Write-Host "Please run restart service from this package, or close the old service window first."
  exit 1
}

if (Test-PortInUse -TargetPort $Port) {
  Write-Host ""
  Write-Host "Port $Port is already in use, but this assistant did not respond correctly."
  Write-Host "Please close the program using this port or ask the maintainer for help."
  exit 1
}

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Write-Step "Service is not running. Opening the service window."

$arguments = @(
  "-NoProfile",
  "-NoExit",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "Set-Location -LiteralPath '$root'; `$env:MBH_WEB_PORT='$Port'; node app/server.js"
)

$process = Start-Process -FilePath "powershell.exe" `
  -ArgumentList $arguments `
  -WorkingDirectory $root `
  -PassThru

Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
Write-Step "Service window started. Process id: $($process.Id)"

$ready = $false
for ($i = 0; $i -lt 30; $i += 1) {
  Start-Sleep -Milliseconds 500
  if (Test-AssistantHttp -TargetPort $Port) {
    $ready = $true
    break
  }
}

if (!$ready) {
  Write-Host ""
  Write-Host "The service window is open, but the page is not responding yet."
  Write-Host "Please check the service window for errors."
  exit 1
}

Write-Step "Service is ready."
Open-AssistantPage -TargetUrl $url
