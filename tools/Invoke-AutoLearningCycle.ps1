param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
$toolsPath = Join-Path $rootPath.Path "tools"

$inbox = & (Join-Path $toolsPath "New-InboxScanReport.ps1") -Root (Join-Path $rootPath.Path "samples") -OutDir (Join-Path $rootPath.Path "samples/_reports") -Date $Date -Force:$Force
$taskDraft = & (Join-Path $toolsPath "New-M4TaskDraft.ps1") -Root $rootPath.Path -Date $Date -Force:$Force
$conversationCandidates = & (Join-Path $toolsPath "New-CandidateRulesFromConversation.ps1") -Root $rootPath.Path -Date $Date -Force:$Force
$regressionTask = & (Join-Path $toolsPath "New-RegressionEvalTask.ps1") -Root $rootPath.Path -Date $Date -Force:$Force
$snapshot = & (Join-Path $toolsPath "New-LearningSnapshot.ps1") -Root $rootPath.Path -OutDir (Join-Path $rootPath.Path "learning/snapshots") -Date $Date -Force:$Force
$skillCreatorTask = & (Join-Path $toolsPath "New-SkillCreatorTask.ps1") -Root $rootPath.Path -Date $Date -Force:$Force
$regressionCount = 0
$regressionDir = Join-Path $rootPath.Path "learning/regression-reports"
if (Test-Path -LiteralPath $regressionDir) {
  $regressionCount = @(Get-ChildItem -LiteralPath $regressionDir -File | Where-Object { $_.Name -ne "README.md" }).Count
}
$conversationRecordCount = 0
$conversationRecordDir = Join-Path $rootPath.Path "learning/conversation-records"
if (Test-Path -LiteralPath $conversationRecordDir) {
  $conversationRecordCount = @(Get-ChildItem -LiteralPath $conversationRecordDir -File | Where-Object { $_.Name -ne "README.md" }).Count
}

[pscustomobject]@{
  Date = $Date
  InboxReport = $inbox.ReportPath
  M4TaskDraft = $taskDraft.DraftPath
  ConversationCandidateDraft = $conversationCandidates.DraftPath
  RegressionEvalTask = $regressionTask.TaskPath
  RegressionEvalTasks = @($regressionTask.Tasks)
  LearningSnapshot = $snapshot.ReportPath
  SkillCreatorTask = $skillCreatorTask.TaskPath
  TaskCount = $taskDraft.TaskCount
  HighPriorityTaskCount = $taskDraft.HighPriorityCount
  ConversationCandidateCount = $conversationCandidates.CandidateCount
  RegressionTaskCount = $regressionTask.TaskCount
  RegressionReportCount = $regressionCount
  ConversationRecordCount = $conversationRecordCount
}




