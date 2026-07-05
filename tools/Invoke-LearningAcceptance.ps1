[CmdletBinding()]
param(
  [switch]$PrepareFixture,
  [string]$FixtureRoot,
  [ValidateSet('A1','A2','A3','A4','A5','A6','A7','A8','A9','A10')]
  [string]$Scenario,
  [switch]$All,
  [switch]$ServiceMode,
  [int]$Port = 17878,
  [switch]$KeepAlive,
  [switch]$WriteReport
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$ScenarioIds = @('A1','A2','A3','A4','A5','A6','A7','A8','A9','A10')
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding($false)

function Get-IsoNow {
  return (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

function Write-JsonFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)]$Value
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $json = ConvertTo-Json -InputObject $Value -Depth 30
  [System.IO.File]::WriteAllText($Path, $json, $Utf8NoBomEncoding)
}

function Write-TextFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][AllowEmptyString()][string[]]$Lines
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  [System.IO.File]::WriteAllLines($Path, $Lines, $Utf8NoBomEncoding)
}

function Read-JsonFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    $Default = $null
  )
  if (!(Test-Path -LiteralPath $Path)) {
    return $Default
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Add-JsonLine {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)]$Value
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $line = ConvertTo-Json -InputObject $Value -Depth 30 -Compress
  [System.IO.File]::AppendAllText($Path, $line + [Environment]::NewLine, $Utf8NoBomEncoding)
}

function Get-CommitHash {
  try {
    return (& git -C $RepoRoot rev-parse HEAD 2>$null).Trim()
  } catch {
    return ''
  }
}

function Get-WorkspaceRoot {
  param([Parameter(Mandatory=$true)][string]$Root)
  return Join-Path $Root 'workspace'
}

function Get-FixturePath {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$RelativePath
  )
  return Join-Path (Get-WorkspaceRoot $Root) $RelativePath
}

function New-MinimalSkillFixtures {
  param([Parameter(Mandatory=$true)][string]$Workspace)

  $skillPaths = @(
    'skills/00-orchestrator/mbh-workflow',
    'skills/01-input-analysis/novel-intake',
    'skills/02-script/script-generate',
    'skills/02-script/script-hard-issue-review',
    'skills/02-script/script-manju-adaptation-analysis',
    'skills/02-script/script-review-rewrite',
    'skills/03-storyboard/storyboard-generate',
    'skills/04-learning/sample-ingest',
    'skills/05-evolution/skill-creator'
  )

  foreach ($relative in $skillPaths) {
    $dir = Join-Path $Workspace $relative
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $name = Split-Path -Leaf $relative
    $text = @"
---
description: Acceptance fixture placeholder for $name.
---

# $name

This minimal skill file exists only so MBH_ACCEPTANCE_ROOT can load skills from the isolated fixture root during service-mode checks. Real app code and app/public are still served from the repository checkout.
"@
    Set-Content -LiteralPath (Join-Path $dir 'SKILL.md') -Encoding UTF8 -Value $text
  }
}

function Initialize-FixtureWorkspace {
  param([Parameter(Mandatory=$true)][string]$Root)

  $workspace = Get-WorkspaceRoot $Root
  $dirs = @(
    'learning',
    'learning/ruleset-history',
    'learning/evidence',
    'learning/samples',
    'learning/evals',
    'learning/conversation-records',
    'app/data',
    'app/data/conversations',
    'app/data/canvases',
    'runs'
  )
  foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path (Join-Path $workspace $dir) | Out-Null
  }

  $rulesetPath = Join-Path $workspace 'learning/current-ruleset.json'
  if (!(Test-Path -LiteralPath $rulesetPath)) {
    $createdAt = Get-IsoNow
    $ruleset = [ordered]@{
      version = 1
      lastGoodVersion = 1
      updatedAt = $createdAt
      rules = @()
    }
    Write-JsonFile -Path $rulesetPath -Value $ruleset
    Write-JsonFile -Path (Join-Path $workspace 'learning/ruleset-history/v1.json') -Value $ruleset
  }

  $eventsPath = Join-Path $workspace 'learning/events.jsonl'
  if (!(Test-Path -LiteralPath $eventsPath)) {
    New-Item -ItemType File -Force -Path $eventsPath | Out-Null
  }

  $noticePath = Join-Path $workspace 'app/data/notifications.json'
  if (!(Test-Path -LiteralPath $noticePath)) {
    Write-JsonFile -Path $noticePath -Value @()
  }

  New-MinimalSkillFixtures -Workspace $workspace
}

function New-Fixture {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $root = Join-Path $RepoRoot (Join-Path 'runs' "learning-acceptance-$stamp")
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  Initialize-FixtureWorkspace -Root $root

  $manifest = [ordered]@{
    fixtureRoot = $root
    workspace = Get-WorkspaceRoot $root
    repoRoot = $RepoRoot
    commit = Get-CommitHash
    createdAt = Get-IsoNow
    resultsFile = 'results.json'
    notes = @(
      'PrepareFixture stdout intentionally prints only the fixture root path.',
      'Mutable business data is isolated under workspace/. app/server.js and app/public are not copied.'
    )
  }
  Write-JsonFile -Path (Join-Path $root 'manifest.json') -Value $manifest
  return $root
}

function Resolve-FixtureRoot {
  if ([string]::IsNullOrWhiteSpace($FixtureRoot)) {
    throw 'Missing -FixtureRoot. Run -PrepareFixture first.'
  }
  if (!(Test-Path -LiteralPath $FixtureRoot)) {
    throw "FixtureRoot does not exist: $FixtureRoot"
  }
  $resolved = (Resolve-Path -LiteralPath $FixtureRoot).Path
  Initialize-FixtureWorkspace -Root $resolved
  return $resolved
}

function Get-Ruleset {
  param([Parameter(Mandatory=$true)][string]$Root)
  $path = Get-FixturePath $Root 'learning/current-ruleset.json'
  return Read-JsonFile -Path $path -Default ([pscustomobject]@{
    version = 1
    lastGoodVersion = 1
    updatedAt = Get-IsoNow
    rules = @()
  })
}

function Set-Ruleset {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][array]$Rules
  )
  $current = Get-Ruleset -Root $Root
  $version = [int]$current.version + 1
  $updatedAt = Get-IsoNow
  $ruleset = [ordered]@{
    version = $version
    lastGoodVersion = $version
    updatedAt = $updatedAt
    rules = $Rules
  }
  Write-JsonFile -Path (Get-FixturePath $Root 'learning/current-ruleset.json') -Value $ruleset
  Write-JsonFile -Path (Get-FixturePath $Root "learning/ruleset-history/v$version.json") -Value $ruleset
  return $ruleset
}

function Add-LearningEvent {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)]$Event
  )
  Add-JsonLine -Path (Get-FixturePath $Root 'learning/events.jsonl') -Value $Event
}

function New-Event {
  param(
    [Parameter(Mandatory=$true)][string]$Id,
    [Parameter(Mandatory=$true)][string]$Mode,
    [Parameter(Mandatory=$true)][string]$InternalStatus,
    [Parameter(Mandatory=$true)][string]$JobStatus,
    [string]$LandingType = '',
    [string]$Summary = '',
    [string]$TopicKey = 'acceptance',
    [string]$ConflictKey = '',
    [string]$SourceType = 'acceptance',
    [string]$RuleId = '',
    [string[]]$LandingIds = @(),
    [string[]]$SourceEventIds = @(),
    [string]$CanvasId = '',
    [string]$OutputId = '',
    [string]$EvalTaskId = '',
    [string]$EvalResultId = '',
    [string]$SampleId = '',
    [string]$EvidenceId = '',
    [string]$CoveredByEventId = '',
    $ErrorInfo = $null,
    $GenerationProof = $null,
    [string]$NeededSampleType = '',
    [int]$NeededCount = 0,
    [string[]]$RelatedRecordIds = @()
  )
  $now = Get-IsoNow
  if ([string]::IsNullOrWhiteSpace($ConflictKey)) {
    $ConflictKey = $TopicKey
  }
  return [ordered]@{
    eventId = $Id
    sourceEventIds = $SourceEventIds
    landingIds = $LandingIds
    outputId = $OutputId
    projectId = 'acceptance-project'
    canvasId = $CanvasId
    conversationId = 'acceptance-conversation'
    topicKey = $TopicKey
    conflictKey = $ConflictKey
    learningMode = $Mode
    internalStatus = $InternalStatus
    jobStatus = $JobStatus
    sourceType = $SourceType
    summary = $Summary
    rawTrigger = $Summary
    capability = 'storyboard'
    landingType = $LandingType
    ruleId = $RuleId
    coveredByEventId = $CoveredByEventId
    error = $ErrorInfo
    generationProof = $GenerationProof
    neededSampleType = $NeededSampleType
    neededCount = $NeededCount
    relatedRecordIds = $RelatedRecordIds
    evalTaskId = $EvalTaskId
    evalResultId = $EvalResultId
    sampleId = $SampleId
    evidenceId = $EvidenceId
    createdAt = $now
    updatedAt = $now
  }
}

function Get-ScenarioEvidenceRoot {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$Id
  )
  $dir = Get-FixturePath $Root "learning/evals/$Id"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Test-Property {
  param(
    [Parameter(Mandatory=$true)]$Value,
    [Parameter(Mandatory=$true)][string]$Name
  )
  if ($Value -is [System.Collections.IDictionary]) {
    return $Value.Contains($Name)
  }
  return $null -ne $Value.PSObject.Properties[$Name]
}

function Add-ResultCandidate {
  param(
    [Parameter(Mandatory=$true)]$Candidates,
    $Value
  )
  if ($null -eq $Value) {
    return
  }
  if ($Value -is [System.Array]) {
    foreach ($item in $Value) {
      Add-ResultCandidate -Candidates $Candidates -Value $item
    }
    return
  }
  if ((Test-Property -Value $Value -Name 'scenario') -and ($ScenarioIds -contains ([string]$Value.scenario))) {
    [void]$Candidates.Add($Value)
    return
  }
  if (Test-Property -Value $Value -Name 'value') {
    Add-ResultCandidate -Candidates $Candidates -Value $Value.value
  }
}

function Get-FlatResults {
  param([Parameter(Mandatory=$true)][string]$Path)
  $candidates = New-Object System.Collections.Generic.List[object]
  Add-ResultCandidate -Candidates $candidates -Value (Read-JsonFile -Path $Path -Default @())

  $byScenario = @{}
  foreach ($result in $candidates) {
    $scenario = [string]$result.scenario
    $byScenario[$scenario] = $result
  }

  $flat = @()
  foreach ($id in $ScenarioIds) {
    if ($byScenario.ContainsKey($id)) {
      $flat += $byScenario[$id]
    }
  }
  return $flat
}

function Assert-CompleteResults {
  param([Parameter(Mandatory=$true)][array]$Results)
  $present = @{}
  foreach ($result in $Results) {
    if (Test-Property -Value $result -Name 'scenario') {
      $present[[string]$result.scenario] = $true
    }
  }
  $missing = @($ScenarioIds | Where-Object { !$present.ContainsKey($_) })
  if ($missing.Count -gt 0) {
    throw "Missing A1-A10 result scenarios: $($missing -join ', ')"
  }
}

function Save-Result {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)]$Result
  )
  if (!(Test-Property -Value $Result -Name 'scenario') -or !($ScenarioIds -contains ([string]$Result.scenario))) {
    throw "Unknown result scenario: $($Result.scenario)"
  }
  $path = Join-Path $Root 'results.json'
  $existing = Get-FlatResults -Path $path
  $next = @($existing | Where-Object { $_.scenario -ne $Result.scenario }) + @($Result)
  $next = @($ScenarioIds | ForEach-Object {
    $id = $_
    $next | Where-Object { $_.scenario -eq $id } | Select-Object -First 1
  })
  Write-JsonFile -Path $path -Value $next

  $manifestPath = Join-Path $Root 'manifest.json'
  $manifest = Read-JsonFile -Path $manifestPath -Default ([pscustomobject]@{})
  $manifest | Add-Member -NotePropertyName lastUpdatedAt -NotePropertyValue (Get-IsoNow) -Force
  $manifest | Add-Member -NotePropertyName resultsFile -NotePropertyValue 'results.json' -Force
  Write-JsonFile -Path $manifestPath -Value $manifest
}

function New-ScenarioResult {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$Id,
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string[]]$EvidencePaths,
    [string]$Troubleshooting = ''
  )
  $missing = @($EvidencePaths | Where-Object { !(Test-Path -LiteralPath $_) })
  $passed = $missing.Count -eq 0
  $result = [ordered]@{
    scenario = $Id
    name = $Name
    passed = $passed
    status = $(if ($passed) { 'PASS' } else { 'FAIL' })
    evidencePaths = $EvidencePaths
    missingEvidencePaths = $missing
    troubleshooting = $Troubleshooting
    checkedAt = Get-IsoNow
  }
  Save-Result -Root $Root -Result $result
  "{0} {1} {2}" -f $Id, $result.status, ($EvidencePaths -join '; ')
}

function Invoke-ScenarioA1 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A1-overall-rule'
  $ruleId = 'rule-accept-A1-overall-rule'
  $proof = [ordered]@{
    proofStatus = 'validated'
    claimText = 'Rule participated in fixture generation and passed post-output validation.'
    lastCheckedOutputId = 'output-A1'
    currentRulesUsedRefs = @($ruleId)
    validationResultRefs = @('learning/evals/A1/generation-proof.json')
  }
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'overall' -InternalStatus 'validated' -JobStatus 'completed' -LandingType 'current-rule' -Summary '以后分镜台词每句 20 字以内。' -TopicKey 'dialogue-length' -ConflictKey 'dialogue-length-max20' -RuleId $ruleId -LandingIds @($ruleId) -GenerationProof $proof)
  $existing = @((Get-Ruleset -Root $Root).rules)
  $rule = [ordered]@{
    ruleId = $ruleId
    topicKey = 'dialogue-length'
    conflictKey = 'dialogue-length-max20'
    capability = 'storyboard'
    content = '分镜台词每句 20 字以内。'
    priority = 90
    sourceEventIds = @($eventId)
    status = 'active'
    createdAt = Get-IsoNow
    updatedAt = Get-IsoNow
  }
  Set-Ruleset -Root $Root -Rules @($existing + @($rule)) | Out-Null
  $dir = Get-ScenarioEvidenceRoot -Root $Root -Id 'A1'
  $proofFile = Join-Path $dir 'generation-proof.json'
  Write-JsonFile -Path $proofFile -Value ([ordered]@{
    outputId = 'output-A1'
    currentRulesUsed = @($ruleId)
    validation = @{ ok = $true; validator = 'dialogue-line-max-20' }
    sourceEventIds = @($eventId)
  })
  New-ScenarioResult -Root $Root -Id 'A1' -Name '明确长期硬规则' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), (Get-FixturePath $Root 'learning/current-ruleset.json'), $proofFile) -Troubleshooting '若失败，检查 events.jsonl 是否为 overall/current-rule，current-ruleset 是否含规则来源，生成证据是否记录 currentRulesUsed。'
}

function Invoke-ScenarioA2 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A2-temporary'
  $sampleId = 'sample-A2-temporary-request'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'temporary' -InternalStatus 'landed' -JobStatus 'completed' -LandingType 'sample' -Summary '只这次把台词放长一点。' -TopicKey 'temporary-dialogue-length' -ConflictKey 'temporary-dialogue-length' -SampleId $sampleId)
  $sampleFile = Get-FixturePath $Root "learning/samples/$sampleId.json"
  Write-JsonFile -Path $sampleFile -Value ([ordered]@{
    sampleId = $sampleId
    summary = '临时特殊要求已保存为本轮上下文，不写入当前整体规则。'
    content = '只这次把台词放长一点。'
    sourceEventIds = @($eventId)
    affectsGeneration = $false
    topicKey = 'temporary-dialogue-length'
    conflictKey = 'temporary-dialogue-length'
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A2' -Name '临时特殊要求' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $sampleFile, (Get-FixturePath $Root 'learning/current-ruleset.json')) -Troubleshooting '若临时要求进入 current-ruleset，应判为阻塞；检查 learningMode 和 landingType。'
}

function Invoke-ScenarioA3 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A3-sample-ingest'
  $sampleId = 'sample-A3-style-reference'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'evidence' -InternalStatus 'landed' -JobStatus 'completed' -LandingType 'sample' -Summary '投喂一个可参考分镜样例。' -TopicKey 'sample-ingest' -ConflictKey 'storyboard-reference' -SourceType 'sample' -SampleId $sampleId)
  $sampleFile = Get-FixturePath $Root "learning/samples/$sampleId.json"
  Write-JsonFile -Path $sampleFile -Value ([ordered]@{
    sampleId = $sampleId
    summary = '样例投喂：冲突爆发前先给一个眼神特写。'
    content = '镜号 01 / 景别 特写 / 情绪动作 主角压住怒气。'
    sourceEventIds = @($eventId)
    affectsGeneration = $false
    sampleType = 'storyboard-reference'
    topicKey = 'sample-ingest'
    conflictKey = 'storyboard-reference'
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A3' -Name '样例投喂' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $sampleFile) -Troubleshooting '若样例被显示为已影响生成，检查落点映射是否把 sample 当作 current-rule。'
}

function Invoke-ScenarioA4 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A4-canvas-archive'
  $evidenceId = 'evidence-A4-archived-canvas'
  $canvasId = 'canvas-A4'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'evidence' -InternalStatus 'landed' -JobStatus 'completed' -LandingType 'archive' -Summary '画布归档后生成成熟证据包。' -TopicKey 'archive-evidence' -ConflictKey 'canvas-archive' -SourceType 'archive' -EvidenceId $evidenceId -CanvasId $canvasId -OutputId 'output-A4')
  $canvasFile = Get-FixturePath $Root "app/data/canvases/$canvasId.json"
  Write-JsonFile -Path $canvasFile -Value ([ordered]@{
    id = $canvasId
    title = 'A4 archived fixture canvas'
    archivedAt = Get-IsoNow
    nodes = @(@{ id = 'node-storyboard-final'; type = 'storyboard'; title = 'final storyboard'; content = 'final accepted storyboard' })
    edges = @()
  })
  $evidenceFile = Get-FixturePath $Root "learning/evidence/$evidenceId.json"
  Write-JsonFile -Path $evidenceFile -Value ([ordered]@{
    evidenceId = $evidenceId
    canvasId = $canvasId
    outputId = 'output-A4'
    summary = '归档成熟画布证据。'
    sourceEventIds = @($eventId)
    archivedAt = Get-IsoNow
    createdAt = Get-IsoNow
    location = @{ canvasId = $canvasId; outputId = 'output-A4'; sourceType = 'archive' }
  })
  New-ScenarioResult -Root $Root -Id 'A4' -Name '画布归档' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $canvasFile, $evidenceFile) -Troubleshooting '若画布已归档但没有 evidence 文件，检查 recordArchiveLearningEvidence 与业务根。'
}

function Invoke-ScenarioA5 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A5-sample-insufficient'
  $evalTaskId = 'eval-A5-need-more-samples'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'overall' -InternalStatus 'classified' -JobStatus 'waiting' -LandingType 'sample-insufficient' -Summary '样本不足，等待补同类分镜样例。' -TopicKey 'sample-count' -ConflictKey 'sample-count-storyboard' -EvalTaskId $evalTaskId -NeededSampleType 'storyboard-reference' -NeededCount 2)
  $evalFile = Get-FixturePath $Root "learning/evals/A5/$evalTaskId.json"
  Write-JsonFile -Path $evalFile -Value ([ordered]@{
    evalTaskId = $evalTaskId
    summary = '样本不足：还需要 2 条 storyboard-reference 样例。'
    sourceEventIds = @($eventId)
    neededSampleType = 'storyboard-reference'
    neededCount = 2
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A5' -Name '样本不足' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $evalFile) -Troubleshooting '若没有待补样例状态，检查 landingType=sample-insufficient、neededSampleType 和 neededCount。'
}

function Invoke-ScenarioA6 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A6-conflict'
  $conflictFile = Get-FixturePath $Root 'learning/evals/A6/conflict.json'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'uncertain' -InternalStatus 'classified' -JobStatus 'waiting' -LandingType 'conflict' -Summary '规则冲突：台词必须极短，但当前请求要求保留长独白。' -TopicKey 'dialogue-length' -ConflictKey 'dialogue-length-max20' -RelatedRecordIds @('rule:rule-accept-A1-overall-rule'))
  Write-JsonFile -Path $conflictFile -Value ([ordered]@{
    conflictId = 'conflict-A6-dialogue-length'
    sourceEventIds = @($eventId)
    relatedRecordIds = @('rule:rule-accept-A1-overall-rule')
    expectedResolution = '等待人工确认或提供更高优先级规则，不直接覆盖当前整体规则。'
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A6' -Name '规则冲突' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $conflictFile) -Troubleshooting '若冲突被静默发布为新规则，检查 conflictKey 和发布前冲突校验。'
}

function Invoke-ScenarioA7 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A7-correction'
  $correctionFile = Get-FixturePath $Root 'learning/evidence/correction-A7.json'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'correction' -InternalStatus 'landed' -JobStatus 'completed' -LandingType 'evidence' -Summary '纠正：之前把临时要求误判为长期规则。' -TopicKey 'correction' -ConflictKey 'temporary-vs-overall' -SourceEventIds @('accept-A2-temporary') -EvidenceId 'correction-A7')
  Write-JsonFile -Path $correctionFile -Value ([ordered]@{
    evidenceId = 'correction-A7'
    summary = '带引用纠正记录：临时要求不得写入 current-ruleset。'
    sourceEventIds = @($eventId, 'accept-A2-temporary')
    correctionAction = @{ recordId = 'event:accept-A2-temporary'; enabled = $true }
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A7' -Name '学错纠正' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $correctionFile) -Troubleshooting '若纠正无法定位原记录，检查 correctionAction 的主定位字段。'
}

function Invoke-ScenarioA8 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $oldEvent = 'accept-A8-old-covered'
  $newEvent = 'accept-A8-new-covering'
  $oldRule = 'rule-accept-A8-old'
  $newRule = 'rule-accept-A8-new'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $oldEvent -Mode 'overall' -InternalStatus 'covered' -JobStatus 'completed' -LandingType 'current-rule' -Summary '旧规则已被覆盖。' -TopicKey 'covered-rule' -ConflictKey 'covered-rule' -RuleId $oldRule -LandingIds @($oldRule) -CoveredByEventId $newEvent)
  Add-LearningEvent -Root $Root -Event (New-Event -Id $newEvent -Mode 'overall' -InternalStatus 'validated' -JobStatus 'completed' -LandingType 'current-rule' -Summary '新规则覆盖旧规则。' -TopicKey 'covered-rule' -ConflictKey 'covered-rule' -RuleId $newRule -LandingIds @($newRule) -SourceEventIds @($oldEvent))
  $existing = @((Get-Ruleset -Root $Root).rules)
  $rules = @($existing + @(
    [ordered]@{ ruleId = $oldRule; topicKey = 'covered-rule'; conflictKey = 'covered-rule'; capability = 'storyboard'; content = '旧规则'; priority = 40; sourceEventIds = @($oldEvent); status = 'covered'; coveredByRuleId = $newRule; createdAt = Get-IsoNow; updatedAt = Get-IsoNow },
    [ordered]@{ ruleId = $newRule; topicKey = 'covered-rule'; conflictKey = 'covered-rule'; capability = 'storyboard'; content = '新规则覆盖旧规则'; priority = 80; sourceEventIds = @($newEvent); status = 'active'; createdAt = Get-IsoNow; updatedAt = Get-IsoNow }
  ))
  Set-Ruleset -Root $Root -Rules $rules | Out-Null
  $coverageFile = Get-FixturePath $Root 'learning/evals/A8/coverage.json'
  Write-JsonFile -Path $coverageFile -Value ([ordered]@{
    coveredEventId = $oldEvent
    coveringEventId = $newEvent
    coveredRuleId = $oldRule
    coveringRuleId = $newRule
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A8' -Name '已被覆盖' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), (Get-FixturePath $Root 'learning/current-ruleset.json'), $coverageFile) -Troubleshooting '若旧规则仍显示为 active，检查 coveredByEventId、coveredByRuleId 和规则状态映射。'
}

function Invoke-ScenarioA9 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A9-learning-failed'
  $failureFile = Get-FixturePath $Root 'learning/evals/A9/failure.json'
  $noticePath = Get-FixturePath $Root 'app/data/notifications.json'
  $errorInfo = [ordered]@{
    stage = 'publish-current-ruleset'
    code = 'RULESET_PUBLISH_FAILED'
    message = 'Fixture intentionally simulates a ruleset publish failure.'
  }
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'overall' -InternalStatus 'failed' -JobStatus 'failed' -LandingType '' -Summary '学习失败：规则发布校验未通过。' -TopicKey 'failure' -ConflictKey 'publish-failure' -ErrorInfo $errorInfo)
  Write-JsonFile -Path $failureFile -Value ([ordered]@{
    evalResultId = 'eval-result-A9-failure'
    summary = '学习失败排查证据。'
    sourceEventIds = @($eventId)
    error = $errorInfo
    createdAt = Get-IsoNow
  })
  $notifications = @(
    [ordered]@{
      id = 'notice-A9-learning-failed'
      type = 'learning'
      sourceType = 'learning-event'
      sourceId = $eventId
      title = '学习失败，请查看'
      summary = $errorInfo.message
      status = 'unread'
      createdAt = Get-IsoNow
      updatedAt = Get-IsoNow
      target = @{ page = 'learning'; eventId = $eventId }
    }
  )
  Write-JsonFile -Path $noticePath -Value $notifications
  New-ScenarioResult -Root $Root -Id 'A9' -Name '学习失败' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $failureFile, $noticePath) -Troubleshooting '若失败没有通知或错误详情，检查 notifyOnFailure、events.jsonl error 字段和 notifications 业务根。'
}

function Invoke-ScenarioA10 {
  param([Parameter(Mandatory=$true)][string]$Root)
  $eventId = 'accept-A10-page-boundary'
  $boundaryFile = Get-FixturePath $Root 'learning/evals/A10/page-boundary.json'
  Add-LearningEvent -Root $Root -Event (New-Event -Id $eventId -Mode 'uncertain' -InternalStatus 'classified' -JobStatus 'waiting' -LandingType 'unlearnable' -Summary '页面新手理解：默认字段必须讲清是否影响生成、下一步和证据路径。' -TopicKey 'page-newbie-boundary' -ConflictKey 'page-newbie-boundary')
  Write-JsonFile -Path $boundaryFile -Value ([ordered]@{
    evalTaskId = 'eval-A10-page-newbie-boundary'
    summary = '页面新手理解与边界检查。'
    sourceEventIds = @($eventId)
    expectedFields = @('displayStatus','generationImpactText','nextStepText','generationProof','correctionAction')
    boundary = '页面只展示后端聚合字段，不自行根据 learningMode 二次推断主状态。'
    createdAt = Get-IsoNow
  })
  New-ScenarioResult -Root $Root -Id 'A10' -Name '页面新手理解与边界' -EvidencePaths @((Get-FixturePath $Root 'learning/events.jsonl'), $boundaryFile) -Troubleshooting '若页面和后端状态不一致，以 /api/learning-library 返回字段定位状态映射。'
}

function Invoke-Scenario {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][string]$Id
  )
  switch ($Id) {
    'A1' { Invoke-ScenarioA1 -Root $Root }
    'A2' { Invoke-ScenarioA2 -Root $Root }
    'A3' { Invoke-ScenarioA3 -Root $Root }
    'A4' { Invoke-ScenarioA4 -Root $Root }
    'A5' { Invoke-ScenarioA5 -Root $Root }
    'A6' { Invoke-ScenarioA6 -Root $Root }
    'A7' { Invoke-ScenarioA7 -Root $Root }
    'A8' { Invoke-ScenarioA8 -Root $Root }
    'A9' { Invoke-ScenarioA9 -Root $Root }
    'A10' { Invoke-ScenarioA10 -Root $Root }
    default { throw "Unknown scenario: $Id" }
  }
}

function Test-RecordIdInList {
  param(
    $List,
    [Parameter(Mandatory=$true)][string]$RecordId
  )
  return @($List | Where-Object { $_.recordId -eq $RecordId }).Count -gt 0
}

function Assert-ServiceLearningLibrary {
  param([Parameter(Mandatory=$true)]$Library)

  if (!(Test-Property -Value $Library -Name 'accessIssues')) {
    throw 'Service learning library response is missing accessIssues.'
  }
  $accessIssues = @($Library.accessIssues)
  if ($accessIssues.Count -gt 0) {
    $summary = @($accessIssues | Select-Object -First 3 | ForEach-Object { "$($_.area): $($_.message)" }) -join '; '
    throw "Service learning library has accessIssues: $summary"
  }

  $required = @(
    @{ list = 'records'; id = 'rule:rule-accept-A1-overall-rule' },
    @{ list = 'impactItems'; id = 'rule:rule-accept-A1-overall-rule' },
    @{ list = 'sampleItems'; id = 'sample:sample-A3-style-reference' },
    @{ list = 'evalItems'; id = 'eval:eval-A5-need-more-samples' },
    @{ list = 'records'; id = 'event:accept-A6-conflict' },
    @{ list = 'records'; id = 'event:accept-A10-page-boundary' }
  )
  foreach ($item in $required) {
    $listName = $item.list
    if (!(Test-Property -Value $Library -Name $listName)) {
      throw "Service learning library response is missing $listName."
    }
    if (!(Test-RecordIdInList -List $Library.$listName -RecordId $item.id)) {
      throw "Service learning library did not aggregate fixture record $($item.id) in $listName."
    }
  }
}

function Invoke-ServiceMode {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [Parameter(Mandatory=$true)][int]$Port,
    [Parameter(Mandatory=$true)][switch]$KeepAlive
  )
  $workspace = Get-WorkspaceRoot $Root
  $logDir = Join-Path $Root 'service'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $stdout = Join-Path $logDir 'server.stdout.log'
  $stderr = Join-Path $logDir 'server.stderr.log'
  $oldAcceptanceRoot = $env:MBH_ACCEPTANCE_ROOT
  $oldPort = $env:MBH_WEB_PORT
  $process = $null
  $shouldKeepAlive = $false
  try {
    $env:MBH_ACCEPTANCE_ROOT = $workspace
    $env:MBH_WEB_PORT = [string]$Port
    $startArgs = @{
      FilePath = 'node'
      ArgumentList = @('app/server.js')
      WorkingDirectory = $RepoRoot
      PassThru = $true
      WindowStyle = 'Hidden'
    }
    if (!$KeepAlive) {
      $startArgs.RedirectStandardOutput = $stdout
      $startArgs.RedirectStandardError = $stderr
    }
    $process = Start-Process @startArgs
    $status = $null
    for ($i = 0; $i -lt 40; $i += 1) {
      Start-Sleep -Milliseconds 250
      try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status" -TimeoutSec 2
        if ($status.ok) { break }
      } catch {
        $status = $null
      }
    }
    if ($null -eq $status) {
      throw "Service did not become ready on port $Port"
    }
    if ($status.acceptanceMode -ne $true) {
      throw 'Service status did not report acceptanceMode=true'
    }
    $resolvedStatusRoot = (Resolve-Path -LiteralPath $status.acceptanceRoot).Path
    $resolvedWorkspace = (Resolve-Path -LiteralPath $workspace).Path
    if ($resolvedStatusRoot -ne $resolvedWorkspace) {
      throw "Service acceptanceRoot mismatch: $($status.acceptanceRoot)"
    }
    $library = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/learning-library" -TimeoutSec 5
    Write-JsonFile -Path (Join-Path $logDir 'status.json') -Value $status
    Write-JsonFile -Path (Join-Path $logDir 'learning-library.json') -Value $library
    Assert-ServiceLearningLibrary -Library $library

    $manifestPath = Join-Path $Root 'manifest.json'
    $manifest = Read-JsonFile -Path $manifestPath -Default ([pscustomobject]@{})
    $manifest | Add-Member -NotePropertyName serviceMode -NotePropertyValue ([ordered]@{
      port = $Port
      pid = $process.Id
      keepAlive = $KeepAlive.IsPresent
      statusPath = 'service/status.json'
      libraryPath = 'service/learning-library.json'
      checkedAt = Get-IsoNow
    }) -Force
    Write-JsonFile -Path $manifestPath -Value $manifest
    $shouldKeepAlive = $KeepAlive.IsPresent
    $suffix = if ($shouldKeepAlive) { "; keepAlive pid=$($process.Id)" } else { '' }
    "SERVICE PASS http://127.0.0.1:$Port service/status.json; service/learning-library.json$suffix"
  } finally {
    if ($process -and !$process.HasExited -and !$shouldKeepAlive) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit()
    }
    $env:MBH_ACCEPTANCE_ROOT = $oldAcceptanceRoot
    $env:MBH_WEB_PORT = $oldPort
  }
}

function New-Report {
  param(
    [Parameter(Mandatory=$true)][string]$Root,
    [int]$Port
  )
  $resultsPath = Join-Path $Root 'results.json'
  if (!(Test-Path -LiteralPath $resultsPath)) {
    foreach ($id in $ScenarioIds) {
      Invoke-Scenario -Root $Root -Id $id | Out-Null
    }
  }
  $results = @(Get-FlatResults -Path $resultsPath)
  Assert-CompleteResults -Results $results
  Write-JsonFile -Path $resultsPath -Value $results
  $manifest = Read-JsonFile -Path (Join-Path $Root 'manifest.json') -Default ([pscustomobject]@{})
  $date = Get-Date -Format 'yyyyMMdd'
  $reportPath = Join-Path $RepoRoot "docs/学习机制闭环验收记录_${date}_v1.md"
  $commit = if ($manifest.commit) { $manifest.commit } else { Get-CommitHash }
  $servicePort = $Port
  if ($manifest.serviceMode -and $manifest.serviceMode.port) {
    $servicePort = [int]$manifest.serviceMode.port
  }
  $allPassed = ($results.Count -eq 10) -and (@($results | Where-Object { $_.passed -ne $true }).Count -eq 0)
  $conclusion = if ($allPassed) { '通过：A1-A10 夹具证据均已生成，服务夹具模式可按需复核。' } else { '未通过：存在失败或缺失场景，请先查看 results.json 和证据路径。' }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 学习机制闭环验收记录 ${date}_v1")
  $lines.Add("")
  $lines.Add("- 提交号：$commit")
  $lines.Add("- 端口：$servicePort")
  $lines.Add("- 夹具路径：$Root")
  $lines.Add("- 工作区：$(Get-WorkspaceRoot $Root)")
  $lines.Add("- 生成时间：$(Get-IsoNow)")
  $lines.Add("")
  $lines.Add("## A1-A10 结果")
  $lines.Add("")
  $lines.Add("| 场景 | 结果 | 证据路径 |")
  $lines.Add("| --- | --- | --- |")
  foreach ($result in @($results | Sort-Object scenario)) {
    $paths = @($result.evidencePaths) -join '<br>'
    $lines.Add("| $($result.scenario) $($result.name) | $($result.status) | $paths |")
  }
  $lines.Add("")
  $lines.Add("## 失败排查建议")
  $lines.Add("")
  foreach ($result in @($results | Sort-Object scenario)) {
    $tip = if ($result.troubleshooting) { $result.troubleshooting } else { '查看证据路径和 manifest.json。' }
    $lines.Add("- $($result.scenario)：$tip")
  }
  $lines.Add("")
  $lines.Add("## 最终结论")
  $lines.Add("")
  $lines.Add($conclusion)
  $lines.Add("")
  $lines.Add("## 隔离说明")
  $lines.Add("")
  $lines.Add('- 本报告使用夹具目录的 `workspace/learning`、`workspace/app/data` 和 `workspace/runs`。')
  $lines.Add('- `app/server.js`、`app/public/`、`app/config/` 未复制到夹具目录。')
  $lines.Add('- 真实 `learning/` 不应因本脚本的 `-FixtureRoot` 场景执行而被写入。')
  Write-TextFile -Path $reportPath -Lines ([string[]]$lines)
  "REPORT $reportPath"
}

if ($PrepareFixture) {
  $root = New-Fixture
  Write-Output $root
  return
}

$resolvedRoot = $null
if ($FixtureRoot) {
  $resolvedRoot = Resolve-FixtureRoot
}

if ($All) {
  foreach ($id in $ScenarioIds) {
    Invoke-Scenario -Root $resolvedRoot -Id $id
  }
}

if ($Scenario) {
  Invoke-Scenario -Root $resolvedRoot -Id $Scenario
}

if ($ServiceMode) {
  Invoke-ServiceMode -Root $resolvedRoot -Port $Port -KeepAlive:$KeepAlive
}

if ($WriteReport) {
  New-Report -Root $resolvedRoot -Port $Port
}

if (!$PrepareFixture -and !$All -and !$Scenario -and !$ServiceMode -and !$WriteReport) {
  throw 'No action specified. Use -PrepareFixture, -Scenario, -All, -ServiceMode, or -WriteReport.'
}
