const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { learnExplicitRule, updateCurrentRuleStatus } = require("./autonomousLearning");
const { buildLearningLibrary } = require("./learningLibrary");
const { writeLearningEvidence, writeLearningSample } = require("./learningEvidence");

test("buildLearningLibrary exposes records current rules and readonly skill groups", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-"));
  await fsp.mkdir(path.join(root, "skills/03-storyboard/storyboard-generate"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "skills/03-storyboard/storyboard-generate/SKILL.md"),
    [
      "---",
      "description: 用于把剧本生成标准 AI 漫剧分镜。",
      "---",
      "# 分镜生成",
      "",
      "## 使用场景",
      "",
      "当用户要求生成、修改或检查分镜时使用。",
      "",
    ].join("\n"),
    "utf8",
  );
  await fsp.mkdir(path.join(root, "skills/02-script/script-hard-issue-review"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "skills/02-script/script-hard-issue-review/SKILL.md"),
    [
      "---",
      "description: 用于检查 AI 漫剧剧本硬伤。",
      "---",
      "# 剧本硬伤评审",
      "",
      "检查剧情逻辑、画面可呈现性和格式问题。",
      "",
    ].join("\n"),
    "utf8",
  );

  await learnExplicitRule(root, {
    rawTrigger: "以后分镜台词每句 20 字以内",
    summary: "分镜台词每句 20 字以内。",
    capability: "storyboard",
    sourceType: "conversation",
    conversationId: "chat-1",
    tokenUsage: {
      prompt_tokens: 11,
      completion_tokens: 7,
      total_tokens: 18,
    },
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "event-1",
  });
  await updateCurrentRuleStatus(root, {
    ruleId: "rule-event-1",
    status: "disabled",
  }, {
    now: () => "2026-07-01T10:05:00.000Z",
  });
  await fsp.mkdir(path.join(root, "learning/conversation-records"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "learning/conversation-records/2026-07-04-同一个镜号里边的台词不能超过20个字，超过要拆分镜头-chat01.md"),
    [
      "# 对话学习记录",
      "",
      "生成日期：2026-07-04",
      "",
      "## 一、判断结论",
      "",
      "| 项目 | 内容 |",
      "| --- | --- |",
      "| 标题 | 同一个镜号里边的台词不能超过20个字，超过要拆分镜头 |",
      "| 是否需要学习 | 是 |",
      "| 材料类型 | 分镜 |",
      "| 是否已采纳 | 未判断 |",
      "| 质量信号 | 无明显变化 |",
      "| 学习动作 | 候选规则 |",
      "",
      "## 三、证据",
      "",
      "用户消息：同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
      "",
    ].join("\n"),
    "utf8",
  );

  const library = await buildLearningLibrary(root);

  assert.ok(Array.isArray(library.records));
  assert.ok(Array.isArray(library.currentRules));
  assert.ok(Array.isArray(library.skills));
  assert.strictEqual(library.records.length, 1);
  assert.ok(library.records.some((record) => record.recordId === "event-1"));
  const eventRecord = library.records.find((record) => record.recordId === "event-1");
  assert.strictEqual(eventRecord.displayStatus, "已影响生成");
  assert.strictEqual(eventRecord.status, "已影响生成");
  assert.strictEqual(eventRecord.actionLabel, "不用管");
  assert.strictEqual(eventRecord.affectsGeneration, true);
  assert.strictEqual(eventRecord.generationProof.proofStatus, "pending_first_hit");
  assert.strictEqual(eventRecord.advanced.internalStatus, "landed");
  assert.strictEqual(eventRecord.advanced.jobStatus, "completed");
  assert.strictEqual(eventRecord.advanced.learningMode, "overall");
  assert.strictEqual(eventRecord.advanced.landingType, "current-rule");
  for (const internalField of ["topicKey", "tokenUsage", "sourceType", "ruleId", "coveredByEventId", "error"]) {
    assert.equal(Object.hasOwn(eventRecord, internalField), false);
  }
  assert.strictEqual(eventRecord.advanced.topicKey, "storyboard.dialogue.length");
  assert.strictEqual(eventRecord.advanced.sourceType, "conversation");
  assert.strictEqual(eventRecord.advanced.ruleId, "rule-event-1");
  assert.strictEqual(eventRecord.advanced.tokenUsage.total_tokens, 18);
  assert.strictEqual(library.currentRules[0].topicKey, "storyboard.dialogue.length");
  assert.strictEqual(library.currentRules[0].status, "disabled");
  const storyboardSkill = library.skills.find((skill) => skill.id === "storyboard-generate");
  assert.ok(storyboardSkill);
  assert.match(storyboardSkill.description, /标准 AI 漫剧分镜/);
  assert.match(storyboardSkill.instructions, /使用场景/);
  const hardIssueSkill = library.skills.find((skill) => skill.path === "skills/02-script/script-hard-issue-review");
  assert.ok(hardIssueSkill);
  assert.match(hardIssueSkill.description, /剧本硬伤/);
  assert.strictEqual(hardIssueSkill.exists, true);
  assert.strictEqual(hardIssueSkill.discovered, true);
  assert.ok(library.skills.every((skill) => skill.readonly === true));
});

test("buildLearningLibrary maps normalized legacy events into D2 display statuses", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-legacy-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(
    path.join(learningDir, "events.jsonl"),
    [
      JSON.stringify({
        eventId: "event-waiting",
        status: "待确认",
        summary: "等待确认的旧事件",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:00:00.000Z",
      }),
      JSON.stringify({
        eventId: "event-validated",
        status: "已影响生成",
        summary: "已影响生成的旧事件",
        createdAt: "2026-07-04T00:01:00.000Z",
        updatedAt: "2026-07-04T00:01:00.000Z",
      }),
    ].join("\n"),
    "utf8",
  );

  const library = await buildLearningLibrary(root);
  const waiting = library.records.find((record) => record.recordId === "event-waiting");
  const validated = library.records.find((record) => record.recordId === "event-validated");

  assert.strictEqual(waiting.advanced.internalStatus, "received");
  assert.strictEqual(waiting.advanced.jobStatus, "waiting");
  assert.strictEqual(waiting.displayStatus, "待确认");
  assert.strictEqual(waiting.status, "待确认");
  assert.strictEqual(validated.advanced.internalStatus, "validated");
  assert.strictEqual(validated.advanced.jobStatus, "completed");
  assert.strictEqual(validated.displayStatus, "已影响生成");
  assert.strictEqual(validated.status, "已影响生成");
  assert.strictEqual(validated.affectsGeneration, true);
});

test("buildLearningLibrary keeps raw failure and coverage fields in advanced only", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-boundary-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(
    path.join(learningDir, "events.jsonl"),
    JSON.stringify({
      eventId: "event-covered",
      topicKey: "storyboard.dialogue.length",
      sourceType: "conversation",
      internalStatus: "covered",
      jobStatus: "completed",
      learningMode: "overall",
      landingType: "current-rule",
      summary: "旧规则",
      rawTrigger: "旧规则原文",
      ruleId: "rule-event-covered",
      coveredByEventId: "event-new",
      tokenUsage: {
        prompt_tokens: 5,
        completion_tokens: 3,
        total_tokens: 8,
      },
      error: {
        stage: "publish-current-ruleset",
        message: "旧失败信息",
      },
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:01:00.000Z",
    }) + "\n",
    "utf8",
  );

  const library = await buildLearningLibrary(root);
  const record = library.records[0];

  assert.strictEqual(record.displayStatus, "已被覆盖");
  assert.strictEqual(record.status, "已被覆盖");
  assert.strictEqual(record.updatedAt, "2026-07-04T00:01:00.000Z");
  for (const internalField of ["topicKey", "tokenUsage", "sourceType", "ruleId", "coveredByEventId", "error"]) {
    assert.equal(Object.hasOwn(record, internalField), false);
  }
  assert.strictEqual(record.advanced.topicKey, "storyboard.dialogue.length");
  assert.strictEqual(record.advanced.sourceType, "conversation");
  assert.strictEqual(record.advanced.ruleId, "rule-event-covered");
  assert.strictEqual(record.advanced.coveredByEventId, "event-new");
  assert.strictEqual(record.advanced.tokenUsage.total_tokens, 8);
  assert.strictEqual(record.advanced.error.message, "旧失败信息");
});

test("buildLearningLibrary maps persisted generation proof from normalized JSONL events", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-proof-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(
    path.join(learningDir, "events.jsonl"),
    JSON.stringify({
      eventId: "event-proof",
      internalStatus: "landed",
      jobStatus: "completed",
      learningMode: "overall",
      landingType: "current-rule",
      summary: "分镜台词每句 20 字以内",
      ruleId: "rule-event-proof",
      generationProof: {
        proofStatus: "validated",
        claimText: "已在生成 output-1 中验证",
        validationResultRefs: ["run-1"],
        stack: "must not leak",
      },
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:01:00.000Z",
    }) + "\n",
    "utf8",
  );

  const library = await buildLearningLibrary(root);
  const record = library.records[0];

  assert.strictEqual(record.displayStatus, "已影响生成");
  assert.strictEqual(record.generationProof.proofStatus, "validated");
  assert.strictEqual(record.generationProof.claimText, "已在生成 output-1 中验证");
  assert.deepEqual(record.generationProof.validationResultRefs, ["run-1"]);
  assert.equal(Object.hasOwn(record.generationProof, "stack"), false);
});

test("buildLearningLibrary aggregates evidence and samples as saved non-generation records", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-materials-"));
  const evidence = await writeLearningEvidence(root, {
    canvas: {
      id: "canvas-1",
      title: "归档画布",
      archivedAt: "2026-07-04T10:00:00.000Z",
      nodes: [
        { id: "script-1", type: "script", title: "最终剧本", content: "剧本", meta: {} },
      ],
      archiveReadiness: {
        readiness: { finalNodeIds: { script: ["script-1"] } },
      },
    },
    outputId: "output-1",
    sourceEventIds: ["event-archive"],
    createdAt: "2026-07-04T10:01:00.000Z",
  });
  const sample = await writeLearningSample(root, {
    summary: "可复用样例",
    content: "样例正文",
    canvasId: "canvas-2",
    sourceEventIds: ["event-sample"],
    createdAt: "2026-07-04T10:02:00.000Z",
  });

  const library = await buildLearningLibrary(root);
  const evidenceRecord = library.records.find((record) => record.recordId === `evidence:${evidence.evidenceId}`);
  const sampleRecord = library.records.find((record) => record.recordId === `sample:${sample.sampleId}`);

  assert.ok(evidenceRecord);
  assert.strictEqual(evidenceRecord.displayStatus, "已保存");
  assert.strictEqual(evidenceRecord.status, "已保存");
  assert.strictEqual(evidenceRecord.affectsGeneration, false);
  assert.strictEqual(evidenceRecord.generationProof.proofStatus, "not_applicable");
  assert.match(evidenceRecord.sourceText, /归档/);
  assert.match(evidenceRecord.usedWhereText, /学习资料库/);
  assert.match(evidenceRecord.nextStepText, /回看/);
  assert.strictEqual(evidenceRecord.advanced.evidenceId, evidence.evidenceId);
  assert.strictEqual(evidenceRecord.advanced.canvasId, "canvas-1");

  assert.ok(sampleRecord);
  assert.strictEqual(sampleRecord.displayStatus, "已保存");
  assert.strictEqual(sampleRecord.affectsGeneration, false);
  assert.strictEqual(sampleRecord.generationProof.proofStatus, "not_applicable");
  assert.strictEqual(sampleRecord.advanced.sampleId, sample.sampleId);
  assert.deepStrictEqual(sampleRecord.advanced.sourceEventIds, ["event-sample"]);
});

test("buildLearningLibrary keeps archive evidence failure visible without marking it saved", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-evidence-failure-"));
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(
    path.join(root, "learning/events.jsonl"),
    JSON.stringify({
      eventId: "archive-evidence-failed-canvas-1",
      internalStatus: "failed",
      jobStatus: "failed",
      learningMode: "evidence",
      sourceType: "archive",
      canvasId: "canvas-1",
      summary: "画布已归档，学习证据生成失败",
      error: {
        stage: "write-learning-evidence",
        message: "disk full",
      },
      createdAt: "2026-07-04T11:00:00.000Z",
      updatedAt: "2026-07-04T11:00:00.000Z",
    }) + "\n",
    "utf8",
  );

  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === "archive-evidence-failed-canvas-1");

  assert.ok(record);
  assert.strictEqual(record.displayStatus, "失败");
  assert.strictEqual(record.affectsGeneration, false);
  assert.strictEqual(record.generationProof.proofStatus, "failed");
  assert.strictEqual(record.learnedText, "画布已归档，学习证据生成失败");
  assert.strictEqual(record.advanced.error.stage, "write-learning-evidence");
});
