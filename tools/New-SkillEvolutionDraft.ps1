param(
  [Parameter(Mandatory = $false)]
  [string]$Root = ".",

  [Parameter(Mandatory = $false)]
  [string]$SnapshotPath = "",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "learning/skill-evolution-reports",

  [Parameter(Mandatory = $false)]
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$rootPath = Resolve-Path -LiteralPath $Root
Push-Location $rootPath.Path
try {
  if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    $snapshots = @()
    if (Test-Path -LiteralPath "learning/snapshots") {
      $snapshots = @(Get-ChildItem -LiteralPath "learning/snapshots" -File -Filter "learning-snapshot-*.md" | Sort-Object Name -Descending)
    }
    if ($snapshots.Count -eq 0) {
      throw "未找到学习快照。请先运行 tools/New-LearningSnapshot.ps1。"
    }
    $snapshotFile = $snapshots[0]
  } else {
    $snapshotFile = Get-Item -LiteralPath $SnapshotPath
  }

  $outItem = if (Test-Path -LiteralPath $OutDir) {
    Get-Item -LiteralPath $OutDir
  } else {
    New-Item -ItemType Directory -Force -Path $OutDir
  }
  $outFullPath = $outItem.FullName

  $draftPath = Join-Path $outFullPath ("skill-evolution-draft-{0}.md" -f $Date)
  $draftMetadataPath = Join-Path $outFullPath ("skill-evolution-draft-{0}.json" -f $Date)
  if ((Test-Path -LiteralPath $draftPath) -and -not $Force) {
    throw "草案已存在：$draftPath。若要覆盖，请添加 -Force。"
  }
  if ((Test-Path -LiteralPath $draftMetadataPath) -and -not $Force) {
    throw "草案元数据已存在：$draftMetadataPath。若要覆盖，请添加 -Force。"
  }

  function Get-RelativePath {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $base = $rootPath.Path.TrimEnd('\') + '\'
    if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $full.Substring($base.Length).Replace('\', '/')
    }
    return $Path.Replace('\', '/')
  }

  function Get-StableIdFromFile {
    param([System.IO.FileInfo]$File)
    return ([System.IO.Path]::GetFileNameWithoutExtension($File.Name)).Trim()
  }

  $snapshotText = Get-Content -LiteralPath $snapshotFile.FullName -Encoding UTF8 -Raw
  $assetRows = @()
  $inAssets = $false
  $completedTasks = @()
  $inCompleted = $false
  foreach ($line in ($snapshotText -split "`r?`n")) {
    if ($line -match "^## 一、资产概览") {
      $inAssets = $true
      continue
    }
    if ($inAssets -and $line -match "^## ") {
      $inAssets = $false
    }
    if ($inAssets -and $line -match "^\| .+ \| [0-9]+ \|$") {
      $assetRows += $line.Trim()
    }

    if ($line -match "^## 三、已完成的新样例对齐任务") {
      $inCompleted = $true
      continue
    }
    if ($inCompleted -and $line -match "^## ") {
      break
    }
    if ($inCompleted -and $line.Trim().StartsWith("- ")) {
      $completedTasks += $line.Trim()
    }
  }

  $candidateFiles = @()
  if (Test-Path -LiteralPath "learning/candidate-rules") {
    $candidateFiles = @(Get-ChildItem -LiteralPath "learning/candidate-rules" -File | Where-Object { $_.BaseName -ne "README" } | Sort-Object Name)
  }
  $acceptedFiles = @()
  if (Test-Path -LiteralPath "learning/accepted-rules") {
    $acceptedFiles = @(Get-ChildItem -LiteralPath "learning/accepted-rules" -File | Where-Object { $_.BaseName -ne "README" } | Sort-Object Name)
  }
  $regressionFiles = @()
  if (Test-Path -LiteralPath "learning/regression-reports") {
    $regressionFiles = @(Get-ChildItem -LiteralPath "learning/regression-reports" -File | Where-Object { $_.BaseName -ne "README" } | Sort-Object Name)
  }
  $evalResultFiles = @()
  if (Test-Path -LiteralPath "learning/evals") {
    $evalResultFiles = @(Get-ChildItem -LiteralPath "learning/evals" -File | Where-Object { $_.BaseName -ne "README" } | Sort-Object Name)
  }
  $conversationFiles = @()
  if (Test-Path -LiteralPath "learning/conversation-records") {
    $conversationFiles = @(Get-ChildItem -LiteralPath "learning/conversation-records" -File | Where-Object { $_.BaseName -ne "README" } | Sort-Object Name)
  }
  $alignmentReviews = @()
  if (Test-Path -LiteralPath "runs") {
    $alignmentReviews = @(Get-ChildItem -LiteralPath "runs" -Recurse -File -Filter "alignment-review.md" | Sort-Object FullName)
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 技能进化草案")
  $lines.Add("")
  $lines.Add("生成日期：$Date")
  $lines.Add("")
  $lines.Add(("来源快照：``{0}``" -f (Get-RelativePath $snapshotFile.FullName)))
  $lines.Add("")
  $lines.Add("说明：本文件是待审草案，不等于正式修改。正式修改仍需读取原始证据，并按 `skill-evolution` 规则判断是否满足升级条件。")
  $lines.Add("边界：草案已保存，暂不影响生成；需要人工确认后才可发布，且发布失败必须保留旧 skill 和旧路由。")
  $lines.Add("")

  $lines.Add("## 一、证据摘要")
  $lines.Add("")
  $lines.Add("本轮快照显示：")
  $lines.Add("")
  foreach ($line in ($assetRows | Where-Object { $_ -match "运行目录|对齐复核报告|剧情覆盖核对|候选规则文件|已确认规则文件|对话学习记录" })) {
    $lines.Add("- $line")
  }
  $lines.Add("")

  $lines.Add("已完成的新样例对齐任务：")
  $lines.Add("")
  if ($completedTasks.Count -gt 0) {
    foreach ($task in $completedTasks) {
      $lines.Add($task)
    }
  } else {
    $lines.Add("- 暂无。")
  }
  $lines.Add("")

  $lines.Add("## 二、建议本轮不升级的题材规则")
  $lines.Add("")
  $lines.Add("| 规则方向 | 建议 | 理由 |")
  $lines.Add("| --- | --- | --- |")
  $lines.Add("| 经营逆袭镜头链 | 继续候选 | 八零第 2、3 集已复核，但均为部分对应，且来自同一部剧 |")
  $lines.Add("| 修仙 / 玄幻开篇和资源反转 | 继续候选 | 欧皇三集证据完整，但仍来自同一部修仙盲盒剧 |")
  $lines.Add("| 豪门替嫁 / 强女主反击 | 继续候选 | 司爷少奶奶是小说到分镜观察样例，缺少剧本中间稿 |")
  $lines.Add("| 身份反转 / 打脸 | 继续候选 | 当前主要来自第十七集，还缺其他身份反转样例 |")
  $lines.Add("")

  $lines.Add("## 二点五、降质风险")
  $lines.Add("")
  if ($regressionFiles.Count -gt 0) {
    $lines.Add("已发现降质和回退记录，本轮技能进化应优先复核：")
    $lines.Add("")
    foreach ($file in $regressionFiles) {
      $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
    }
  } else {
  $lines.Add("未发现降质和回退记录。")
  }
  $lines.Add("")

  $lines.Add("## 二点六、对话学习证据")
  $lines.Add("")
  if ($conversationFiles.Count -gt 0) {
    $lines.Add("已发现对话学习记录，技能进化时应先判断其属于偏好、反例、候选规则还是降质信号：")
    $lines.Add("")
    foreach ($file in ($conversationFiles | Sort-Object Name -Descending | Select-Object -First 10)) {
      $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
    }
  } else {
    $lines.Add("暂未发现对话学习记录。")
  }
  $lines.Add("")

  $lines.Add("## 三、建议保持或强化的基础规则")
  $lines.Add("")
  $lines.Add("| 基础规则 | 建议动作 | 证据 |")
  $lines.Add("| --- | --- | --- |")
  $lines.Add("| 部分对应样例只学习可靠片段 | 保持正式规则 | 八零正文对齐复核再次验证 |")
  $lines.Add("| 一部剧可一对多归拢 | 保持正式规则 | 八零、欧皇均成立 |")
  $lines.Add("| 历史分镜噪声必须修正 | 保持正式规则 | 欧皇第一集镜号重复，司爷少奶奶尾部乱码 |")
  $lines.Add("| 学习前先看快照 | 已接入 ``skill-evolution`` | 本轮已新增学习快照工具 |")
  $lines.Add("")

  $lines.Add("## 四、候选修改建议")
  $lines.Add("")
  $lines.Add("| 文件 | 建议 | 状态 |")
  $lines.Add("| --- | --- | --- |")
  $lines.Add("| ``skills/05-evolution/skill-evolution/SKILL.md`` | 已接入学习快照作为技能进化前置输入 | 已完成 |")
  $lines.Add("| ``skills/05-evolution/skill-evolution/references/技能进化规则.md`` | 已补充学习快照使用规则 | 已完成 |")
  $lines.Add("| ``tools/New-LearningSnapshot.ps1`` | 作为 M5 学习闭环索引工具保留 | 已完成 |")
  $lines.Add("| 题材专属正式规则 | 暂不修改 | 继续观察 |")
  $lines.Add("")

  $lines.Add("## 五、证据入口")
  $lines.Add("")
  $lines.Add("对齐复核报告：")
  $lines.Add("")
  foreach ($file in $alignmentReviews) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($alignmentReviews.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")
  $lines.Add("候选规则文件：")
  $lines.Add("")
  foreach ($file in $candidateFiles) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($candidateFiles.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")
  $lines.Add("已确认规则文件：")
  $lines.Add("")
  foreach ($file in $acceptedFiles) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($acceptedFiles.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")
  $lines.Add("降质和回退记录：")
  $lines.Add("")
  foreach ($file in $regressionFiles) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($regressionFiles.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")
  $lines.Add("对话学习记录：")
  $lines.Add("")
  foreach ($file in ($conversationFiles | Sort-Object Name -Descending | Select-Object -First 10)) {
    $lines.Add(("- ``{0}``" -f (Get-RelativePath $file.FullName)))
  }
  if ($conversationFiles.Count -eq 0) { $lines.Add("- 暂无。") }
  $lines.Add("")

  $lines.Add("## 六、结论")
  $lines.Add("")
  $lines.Add("本轮建议：")
  $lines.Add("")
  $lines.Add("- 不升级新的题材专属正式规则。")
  $lines.Add("- 如存在降质记录，先处理降质和回退风险，再继续学习。")
  $lines.Add("- 保持已确认的跨题材基础规则。")
  $lines.Add("- 将学习快照作为后续技能进化的固定前置输入。")
  $lines.Add("- 继续等待跨剧目题材样例补证据。")
  $lines.Add("")

  Set-Content -LiteralPath $draftPath -Encoding UTF8 -Value ($lines -join "`r`n")

  $relatedRuleIds = @($candidateFiles + $acceptedFiles | ForEach-Object { Get-StableIdFromFile $_ } | Where-Object { $_ } | Sort-Object -Unique)
  $relatedEvalResultIds = @($evalResultFiles | ForEach-Object { Get-StableIdFromFile $_ } | Where-Object { $_ } | Sort-Object -Unique)
  $sourceEventIds = @($conversationFiles | ForEach-Object { Get-StableIdFromFile $_ } | Where-Object { $_ } | Sort-Object -Unique)
  $diffSummary = "Draft only: generated metadata and markdown summary for human review; no official skill files, skill-index, or generation routes are changed."

  $metadata = [ordered]@{
    schemaVersion = 1
    draftId = ("skill-evolution-draft-{0}" -f $Date)
    skillId = "skill-evolution"
    draftMarkdownPath = (Get-RelativePath $draftPath)
    draftMetadataPath = (Get-RelativePath $draftMetadataPath)
    snapshotPath = (Get-RelativePath $snapshotFile.FullName)
    relatedRuleIds = $relatedRuleIds
    relatedEvalResultIds = $relatedEvalResultIds
    sourceEventIds = $sourceEventIds
    diffSummary = $diffSummary
    humanConfirmationStatus = "pending"
    publishAllowed = $false
    affectsGeneration = $false
    publishBoundary = "Pending draft only. Do not write official skills/ or learning/skill-index.json before explicit human confirmation."
    generatedAt = (Get-Date).ToString("o")
  }
  $metadataJson = $metadata | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($draftMetadataPath, $metadataJson, [System.Text.UTF8Encoding]::new($false))

  [pscustomobject]@{
    DraftPath = $draftPath
    JsonPath = $draftMetadataPath
    SnapshotPath = $snapshotFile.FullName
    AlignmentReviewCount = $alignmentReviews.Count
    CandidateRuleFileCount = $candidateFiles.Count
    AcceptedRuleFileCount = $acceptedFiles.Count
    EvalResultFileCount = $evalResultFiles.Count
    RegressionReportCount = $regressionFiles.Count
    ConversationRecordCount = $conversationFiles.Count
    HumanConfirmationStatus = "pending"
    PublishAllowed = $false
    AffectsGeneration = $false
  }
} finally {
  Pop-Location
}




