# Learning Mechanism Closed Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地第一阶段“整体学习”闭环，让客户在学习资料库里看懂系统学到了什么、是否影响生成、下一步做什么，以及学错后如何纠正。

**Architecture:** 采用文件型存储和后端统一语义层：学习入口先写事件账本，落点映射服务统一计算用户可见状态，当前整体规则只承接可发布规则，学习资料库 API 返回默认视图和高级详情，前端只渲染后端语义。验收脚本使用隔离夹具复现场景，不污染真实 `learning/`、`app/data/` 和 `skills/`。

**Tech Stack:** Node.js CommonJS、`node:test`、PowerShell、静态 HTML/CSS/JS、JSON/JSONL 文件存储。

---

## 执行边界

第一阶段只做整体学习，不做窗口、项目、画布多层隔离。`projectId`、`canvasId`、`conversationId` 只作为来源证据和纠错上下文。

第一阶段所有学习相关展示都集中在学习资料库。对话、画布、生成结果和设置页只允许出现轻提示、触发入口或跳转入口。

第一阶段不自动改正式 skill。技能草案和正式 skill 发布属于第二阶段 D9，当前只保留证据、草案入口和人工确认闸门。

第一阶段正式验收必须包含 D10 夹具和 A1-A10 可执行场景。D10 未实现时只能出具“人工预验”或“部分通过”。

## 当前代码基线

- `app/lib/autonomousLearning.js` 已有事件追加、当前规则写入和覆盖逻辑，但事件字段不足，且仍使用旧用户状态 `已生效`。
- `app/lib/learningLibrary.js` 已聚合 `records/currentRules/skills`，但缺少 `displayStatus`、`actionLabel`、`affectsGeneration`、`generationProof`、默认视图和高级详情分层。
- `app/public/index.html` 和 `app/public/app.js` 已有学习资料库弹窗，但仍解释“当前规则层”“已生效”等旧概念，前端仍按旧字段渲染。
- `app/server.js` 已有 `/api/learning-library`、`/api/learning-rules/status` 和显式学习流程，但没有验收夹具模式、纠错提交接口和生成命中证据闭环。
- `tools/Invoke-AutoLearningCycle.ps1`、`tools/New-RegressionEvalTask.ps1` 已有学习辅助脚本雏形，但没有 D10 统一验收入口。

## 文件结构

### 新建文件

- `app/lib/learningContracts.js`：学习状态、落点、动作标签、纠错字段、`generationProof` 的常量和校验函数。
- `app/lib/learningContracts.test.js`：状态组合、纠错字段和 proof 组合的单元测试。
- `app/lib/learningStatusMapper.js`：根据事件、落点、规则、评测和失败信息计算用户默认视图字段。
- `app/lib/learningStatusMapper.test.js`：五种主状态、动作标签、影响生成、proofStatus 的映射测试。
- `app/lib/currentRulesetContext.js`：生成链路读取当前整体规则、记录 `currentRulesUsed` 和 last-good 回退的上下文构建。
- `app/lib/currentRulesetContext.test.js`：规则读取、坏规则回退、命中证据和硬规则校验测试。
- `app/lib/learningEvidence.js`：样例、证据包、归档证据和评测样本池的文件写入与索引。
- `app/lib/learningEvidence.test.js`：样例只保存、归档证据包、来源追溯和失败兜底测试。
- `app/lib/learningCorrection.js`：带引用纠错 payload、默认话术、`correctionEvent` 写入和无法定位兜底。
- `app/lib/learningCorrection.test.js`：主定位字段、辅助上下文字段、禁用原因和纠错事件测试。
- `tools/Invoke-LearningAcceptance.ps1`：D10 验收夹具、服务夹具模式、A1-A10 场景和报告输出入口。

### 重点修改文件

- `app/lib/autonomousLearning.js`：保留编排职责，接入事件字段、发布校验、快照、last-good、失败回流和覆盖关系。
- `app/lib/conversationLearning.js`：把对话学习分类结果转为统一事件输入，保留纯用户指令字段可为空的规则。
- `app/lib/learningLibrary.js`：从原始事件聚合为学习资料库默认视图和高级详情。
- `app/lib/canvasArchive.js`：归档成功后生成证据包，不只做画布冻结。
- `app/lib/storyboardValidation.js`：承接第一批硬规则校验器，至少覆盖“分镜台词每句 20 字以内”。
- `app/server.js`：接入 acceptance root、`/api/status`、纠错接口、学习资料库 API 契约和生成命中证据。
- `app/public/index.html`：学习资料库说明、状态说明、动作入口和旧术语迁移。
- `app/public/app.js`：只渲染后端返回字段，新增高级详情折叠和带引用去纠正入口。
- `app/public/styles.css`：学习资料库默认视图、动作标签、proof 文案、空状态和错误状态样式。
- `app/server-static.test.js`、`app/public/app-static.test.js`、`app/lib/learningLibrary.test.js`、`app/lib/autonomousLearning.test.js`：同步更新测试。

## 统一数据契约

### 原始学习事件

事件结构必须保留这些字段键；入口拿不到值时使用空数组或空字符串，D7 聚合时仍可用 `eventId` 生成稳定 `recordId`。

```json
{
  "eventId": "event-a1",
  "sourceEventIds": [],
  "landingIds": [],
  "outputId": "",
  "projectId": "",
  "canvasId": "",
  "conversationId": "chat-a1",
  "topicKey": "storyboard.dialogue.length",
  "conflictKey": "storyboard.dialogue.length",
  "learningMode": "overall",
  "internalStatus": "landed",
  "jobStatus": "completed",
  "sourceType": "conversation",
  "summary": "分镜台词每句 20 字以内",
  "rawTrigger": "以后分镜台词每句 20 字以内",
  "landingType": "current-rule",
  "createdAt": "2026-07-04T00:00:00.000Z",
  "updatedAt": "2026-07-04T00:00:00.000Z"
}
```

### 学习资料库默认记录

```json
{
  "recordId": "rule:rule-event-a1",
  "displayStatus": "已影响生成",
  "actionLabel": "不用管",
  "affectsGeneration": true,
  "generationImpactText": "会影响后续整体生成。",
  "learnedText": "分镜台词每句 20 字以内",
  "sourceText": "来自对话 chat-a1",
  "usedWhereText": "当前整体规则",
  "nextStepText": "系统已处理完成；如果学错可带引用去纠正。",
  "generationProof": {
    "proofStatus": "pending_first_hit",
    "claimText": "已进入影响生成层，等待后续生成命中证据。",
    "currentRulesUsedRefs": [],
    "validationResultRefs": [],
    "lastCheckedOutputId": "",
    "lastCheckedAt": "",
    "failureEventIds": []
  },
  "correctionAction": {
    "enabled": true,
    "disabledReason": "",
    "payload": {
      "recordId": "rule:rule-event-a1",
      "eventId": "event-a1",
      "sourceEventIds": ["event-a1"],
      "landingIds": ["rule-event-a1"],
      "outputId": "",
      "projectId": "",
      "canvasId": "",
      "conversationId": "chat-a1",
      "topicKey": "storyboard.dialogue.length",
      "conflictKey": "storyboard.dialogue.length",
      "learningMode": "overall"
    },
    "suggestedTexts": [
      "这条学错了，请按这次说明覆盖。",
      "这条只适用于这次，不要作为长期规则。",
      "这条先停用，后续我再补说明。"
    ]
  },
  "advanced": {
    "eventId": "event-a1",
    "landingType": "current-rule",
    "ruleId": "rule-event-a1",
    "topicKey": "storyboard.dialogue.length"
  }
}
```

## Task 1: D1 学习事件账本与字段契约

**Files:**
- Create: `app/lib/learningContracts.js`
- Create: `app/lib/learningContracts.test.js`
- Modify: `app/lib/autonomousLearning.js`
- Modify: `app/lib/conversationLearning.js`
- Modify: `app/lib/autonomousLearning.test.js`

- [ ] **Step 1: 写契约测试，固定事件字段键**

在 `app/lib/learningContracts.test.js` 增加测试，断言纯用户指令允许 `sourceEventIds/outputId` 为空，但字段键必须存在。

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { normalizeLearningEvent } = require("./learningContracts");

test("normalizeLearningEvent keeps required locator keys even when values are empty", () => {
  const event = normalizeLearningEvent({
    eventId: "event-a",
    summary: "分镜台词每句 20 字以内",
    rawTrigger: "以后分镜台词每句 20 字以内",
    learningMode: "overall",
    conversationId: "chat-a",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  });

  assert.deepEqual(event.sourceEventIds, []);
  assert.deepEqual(event.landingIds, []);
  assert.equal(event.outputId, "");
  assert.equal(event.projectId, "");
  assert.equal(event.canvasId, "");
  assert.equal(event.conversationId, "chat-a");
  assert.equal(event.learningMode, "overall");
  assert.equal(event.internalStatus, "received");
  assert.equal(event.jobStatus, "queued");
});
```

- [ ] **Step 2: 实现 `learningContracts.js` 最小契约**

实现常量和 `normalizeLearningEvent`。允许旧事件读取时兼容 `status`，但新事件不得把 `已保存 / 已影响生成 / 待确认` 写入原始事件作为主状态。

```js
const USER_DISPLAY_STATUSES = new Set(["已保存", "已影响生成", "待确认", "失败", "已被覆盖"]);
const LEARNING_MODES = new Set(["overall", "temporary", "evidence", "uncertain", "correction"]);
const INTERNAL_STATUSES = new Set(["received", "classified", "landed", "validated", "failed", "covered"]);
const JOB_STATUSES = new Set(["queued", "running", "completed", "failed", "waiting"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeLearningEvent(input = {}) {
  const eventId = normalizeString(input.eventId);
  if (!eventId) throw new Error("learning event requires eventId");
  return {
    eventId,
    sourceEventIds: normalizeStringArray(input.sourceEventIds),
    landingIds: normalizeStringArray(input.landingIds),
    outputId: normalizeString(input.outputId),
    projectId: normalizeString(input.projectId),
    canvasId: normalizeString(input.canvasId),
    conversationId: normalizeString(input.conversationId),
    topicKey: normalizeString(input.topicKey) || "general",
    conflictKey: normalizeString(input.conflictKey) || normalizeString(input.topicKey) || "general",
    learningMode: LEARNING_MODES.has(input.learningMode) ? input.learningMode : "uncertain",
    internalStatus: INTERNAL_STATUSES.has(input.internalStatus) ? input.internalStatus : "received",
    jobStatus: JOB_STATUSES.has(input.jobStatus) ? input.jobStatus : "queued",
    sourceType: normalizeString(input.sourceType),
    summary: normalizeString(input.summary),
    rawTrigger: normalizeString(input.rawTrigger),
    capability: normalizeString(input.capability),
    landingType: normalizeString(input.landingType),
    ruleId: normalizeString(input.ruleId),
    coveredByEventId: normalizeString(input.coveredByEventId),
    error: input.error && typeof input.error === "object" ? input.error : null,
    createdAt: normalizeString(input.createdAt || input.updatedAt || new Date().toISOString()),
    updatedAt: normalizeString(input.updatedAt || input.createdAt || new Date().toISOString()),
  };
}

module.exports = {
  JOB_STATUSES,
  INTERNAL_STATUSES,
  LEARNING_MODES,
  USER_DISPLAY_STATUSES,
  normalizeLearningEvent,
};
```

- [ ] **Step 3: 接入事件写入和读取**

在 `app/lib/autonomousLearning.js` 中用 `normalizeLearningEvent` 替换旧 `normalizeEvent` 的核心字段；保留旧 JSONL 兼容读取。新写入事件使用 `internalStatus/jobStatus/learningMode/landingType`，旧 `status` 只作为迁移输入。

- [ ] **Step 4: 更新显式学习测试**

把 `app/lib/autonomousLearning.test.js` 中对 `result.event.status === "已生效"` 的断言改为：

```js
assert.equal(result.event.learningMode, "overall");
assert.equal(result.event.internalStatus, "landed");
assert.equal(result.event.jobStatus, "completed");
assert.equal(result.event.landingType, "current-rule");
```

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test app/lib/learningContracts.test.js app/lib/autonomousLearning.test.js
```

Expected: 两个测试文件通过；如果旧数据兼容失败，错误应指向缺失字段或旧状态迁移。

- [ ] **Step 6: Commit**

```powershell
git add app/lib/learningContracts.js app/lib/learningContracts.test.js app/lib/autonomousLearning.js app/lib/conversationLearning.js app/lib/autonomousLearning.test.js
git commit -m "feat: normalize learning event ledger"
```

## Task 2: D2 落点映射服务

**Files:**
- Create: `app/lib/learningStatusMapper.js`
- Create: `app/lib/learningStatusMapper.test.js`
- Modify: `app/lib/learningContracts.js`
- Modify: `app/lib/learningLibrary.js`
- Modify: `app/lib/learningLibrary.test.js`

- [ ] **Step 1: 写五种主状态映射测试**

覆盖样例、证据、当前整体规则、样本不足、失败、覆盖六类输入，保证主状态只有 `已保存 / 已影响生成 / 待确认 / 失败 / 已被覆盖`。

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const { mapLearningDisplayRecord } = require("./learningStatusMapper");

test("sample landing is saved and does not affect generation", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-sample",
    landingType: "sample",
    learningMode: "evidence",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "满意样例",
  });

  assert.equal(record.displayStatus, "已保存");
  assert.equal(record.actionLabel, "不用管");
  assert.equal(record.affectsGeneration, false);
  assert.equal(record.generationProof.proofStatus, "not_applicable");
});

test("current rule landing affects generation but can be pending first hit", () => {
  const record = mapLearningDisplayRecord({
    eventId: "event-rule",
    ruleId: "rule-event-rule",
    landingType: "current-rule",
    learningMode: "overall",
    internalStatus: "landed",
    jobStatus: "completed",
    summary: "分镜台词每句 20 字以内",
  });

  assert.equal(record.displayStatus, "已影响生成");
  assert.equal(record.affectsGeneration, true);
  assert.equal(record.generationProof.proofStatus, "pending_first_hit");
});
```

- [ ] **Step 2: 实现映射函数**

`mapLearningDisplayRecord(event, context)` 必须返回默认视图字段，不返回内部 token、失败堆栈或 `topicKey` 到默认层。`topicKey` 只放入 `advanced` 和纠错 payload。

- [ ] **Step 3: 校验 proof 组合**

在 `learningContracts.js` 增加 `validateGenerationProofCombination({ displayStatus, affectsGeneration, proofStatus })`。规则：

- `not_applicable` 不能搭配 `affectsGeneration=true`。
- `pending_first_hit`、`participated`、`validated` 必须搭配 `displayStatus=已影响生成` 和 `affectsGeneration=true`。
- `failed` 不能显示为正常 `已影响生成`。
- `unknown` 不能作为正式通过证据；如果 `affectsGeneration=true`，`claimText` 必须说明“当前仍会影响生成，证据不完整需排查”或等价新手可读表达。

- [ ] **Step 4: 学习资料库改用后端映射**

`buildLearningLibrary(root)` 的 `records` 使用 `mapLearningDisplayRecord`，保留旧字段到 `advanced`。前端后续不再依据 `status/learningMode/landingIds` 推导状态。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test app/lib/learningContracts.test.js app/lib/learningStatusMapper.test.js app/lib/learningLibrary.test.js
```

Expected: 五种主状态、动作标签、影响生成和 proof 组合全部通过。

- [ ] **Step 6: Commit**

```powershell
git add app/lib/learningContracts.js app/lib/learningContracts.test.js app/lib/learningStatusMapper.js app/lib/learningStatusMapper.test.js app/lib/learningLibrary.js app/lib/learningLibrary.test.js
git commit -m "feat: map learning records for library display"
```

## Task 3: D3 当前整体规则发布、快照和 last-good

**Files:**
- Create: `app/lib/currentRulesetContext.js`
- Create: `app/lib/currentRulesetContext.test.js`
- Modify: `app/lib/autonomousLearning.js`
- Modify: `app/server.js`
- Modify: `app/lib/autonomousLearning.test.js`

- [ ] **Step 1: 写快照和回退测试**

测试发布成功时写 `learning/ruleset-history/v<version>.json`，坏规则发布失败时不推进 `lastGoodVersion`。

- [ ] **Step 2: 发布前校验**

`learnExplicitRule` 写当前整体规则前必须校验：

- `learningMode === "overall"`。
- `summary/content` 非空。
- `conflictKey` 非空。
- 同一 `conflictKey` 只有一个 active 规则。
- `expectedVersion` 不落后；落后时旧任务失去发布权并进入 `已被覆盖` 或 `失败`。

- [ ] **Step 3: 写 ruleset 快照**

发布成功后创建 `learning/ruleset-history/v<version>.json`。快照结构包含 `version`、`lastGoodVersion`、`createdAt`、`sourceEventIds`、`rules`。

- [ ] **Step 4: 生成链路读取上下文**

`currentRulesetContext.js` 暴露：

```js
async function buildCurrentRulesetContext(root, input = {}) {
  return {
    ok: true,
    rules: [],
    promptText: "",
    currentRulesUsed: [],
    loadError: null,
  };
}
```

实现时只返回 active 规则；坏规则文件读取失败时尝试 `lastGoodVersion` 快照，并把错误写入学习失败记录或返回 `loadError` 供调用方回流。

- [ ] **Step 5: 在生成入口记录命中证据**

在 `app/server.js` 的分镜和对话生成入口接入 `buildCurrentRulesetContext`。生成记录或响应元数据必须包含 `currentRulesUsed` 或等价字段，供学习资料库高级详情和验收 A1 追溯。

- [ ] **Step 6: 运行测试**

Run:

```powershell
node --test app/lib/autonomousLearning.test.js app/lib/currentRulesetContext.test.js app/server-static.test.js
```

Expected: 规则发布、覆盖、失败、last-good 回退、生成上下文读取全部通过。

- [ ] **Step 7: Commit**

```powershell
git add app/lib/currentRulesetContext.js app/lib/currentRulesetContext.test.js app/lib/autonomousLearning.js app/server.js app/lib/autonomousLearning.test.js app/server-static.test.js
git commit -m "feat: publish learning rules with last good rollback"
```

## Task 4: D4 样例、证据包和归档回流

**Files:**
- Create: `app/lib/learningEvidence.js`
- Create: `app/lib/learningEvidence.test.js`
- Modify: `app/lib/canvasArchive.js`
- Modify: `app/server.js`
- Modify: `app/lib/learningLibrary.js`
- Modify: `app/lib/learningLibrary.test.js`

- [ ] **Step 1: 写证据包测试**

测试归档画布时能生成 `learning/evidence/<evidenceId>.json`，并包含 `canvasId`、最终节点、版本、采纳信号和 `sourceEventIds`。

- [ ] **Step 2: 实现证据写入**

`learningEvidence.js` 暴露：

```js
async function writeLearningEvidence(root, input = {}) {
  return {
    evidenceId: "",
    path: "",
    sourceEventIds: [],
    canvasId: "",
    outputId: "",
  };
}

async function writeLearningSample(root, input = {}) {
  return {
    sampleId: "",
    path: "",
    sourceEventIds: [],
  };
}
```

返回值必须带可追溯 ID，供 D7 生成 `recordId=evidence:<evidenceId>` 或 `sample:<sampleId>`。

- [ ] **Step 3: 接入画布归档**

归档成功后调用 `writeLearningEvidence`。证据包失败不得撤销画布归档；学习资料库显示失败记录并说明“画布已归档，学习证据生成失败”。

- [ ] **Step 4: 学习资料库聚合证据**

`buildLearningLibrary` 读取 `learning/evidence/`、`learning/samples/`，生成 `已保存` 记录，`affectsGeneration=false`，`generationProof.proofStatus=not_applicable`。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test app/lib/learningEvidence.test.js app/lib/learningLibrary.test.js app/server-static.test.js
```

Expected: 样例和证据包不会显示为 `已影响生成`，来源可追溯。

- [ ] **Step 6: Commit**

```powershell
git add app/lib/learningEvidence.js app/lib/learningEvidence.test.js app/lib/canvasArchive.js app/server.js app/lib/learningLibrary.js app/lib/learningLibrary.test.js app/server-static.test.js
git commit -m "feat: save learning evidence from samples and archives"
```

## Task 5: D5 评测、硬规则校验和重评测

**Files:**
- Modify: `app/lib/storyboardValidation.js`
- Modify: `app/lib/storyboardValidation.test.js`
- Modify: `app/lib/autonomousLearning.js`
- Modify: `app/lib/learningLibrary.js`
- Modify: `tools/New-RegressionEvalTask.ps1`
- Modify: `tools/Invoke-AutoLearningCycle.ps1`
- Modify: `app/lib/autonomousLearning.test.js`

- [ ] **Step 1: 写样本不足测试**

构造需要 L1 评测但样例不足的候选规则，期望学习资料库记录为 `待确认 / 待补样例`，并生成 `neededSampleType` 和 `neededCount`。

- [ ] **Step 2: 硬规则校验器登记**

第一批硬规则只覆盖程序能判断的规则。`storyboardValidation.js` 中已有台词长度校验，D5 只把它接入规则命中后的输出后校验，不扩大到不可程序判断的风格偏好。

- [ ] **Step 3: 输出违反硬规则时回流**

生成结果违反已影响生成的硬规则时：

1. 自动修正或重试一次。
2. 仍失败时写学习失败事件。
3. 学习资料库显示 `失败` 或 `待确认 / 待纠正`。
4. 不得把违规输出静默当成功交付。

- [ ] **Step 4: 补样例后重评测**

样例或证据包新增后，查找相关 `topicKey/conflictKey` 的待补样例任务，满足数量后重新生成评测任务或更新评测结果。

- [ ] **Step 5: 工具脚本扩展**

`New-RegressionEvalTask.ps1` 输出的任务必须包含：

- `neededSampleType`
- `neededCount`
- `relatedRecordIds`
- `sourceEventIds`
- `status`

- [ ] **Step 6: 运行测试**

Run:

```powershell
node --test app/lib/storyboardValidation.test.js app/lib/autonomousLearning.test.js app/lib/learningLibrary.test.js
powershell -NoProfile -ExecutionPolicy Bypass -File tools/New-RegressionEvalTask.ps1 -Root . -Date 2026-07-04 -Force
```

Expected: 单元测试通过；脚本生成评测任务，且包含待补样例字段。

- [ ] **Step 7: Commit**

```powershell
git add app/lib/storyboardValidation.js app/lib/storyboardValidation.test.js app/lib/autonomousLearning.js app/lib/learningLibrary.js app/lib/autonomousLearning.test.js tools/New-RegressionEvalTask.ps1 tools/Invoke-AutoLearningCycle.ps1
git commit -m "feat: close evaluation loop for learning rules"
```

## Task 6: D6 带引用去纠正

**Files:**
- Create: `app/lib/learningCorrection.js`
- Create: `app/lib/learningCorrection.test.js`
- Modify: `app/lib/learningLibrary.js`
- Modify: `app/server.js`
- Modify: `app/public/app.js`
- Modify: `app/public/app-static.test.js`

- [ ] **Step 1: 写纠错 payload 测试**

测试任一主定位字段非空时启用纠错；只有辅助上下文字段时禁用并给出 `disabledReason`。

主定位字段：

- `recordId`
- `eventId`
- `sourceEventIds`
- `landingIds`
- `outputId`

辅助上下文字段：

- `projectId`
- `canvasId`
- `conversationId`
- `topicKey`
- `conflictKey`
- `learningMode`

- [ ] **Step 2: 实现默认话术**

`learningCorrection.js` 按场景返回固定话术：

- `这条学错了，请按这次说明覆盖。`
- `这条只适用于这次，不要作为长期规则。`
- `这条先停用，后续我再补说明。`
- `这条范围太大，请收窄成我这次说的范围。`

- [ ] **Step 3: 增加纠错提交 API**

`app/server.js` 增加 `POST /api/learning-corrections`，写入 `correctionEvent`。无法定位关联对象时，不覆盖规则，返回 `displayStatus=待确认`、`actionLabel=待纠正`。

- [ ] **Step 4: 前端入口**

学习资料库记录展示“带引用去纠正”。点击后回到对话输入框，自动填入话术和引用摘要；用户发送后调用纠错 API 或普通对话学习入口，并刷新学习资料库。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test app/lib/learningCorrection.test.js app/lib/learningLibrary.test.js app/server-static.test.js app/public/app-static.test.js
```

Expected: 纠错按钮启用/禁用、payload、话术、接口和前端入口都可验证。

- [ ] **Step 6: Commit**

```powershell
git add app/lib/learningCorrection.js app/lib/learningCorrection.test.js app/lib/learningLibrary.js app/server.js app/public/app.js app/public/app-static.test.js
git commit -m "feat: add referenced correction flow"
```

## Task 7: D7 学习资料库后端查询契约

**Files:**
- Modify: `app/lib/learningLibrary.js`
- Modify: `app/lib/learningLibrary.test.js`
- Modify: `app/server.js`
- Modify: `app/server-static.test.js`

- [ ] **Step 1: 固定 API 响应结构**

`GET /api/learning-library` 返回：

```json
{
  "records": [],
  "impactItems": [],
  "sampleItems": [],
  "evalItems": [],
  "skillItems": [],
  "accessIssues": []
}
```

`records` 是默认列表；其他数组用于学习资料库内部筛选和详情，不代表其他页面可以直接展示学习详情。

- [ ] **Step 2: recordId 生成规则**

D7 统一生成稳定 `recordId`：

- `rule:<ruleId>`
- `sample:<sampleId>`
- `evidence:<evidenceId>`
- `eval:<evalTaskId>`
- `eval-result:<evalResultId>`
- `skill:<skillId>`
- 无落点 ID 时使用 `event:<eventId>`

- [ ] **Step 3: 默认视图与高级详情分层**

默认字段只能包含客户能看懂的信息。`advanced` 才允许包含 `topicKey`、`conflictKey`、内部状态、任务日志、token、失败堆栈和原始事件。

- [ ] **Step 4: 部分读取失败兜底**

如果读取样例、评测或技能失败，API 返回可用数据和 `accessIssues`，页面不能空白。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test app/lib/learningLibrary.test.js app/server-static.test.js
```

Expected: API 契约、默认字段、高级字段、recordId、accessIssues 全部通过。

- [ ] **Step 6: Commit**

```powershell
git add app/lib/learningLibrary.js app/lib/learningLibrary.test.js app/server.js app/server-static.test.js
git commit -m "feat: expose learning library view contract"
```

## Task 8: D8 学习资料库前端体验

**Files:**
- Modify: `app/public/index.html`
- Modify: `app/public/app.js`
- Modify: `app/public/styles.css`
- Modify: `app/public/app-static.test.js`

- [ ] **Step 1: 静态测试先改为新手视角**

`app/public/app-static.test.js` 应断言：

- 默认说明包含“已保存”“已影响生成”“待确认”“学错了怎么改”。
- 默认视图不出现旧用户主状态 `已生效`。
- 默认卡片不出现 `topicKey`、L0/L1/L2、`skill-index`、token、失败堆栈。
- 其他页面不展示学习详情。

- [ ] **Step 2: 更新学习资料库说明**

`index.html` 顶部说明改成三句话：

1. 系统会把长期规则、满意样例、纠错和归档证据记到这里。
2. 每条记录都会说明是否影响生成。
3. 学错了可以点“带引用去纠正”回到对话处理。

- [ ] **Step 3: 渲染默认字段**

`renderLearningRecordItem(record)` 只使用：

- `displayStatus`
- `actionLabel`
- `generationImpactText`
- `learnedText`
- `sourceText`
- `usedWhereText`
- `nextStepText`
- `generationProof.claimText`
- `correctionAction`

- [ ] **Step 4: 高级详情折叠**

内部字段放到 `<details>`，标题为“高级详情”。默认折叠，不影响新手阅读。

- [ ] **Step 5: 空状态和失败状态**

空状态说明“还没有学习记录；当你说以后都这样、投喂样例或归档画布后，会出现在这里”。失败状态必须显示失败阶段、原因、是否影响生成和下一步。

- [ ] **Step 6: 运行测试**

Run:

```powershell
node --test app/public/app-static.test.js
```

Expected: 新手说明、旧术语迁移、默认视图字段和纠错入口测试通过。

- [ ] **Step 7: Commit**

```powershell
git add app/public/index.html app/public/app.js app/public/styles.css app/public/app-static.test.js
git commit -m "feat: redesign learning library for novice users"
```

## Task 9: D10 验收夹具与第三方排查脚本

**Files:**
- Create: `tools/Invoke-LearningAcceptance.ps1`
- Modify: `app/server.js`
- Modify: `app/server-static.test.js`
- Modify: `docs/自主学习机制闭环重构方案.md`

- [ ] **Step 1: 脚本参数契约**

`tools/Invoke-LearningAcceptance.ps1` 支持：

```powershell
tools/Invoke-LearningAcceptance.ps1 -PrepareFixture
tools/Invoke-LearningAcceptance.ps1 -FixtureRoot <path> -Scenario A1
tools/Invoke-LearningAcceptance.ps1 -FixtureRoot <path> -All
tools/Invoke-LearningAcceptance.ps1 -FixtureRoot <path> -ServiceMode -Port 17878
tools/Invoke-LearningAcceptance.ps1 -FixtureRoot <path> -WriteReport
```

- [ ] **Step 2: PrepareFixture**

`-PrepareFixture` 创建 `runs/learning-acceptance-YYYYMMDD-HHmmss/`，stdout 只输出夹具根目录纯路径。日志写入 `manifest.json` 或 stderr。

- [ ] **Step 3: 服务夹具模式**

`app/server.js` 支持 `MBH_ACCEPTANCE_ROOT=<FixtureRoot>\workspace`。`/api/status` 返回：

```json
{
  "ok": true,
  "acceptanceMode": true,
  "acceptanceRoot": "<FixtureRoot>/workspace"
}
```

服务夹具模式只替换可变业务数据根，不复制 `app/server.js` 或 `app/public/`。

- [ ] **Step 4: A1-A10 场景**

脚本至少实现第一阶段主场景：

- A1 明确长期硬规则
- A2 临时特殊要求
- A3 样例投喂
- A4 画布归档
- A5 样本不足
- A6 规则冲突
- A7 学错纠正
- A8 已被覆盖
- A9 学习失败
- A10 页面新手理解与边界

- [ ] **Step 5: 报告输出**

`-WriteReport` 生成 `docs/学习机制闭环验收记录_YYYYMMDD_v1.md` 草稿，包含提交号、端口、夹具路径、A1-A10 结果、证据路径、失败排查建议和最终结论。

- [ ] **Step 6: 运行测试**

Run:

```powershell
node --test app/server-static.test.js
$fixture = powershell -NoProfile -ExecutionPolicy Bypass -File tools/Invoke-LearningAcceptance.ps1 -PrepareFixture
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Invoke-LearningAcceptance.ps1 -FixtureRoot $fixture -All
```

Expected: 脚本使用隔离目录，输出 A1-A10 通过/失败和证据路径；不写真实 `learning/`。

- [ ] **Step 7: Commit**

```powershell
git add tools/Invoke-LearningAcceptance.ps1 app/server.js app/server-static.test.js docs/自主学习机制闭环重构方案.md
git commit -m "test: add learning acceptance harness"
```

## Task 10: D9 第二阶段技能草案边界

**Files:**
- Modify: `tools/New-SkillEvolutionDraft.ps1`
- Modify: `app/lib/localSkills.test.js`
- Modify: `docs/自主学习机制闭环重构方案.md`

- [ ] **Step 1: 保留草案入口**

第一阶段只要求学习资料库能显示技能草案入口或空状态，不要求自动发布正式 skill。

- [ ] **Step 2: 草案结构**

第二阶段草案必须包含：

- `skillId`
- `relatedRuleIds`
- `relatedEvalResultIds`
- `sourceEventIds`
- diff 摘要
- 人工确认状态

- [ ] **Step 3: 发布闸门**

未经人工确认不得写入正式 `skills/`。发布失败必须保留旧 skill 和旧路由。

- [ ] **Step 4: 运行测试**

Run:

```powershell
node --test app/lib/localSkills.test.js
powershell -NoProfile -ExecutionPolicy Bypass -File tools/New-SkillEvolutionDraft.ps1 -Root . -Date 2026-07-04 -Force
```

Expected: 草案可生成，正式 skill 不被自动改写。

- [ ] **Step 5: Commit**

```powershell
git add tools/New-SkillEvolutionDraft.ps1 app/lib/localSkills.test.js docs/自主学习机制闭环重构方案.md
git commit -m "docs: define skill draft promotion boundary"
```

## 推荐开发顺序

1. Task 1：统一事件账本。
2. Task 2：统一用户可见状态映射。
3. Task 3：当前整体规则、快照和 last-good。
4. Task 7：先把学习资料库 API 契约稳定下来。
5. Task 8：再改学习资料库前端。
6. Task 4：补样例和归档证据。
7. Task 5：补评测、硬规则校验和重评测。
8. Task 6：补带引用去纠正。
9. Task 9：补 D10 验收夹具并跑 A1-A10。
10. Task 10：第二阶段开始前再做 skill 草案和发布验证。

实际合并时，Task 9 的验收脚本可以从 Task 1 开始逐步补场景，不必等 D1-D8 全部完成才新建脚本。

## 合并闸门

每个任务合并前必须满足：

- 新增或变更的用户可见行为有自动化测试或可重复脚本检查。
- 至少覆盖一个正常路径和一个失败、待确认或回退路径。
- 学习资料库能看到状态、是否影响生成、用户下一步和证据来源。
- `已保存` 不得误显示为 `已影响生成`。
- 影响生成结果能追溯到事件、落点、规则或技能来源。
- 失败不能卡住对话、画布、生成、导出主流程。
- `git diff --check` 通过。

## 收敛验收

第一阶段进入客户可试用前，必须同时满足：

- `node --test app` 通过。
- `node --test app/public` 通过。
- `node --test app/server-static.test.js` 通过。
- `tools/Invoke-LearningAcceptance.ps1 -FixtureRoot <path> -All` 覆盖 A1-A10。
- 服务夹具模式 `/api/status` 返回 `acceptanceMode: true`。
- 服务夹具模式 `/api/learning-library` 只返回夹具数据。
- 不熟悉内部术语的人能回答：`已保存` 是什么、`已影响生成` 是什么、`待确认` 下一步做什么、学错了怎么改。

## 自审结论

本拆分覆盖主方案 D1-D10，其中 D1-D8 和 D10 是第一阶段闭环，D9 被限制为第二阶段。客户理解层由 D8 和 D10 验收兜底，业务闭环由 D1-D7 兜底，第三方排查由 D10 兜底。

剩余两个产品取舍不阻塞开发：

1. L1 小样本回归第一批样本来源。
2. 学习资料库内部是否把评测记录做独立 Tab，还是先放在详情页。
