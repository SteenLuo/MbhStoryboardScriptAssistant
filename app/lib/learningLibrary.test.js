const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { appendSampleInsufficientLearningEvent, learnExplicitRule } = require("./autonomousLearning");
const { buildLearningLibrary } = require("./learningLibrary");
const { writeLearningEvidence, writeLearningSample } = require("./learningEvidence");

function assertNoDuplicateRecordIds(items, listName) {
  const seen = new Set();
  for (const item of items) {
    assert.equal(seen.has(item.recordId), false, `${listName} has duplicate recordId ${item.recordId}`);
    seen.add(item.recordId);
  }
}

test("buildLearningLibrary returns the fixed D7 view contract", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-contract-"));
  const library = await buildLearningLibrary(root);

  for (const field of ["records", "impactItems", "sampleItems", "evalItems", "skillItems", "accessIssues"]) {
    assert.ok(Array.isArray(library[field]), `${field} should be an array`);
  }
  assert.ok(Array.isArray(library.currentRules));
  assert.ok(Array.isArray(library.skills));
});

test("buildLearningLibrary keeps legacy current-rule events as history even if old ruleset is invalid", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-bad-ruleset-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(path.join(learningDir, "events.jsonl"), JSON.stringify({
    eventId: "event-invalid-rule",
    internalStatus: "landed",
    jobStatus: "completed",
    learningMode: "overall",
    landingType: "current-rule",
    ruleId: "rule-invalid",
    landingIds: ["rule-invalid"],
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sourceType: "conversation",
    summary: "分镜台词每句 20 字以内。",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  }) + "\n", "utf8");
  await fsp.writeFile(path.join(learningDir, "current-ruleset.json"), JSON.stringify({
    version: 1,
    lastGoodVersion: 1,
    updatedAt: "2026-07-04T00:00:00.000Z",
    rules: [
      {
        ruleId: "rule-invalid",
        topicKey: "storyboard.dialogue.length",
        capability: "storyboard",
        content: "分镜台词每句 20 字以内。",
        priority: 50,
        sourceEventIds: ["event-invalid-rule"],
        status: "active",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:00:00.000Z",
      },
    ],
  }, null, 2), "utf8");

  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === "rule:rule-invalid");

  assert.ok(record);
  assert.strictEqual(record.displayStatus, "已保存");
  assert.strictEqual(record.affectsGeneration, false);
  assert.match(record.generationImpactText, /历史学习资料/);
  assert.match(record.generationImpactText, /正式技能/);
  assert.strictEqual(record.generationProof.proofStatus, "not_applicable");
  assert.strictEqual(library.impactItems.some((item) => item.recordId === "rule:rule-invalid"), false);
  assert.equal(library.accessIssues.some((issue) => issue.area === "rules"), false);
});

test("buildLearningLibrary shows sample-insufficient next steps and trace fields", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-sample-insufficient-"));
  await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-need-samples",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "dialogue-length-failure",
    neededCount: 2,
    relatedRecordIds: ["record-a"],
    sourceEventIds: ["event-a"],
    summary: "Need more samples before L1 evaluation.",
  }, {
    now: () => "2026-07-04T08:00:00.000Z",
  });

  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === "eval:event-need-samples");

  assert.ok(record);
  assert.strictEqual(record.displayStatus, "待确认");
  assert.strictEqual(record.status, "待确认 / 待补样例");
  assert.strictEqual(record.actionLabel, "待补样例");
  assert.match(record.nextStepText, /dialogue-length-failure/);
  assert.match(record.nextStepText, /2/);
  assert.strictEqual(record.advanced.neededSampleType, "dialogue-length-failure");
  assert.strictEqual(record.advanced.neededCount, 2);
  assert.deepStrictEqual(record.advanced.relatedRecordIds, ["record-a"]);
  assert.deepStrictEqual(record.advanced.sourceEventIds, ["event-a"]);
});

test("writeLearningSample marks related sample-insufficient eval tasks traceable when count is satisfied", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-reeval-"));
  await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-need-samples",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "dialogue-length-failure",
    neededCount: 2,
    relatedRecordIds: ["record-a"],
    sourceEventIds: ["event-a"],
    summary: "Need more samples before L1 evaluation.",
  }, {
    now: () => "2026-07-04T08:00:00.000Z",
  });

  await writeLearningSample(root, {
    summary: "sample 1",
    content: "example 1",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sampleType: "dialogue-length-failure",
    sourceEventIds: ["event-sample-1"],
    createdAt: "2026-07-04T08:10:00.000Z",
  });
  let library = await buildLearningLibrary(root);
  let waiting = library.records.find((item) => item.recordId === "eval:event-need-samples");
  assert.strictEqual(waiting.status, "待确认 / 待补样例");

  await writeLearningSample(root, {
    summary: "sample 2",
    content: "example 2",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sampleType: "dialogue-length-failure",
    sourceEventIds: ["event-sample-2"],
    createdAt: "2026-07-04T08:20:00.000Z",
  });
  library = await buildLearningLibrary(root);
  const updated = library.records.find((item) => item.recordId === "eval:reeval-event-need-samples");

  assert.strictEqual(updated.displayStatus, "已保存");
  assert.strictEqual(updated.affectsGeneration, false);
  assert.strictEqual(updated.advanced.landingType, "eval");
  assert.strictEqual(updated.advanced.sampleCount, 2);
  assert.ok(updated.advanced.reevaluationTaskId);
});

test("writeLearningSample only satisfies sample-insufficient tasks with matching neededSampleType", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-reeval-type-"));
  await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-dialogue-samples",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "dialogue-length-failure",
    neededCount: 1,
    summary: "Need dialogue samples.",
  }, {
    now: () => "2026-07-04T08:00:00.000Z",
  });
  await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-tone-samples",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "tone-drift",
    neededCount: 1,
    summary: "Need tone samples.",
  }, {
    now: () => "2026-07-04T08:01:00.000Z",
  });

  await writeLearningSample(root, {
    summary: "dialogue sample",
    content: "example",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sampleType: "dialogue-length-failure",
    createdAt: "2026-07-04T08:10:00.000Z",
  });

  const library = await buildLearningLibrary(root);
  const dialogue = library.records.find((item) => item.recordId === "eval:reeval-event-dialogue-samples");
  const tone = library.records.find((item) => item.recordId === "eval:event-tone-samples");

  assert.strictEqual(dialogue.displayStatus, "已保存");
  assert.strictEqual(dialogue.advanced.landingType, "eval");
  assert.strictEqual(dialogue.advanced.sampleCount, 1);
  assert.strictEqual(tone.status, "待确认 / 待补样例");
  assert.strictEqual(tone.advanced.landingType, "sample-insufficient");
});

test("writeLearningSample does not satisfy a related task when sampleType differs from neededSampleType", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-related-type-"));
  await appendSampleInsufficientLearningEvent(root, {
    eventId: "event-related-task",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    neededSampleType: "dialogue-length-failure",
    neededCount: 1,
    summary: "Need dialogue samples.",
  }, {
    now: () => "2026-07-04T08:00:00.000Z",
  });

  await writeLearningSample(root, {
    summary: "wrong type but related",
    content: "example",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length",
    sampleType: "tone-drift",
    relatedTaskId: "event-related-task",
    createdAt: "2026-07-04T08:10:00.000Z",
  });

  const library = await buildLearningLibrary(root);
  const task = library.records.find((item) => item.recordId === "eval:event-related-task");

  assert.strictEqual(task.advanced.landingType, "sample-insufficient");
  assert.strictEqual(task.advanced.jobStatus, "waiting");
});

test("buildLearningLibrary exposes learning records and readonly skill groups without current rules", async () => {
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
  assert.ok(Array.isArray(library.impactItems));
  assert.ok(Array.isArray(library.sampleItems));
  assert.ok(Array.isArray(library.evalItems));
  assert.ok(Array.isArray(library.skillItems));
  assert.ok(Array.isArray(library.accessIssues));
  assert.ok(Array.isArray(library.currentRules));
  assert.ok(Array.isArray(library.skills));
  assert.strictEqual(library.currentRules.length, 0);
  assert.strictEqual(library.records.length, 1);
  assert.ok(library.records.some((record) => record.recordId === "event:event-1"));
  const eventRecord = library.records.find((record) => record.recordId === "event:event-1");
  assert.strictEqual(eventRecord.displayStatus, "已保存");
  assert.strictEqual(eventRecord.status, "已保存");
  assert.strictEqual(eventRecord.actionLabel, "不用管");
  assert.strictEqual(eventRecord.affectsGeneration, false);
  assert.match(eventRecord.generationImpactText, /学习资料/);
  assert.match(eventRecord.generationImpactText, /不.*直接.*生成|不会.*直接.*改变生成/);
  assert.strictEqual(eventRecord.generationProof.proofStatus, "not_applicable");
  assert.strictEqual(eventRecord.advanced.internalStatus, "landed");
  assert.strictEqual(eventRecord.advanced.jobStatus, "completed");
  assert.strictEqual(eventRecord.advanced.learningMode, "overall");
  assert.strictEqual(eventRecord.advanced.landingType, "learning-record");
  for (const internalField of ["topicKey", "conflictKey", "tokenUsage", "sourceType", "ruleId", "coveredByEventId", "error"]) {
    assert.equal(Object.hasOwn(eventRecord, internalField), false);
  }
  assert.strictEqual(eventRecord.advanced.topicKey, "storyboard.dialogue.length");
  assert.strictEqual(eventRecord.advanced.sourceType, "conversation");
  assert.strictEqual(eventRecord.advanced.ruleId, "");
  assert.strictEqual(eventRecord.advanced.tokenUsage.total_tokens, 18);
  assert.strictEqual(eventRecord.correctionAction.enabled, true);
  assert.strictEqual(eventRecord.correctionAction.payload.recordId, "event:event-1");
  assert.strictEqual(eventRecord.correctionAction.payload.eventId, "event-1");
  assert.deepStrictEqual(eventRecord.correctionAction.payload.landingIds, []);
  assert.strictEqual(eventRecord.correctionAction.payload.projectId, "");
  assert.strictEqual(eventRecord.correctionAction.payload.scope, "overall");
  assert.strictEqual(eventRecord.correctionAction.defaultText, "这条学错了，请按这次说明覆盖。");
  assert.equal(Object.hasOwn(eventRecord.correctionAction.payload, "tokenUsage"), false);
  assert.strictEqual(library.impactItems.some((record) => record.recordId === "event:event-1"), false);
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

test("buildLearningLibrary aggregates saved skill drafts without affecting generation", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-skill-drafts-"));
  await fsp.mkdir(path.join(root, "learning", "skill-evolution-reports"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning", "skill-evolution-reports", "skill-evolution-draft-draft-a.json"), JSON.stringify({
    draftId: "draft-a",
    skillId: "storyboard-generate",
    skillKind: "storyboard",
    draftStatus: "saved",
    humanConfirmationStatus: "pending",
    relatedRuleIds: ["rule-a", "rule-b"],
    relatedEvalResultIds: ["eval-result-a"],
    sourceEventIds: ["event-a"],
    diffSummary: "Draft only: no official skill files or routes are changed.",
    generatedAt: "2026-07-04T12:00:00.000Z",
    affectsGeneration: false,
  }), "utf8");
  await fsp.writeFile(path.join(root, "learning", "skill-evolution-reports", "misc-report.json"), JSON.stringify({
    draftId: "not-a-skill-draft",
    skillId: "storyboard-generate",
    humanConfirmationStatus: "pending",
  }), "utf8");

  const library = await buildLearningLibrary(root);
  const draft = library.skillItems.find((item) => item.recordId === "skill-draft:draft-a");

  assert.ok(draft);
  assert.strictEqual(draft.recordId, "skill-draft:draft-a");
  assert.strictEqual(draft.skillId, "storyboard-generate");
  assert.strictEqual(draft.skillKind, "storyboard");
  assert.strictEqual(draft.draftStatus, "saved");
  assert.strictEqual(draft.humanConfirmationStatus, "pending");
  assert.deepStrictEqual(draft.relatedRuleIds, ["rule-a", "rule-b"]);
  assert.deepStrictEqual(draft.relatedEvalResultIds, ["eval-result-a"]);
  assert.deepStrictEqual(draft.sourceEventIds, ["event-a"]);
  assert.strictEqual(draft.diffSummary, "Draft only: no official skill files or routes are changed.");
  assert.strictEqual(draft.displayStatus, "已保存");
  assert.strictEqual(draft.generationImpactText, "暂不影响生成；等待人工确认后才可能进入正式技能。");
  assert.strictEqual(draft.nextStepText, "等待人工确认；确认前不会写入正式技能或生成上下文。");
  assert.strictEqual(draft.affectsGeneration, false);
  assert.equal(library.impactItems.some((item) => item.recordId === "skill-draft:draft-a"), false);
  assert.equal(library.skillItems.some((item) => item.recordId === "skill-draft:not-a-skill-draft"), false);
  assert.equal(library.accessIssues.some((issue) => issue.path?.endsWith("misc-report.json")), false);
});

test("buildLearningLibrary aggregates skill creator tasks without exposing legacy evolution drafts as active workflow", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-skill-creator-tasks-"));
  await fsp.mkdir(path.join(root, "learning", "skill-creator-tasks"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning", "skill-creator-tasks", "skill-creator-task-task-a.json"), JSON.stringify({
    taskId: "task-a",
    skillId: "storyboard-generate",
    title: "把分镜台词规则沉淀到正式 skill",
    status: "saved",
    sourceEventIds: ["event-a"],
    relatedRecordIds: ["record-a"],
    summary: "用户主动技能学习后，由 skill-creator 形成待执行任务。",
    proposedFiles: ["skills/03-storyboard/storyboard-generate/SKILL.md"],
    createdAt: "2026-07-05T12:00:00.000Z",
    affectsGeneration: false,
  }), "utf8");

  const library = await buildLearningLibrary(root);
  const task = library.skillItems.find((item) => item.recordId === "skill-creator-task:task-a");

  assert.ok(task);
  assert.strictEqual(task.skillId, "storyboard-generate");
  assert.strictEqual(task.displayStatus, "已保存");
  assert.strictEqual(task.generationImpactText, "暂不影响生成；需要执行 skill-creator 任务并验证后才可能进入正式技能。");
  assert.strictEqual(task.nextStepText, "等待按 skill-creator 任务修改并验证；完成前不会写入生成上下文。");
  assert.strictEqual(task.affectsGeneration, false);
  assert.deepStrictEqual(task.sourceEventIds, ["event-a"]);
  assert.deepStrictEqual(task.proposedFiles, ["skills/03-storyboard/storyboard-generate/SKILL.md"]);
  assert.equal(library.impactItems.some((item) => item.recordId === "skill-creator-task:task-a"), false);
});

test("buildLearningLibrary reports malformed skill drafts as access issues while keeping skills visible", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-bad-skill-drafts-"));
  const draftDir = path.join(root, "learning", "skill-evolution-reports");
  await fsp.mkdir(draftDir, { recursive: true });
  await fsp.mkdir(path.join(root, "skills", "99-test", "existing-skill"), { recursive: true });
  await fsp.writeFile(path.join(root, "skills", "99-test", "existing-skill", "SKILL.md"), "# Existing skill\n", "utf8");
  await fsp.writeFile(path.join(draftDir, "skill-evolution-draft-bad.json"), "{", "utf8");

  const library = await buildLearningLibrary(root);

  assert.ok(library.skillItems.some((item) => item.recordId === "skill:existing-skill"));
  assert.ok(library.accessIssues.some((issue) =>
    issue.area === "skill-drafts" &&
    issue.path?.endsWith("skill-evolution-draft-bad.json") &&
    issue.message
  ));
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
  const waiting = library.records.find((record) => record.recordId === "event:event-waiting");
  const validated = library.records.find((record) => record.recordId === "event:event-validated");

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
  for (const internalField of ["topicKey", "conflictKey", "tokenUsage", "sourceType", "ruleId", "coveredByEventId", "error"]) {
    assert.equal(Object.hasOwn(record, internalField), false);
  }
  assert.strictEqual(record.advanced.topicKey, "storyboard.dialogue.length");
  assert.strictEqual(record.advanced.sourceType, "conversation");
  assert.strictEqual(record.advanced.ruleId, "rule-event-covered");
  assert.strictEqual(record.advanced.coveredByEventId, "event-new");
  assert.strictEqual(record.advanced.tokenUsage.total_tokens, 8);
  assert.strictEqual(record.advanced.error.message, "旧失败信息");
});

test("buildLearningLibrary keeps covered legacy current-rule records covered", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-restored-rule-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(
    path.join(learningDir, "events.jsonl"),
    JSON.stringify({
      eventId: "event-restored",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length.max-chars",
      sourceType: "conversation",
      internalStatus: "covered",
      jobStatus: "completed",
      learningMode: "overall",
      landingType: "current-rule",
      summary: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
      ruleId: "rule-event-restored",
      coveredByEventId: "event-new",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:01:00.000Z",
    }) + "\n",
    "utf8",
  );
  await fsp.writeFile(path.join(learningDir, "current-ruleset.json"), JSON.stringify({
    version: 1,
    lastGoodVersion: 1,
    updatedAt: "2026-07-04T00:02:00.000Z",
    rules: [{
      ruleId: "rule-event-restored",
      topicKey: "storyboard.dialogue.length",
      conflictKey: "storyboard.dialogue.length.max-chars",
      capability: "storyboard",
      content: "同一个镜号里边的台词不能超过20个字，超过要拆分镜头",
      priority: 50,
      sourceEventIds: ["event-restored"],
      status: "active",
      coveredByRuleId: "",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:02:00.000Z",
    }],
  }), "utf8");

  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === "rule:rule-event-restored");

  assert.strictEqual(record.displayStatus, "已被覆盖");
  assert.strictEqual(record.status, "已被覆盖");
  assert.strictEqual(record.affectsGeneration, false);
  assert.match(record.generationImpactText, /不再影响生成/);
  assert.match(record.generationProof.claimText, /已被后续学习覆盖/);
  assert.strictEqual(record.advanced.currentRuleStatus, undefined);
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

  assert.strictEqual(record.displayStatus, "已保存");
  assert.strictEqual(record.generationProof.proofStatus, "not_applicable");
  assert.strictEqual(record.generationProof.claimText, "这条学习现在只作为资料沉淀，不参与当前生成。");
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

test("buildLearningLibrary skips malformed evidence and sample records without empty material ids", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-malformed-materials-"));
  const evidenceDir = path.join(root, "learning", "evidence");
  const sampleDir = path.join(root, "learning", "samples");
  await fsp.mkdir(evidenceDir, { recursive: true });
  await fsp.mkdir(sampleDir, { recursive: true });
  await fsp.writeFile(path.join(evidenceDir, "bad-json.json"), "{", "utf8");
  await fsp.writeFile(path.join(evidenceDir, "null.json"), "null", "utf8");
  await fsp.writeFile(path.join(evidenceDir, "array.json"), "[]", "utf8");
  await fsp.writeFile(path.join(evidenceDir, "empty.json"), "{}", "utf8");
  await fsp.writeFile(path.join(evidenceDir, "good.json"), JSON.stringify({
    evidenceId: "evidence-good",
    canvasId: "canvas-good",
    sourceEventIds: ["event-good"],
    createdAt: "2026-07-04T12:00:00.000Z",
  }), "utf8");
  await fsp.writeFile(path.join(sampleDir, "bad-json.json"), "{", "utf8");
  await fsp.writeFile(path.join(sampleDir, "null.json"), "null", "utf8");
  await fsp.writeFile(path.join(sampleDir, "array.json"), "[]", "utf8");
  await fsp.writeFile(path.join(sampleDir, "empty.json"), "{}", "utf8");
  await fsp.writeFile(path.join(sampleDir, "good.json"), JSON.stringify({
    sampleId: "sample-good",
    summary: "有效样例",
    sourceEventIds: ["event-sample-good"],
    createdAt: "2026-07-04T12:01:00.000Z",
  }), "utf8");

  const library = await buildLearningLibrary(root);
  const recordIds = library.records.map((record) => record.recordId);

  assert.ok(recordIds.includes("evidence:evidence-good"));
  assert.ok(recordIds.includes("sample:sample-good"));
  assert.equal(recordIds.includes("evidence:"), false);
  assert.equal(recordIds.includes("sample:"), false);
  assert.strictEqual(recordIds.filter((id) => id.startsWith("evidence:")).length, 1);
  assert.strictEqual(recordIds.filter((id) => id.startsWith("sample:")).length, 1);
});

test("buildLearningLibrary records per-file access issues while keeping good material and eval records", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-file-issues-"));
  const evidenceDir = path.join(root, "learning", "evidence");
  const sampleDir = path.join(root, "learning", "samples");
  const evalDir = path.join(root, "learning", "evals", "tasks");
  await fsp.mkdir(evidenceDir, { recursive: true });
  await fsp.mkdir(sampleDir, { recursive: true });
  await fsp.mkdir(evalDir, { recursive: true });
  await fsp.writeFile(path.join(evidenceDir, "bad-json.json"), "{", "utf8");
  await fsp.writeFile(path.join(evidenceDir, "good.json"), JSON.stringify({
    evidenceId: "evidence-good",
    summary: "good evidence",
    createdAt: "2026-07-04T12:00:00.000Z",
  }), "utf8");
  await fsp.writeFile(path.join(sampleDir, "bad-json.json"), "{", "utf8");
  await fsp.writeFile(path.join(sampleDir, "good.json"), JSON.stringify({
    sampleId: "sample-good",
    summary: "good sample",
    createdAt: "2026-07-04T12:01:00.000Z",
  }), "utf8");
  await fsp.writeFile(path.join(evalDir, "bad-json.json"), "{", "utf8");
  await fsp.writeFile(path.join(evalDir, "good.json"), JSON.stringify({
    evalTaskId: "eval-good",
    summary: "good eval",
    createdAt: "2026-07-04T12:02:00.000Z",
  }), "utf8");

  const library = await buildLearningLibrary(root);
  const recordIds = library.records.map((record) => record.recordId);

  assert.ok(recordIds.includes("evidence:evidence-good"));
  assert.ok(recordIds.includes("sample:sample-good"));
  assert.ok(recordIds.includes("eval:eval-good"));
  assert.ok(library.accessIssues.some((issue) => issue.area === "evidence" && issue.path?.endsWith("bad-json.json") && issue.message));
  assert.ok(library.accessIssues.some((issue) => issue.area === "samples" && issue.path?.endsWith("bad-json.json") && issue.message));
  assert.ok(library.accessIssues.some((issue) => issue.area === "evals" && issue.path?.endsWith("bad-json.json") && issue.message));
});

test("buildLearningLibrary skips event records that fail public display mapping", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-event-issue-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(path.join(learningDir, "events.jsonl"), [
    JSON.stringify({
      eventId: "event-good",
      internalStatus: "received",
      jobStatus: "waiting",
      summary: "good event",
      createdAt: "2026-07-04T12:00:00.000Z",
      updatedAt: "2026-07-04T12:00:00.000Z",
    }),
    JSON.stringify({
      eventId: "event-bad-proof",
      internalStatus: "landed",
      jobStatus: "completed",
      landingType: "formal-skill",
      ruleId: "rule-bad-proof",
      summary: "bad proof event",
      generationProof: {
        proofStatus: "not_applicable",
        claimText: "bad combination",
      },
      createdAt: "2026-07-04T12:01:00.000Z",
      updatedAt: "2026-07-04T12:01:00.000Z",
    }),
  ].join("\n"), "utf8");

  const library = await buildLearningLibrary(root);

  assert.ok(library.records.some((record) => record.recordId === "event:event-good"));
  assert.equal(library.records.some((record) => record.recordId === "rule:rule-bad-proof"), false);
  assert.ok(library.accessIssues.some((issue) =>
    issue.area === "events" &&
    issue.eventId === "event-bad-proof" &&
    issue.message
  ));
});

test("buildLearningLibrary assigns stable prefixed record ids for every learning item kind", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-record-ids-"));
  await fsp.mkdir(path.join(root, "learning", "evidence"), { recursive: true });
  await fsp.mkdir(path.join(root, "learning", "samples"), { recursive: true });
  await fsp.mkdir(path.join(root, "skills", "99-test", "skill-record"), { recursive: true });
  await fsp.writeFile(path.join(root, "skills", "99-test", "skill-record", "SKILL.md"), "# Test skill\n", "utf8");
  await fsp.writeFile(path.join(root, "learning", "evidence", "evidence-record.json"), JSON.stringify({
    evidenceId: "evidence-record",
    summary: "evidence",
    createdAt: "2026-07-04T00:03:00.000Z",
  }), "utf8");
  await fsp.writeFile(path.join(root, "learning", "samples", "sample-record.json"), JSON.stringify({
    sampleId: "sample-record",
    summary: "sample",
    createdAt: "2026-07-04T00:04:00.000Z",
  }), "utf8");
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning", "current-ruleset.json"), JSON.stringify({
    version: 1,
    lastGoodVersion: 1,
    updatedAt: "2026-07-04T00:00:00.000Z",
    rules: [{
      ruleId: "rule-record",
      topicKey: "storyboard.general",
      conflictKey: "storyboard.general",
      capability: "storyboard",
      content: "rule content",
      priority: 50,
      sourceEventIds: ["event-rule"],
      status: "active",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }],
  }), "utf8");
  await fsp.writeFile(path.join(root, "learning", "events.jsonl"), [
    JSON.stringify({
      eventId: "event-rule",
      landingType: "current-rule",
      ruleId: "rule-record",
      topicKey: "storyboard.general",
      sourceEventIds: ["event-rule"],
      internalStatus: "landed",
      jobStatus: "completed",
      summary: "rule event",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }),
    JSON.stringify({
      eventId: "event-eval",
      landingType: "eval",
      evalTaskId: "eval-task-record",
      internalStatus: "landed",
      jobStatus: "completed",
      summary: "eval task",
      createdAt: "2026-07-04T00:01:00.000Z",
      updatedAt: "2026-07-04T00:01:00.000Z",
    }),
    JSON.stringify({
      eventId: "event-eval-result",
      landingType: "eval-result",
      evalResultId: "eval-result-record",
      internalStatus: "landed",
      jobStatus: "completed",
      summary: "eval result",
      createdAt: "2026-07-04T00:02:00.000Z",
      updatedAt: "2026-07-04T00:02:00.000Z",
    }),
    JSON.stringify({
      eventId: "event-record",
      internalStatus: "received",
      jobStatus: "waiting",
      summary: "ordinary event",
      createdAt: "2026-07-04T00:05:00.000Z",
      updatedAt: "2026-07-04T00:05:00.000Z",
    }),
  ].join("\n"), "utf8");

  const library = await buildLearningLibrary(root);
  const ids = new Set([
    ...library.records.map((item) => item.recordId),
    ...library.impactItems.map((item) => item.recordId),
    ...library.sampleItems.map((item) => item.recordId),
    ...library.evalItems.map((item) => item.recordId),
    ...library.skillItems.map((item) => item.recordId),
  ]);

  for (const expected of [
    "rule:rule-record",
    "sample:sample-record",
    "evidence:evidence-record",
    "eval:eval-task-record",
    "eval-result:eval-result-record",
    "skill:skill-record",
    "event:event-record",
  ]) {
    assert.ok(ids.has(expected), `${expected} should exist`);
  }
  for (const prefix of ["rule:", "sample:", "evidence:", "eval:", "eval-result:", "skill:", "event:"]) {
    assert.equal(Array.from(ids).includes(prefix), false, `${prefix} should not be emitted without an id`);
  }
  for (const listName of ["impactItems", "sampleItems", "evalItems", "skillItems"]) {
    assertNoDuplicateRecordIds(library[listName], listName);
  }
  assert.strictEqual(library.impactItems.filter((item) => item.recordId === "rule:rule-record").length, 0);
  const impactRule = library.records.find((item) => item.recordId === "rule:rule-record");
  for (const internalField of ["topicKey", "conflictKey", "sourceEventIds", "ruleId"]) {
    assert.equal(Object.hasOwn(impactRule, internalField), false);
  }
  assert.strictEqual(impactRule.affectsGeneration, false);
  assert.match(impactRule.generationImpactText, /正式技能/);
  assert.strictEqual(impactRule.advanced.ruleId, "rule-record");
  assert.strictEqual(impactRule.advanced.topicKey, "storyboard.general");
  assert.deepStrictEqual(impactRule.advanced.sourceEventIds, ["event-rule"]);
});

test("buildLearningLibrary returns available data and accessIssues when optional library areas fail", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-access-issues-"));
  await fsp.mkdir(path.join(root, "learning"), { recursive: true });
  await fsp.writeFile(path.join(root, "learning", "events.jsonl"), JSON.stringify({
    eventId: "event-kept",
    internalStatus: "received",
    jobStatus: "waiting",
    summary: "kept",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  }) + "\n", "utf8");
  await fsp.writeFile(path.join(root, "learning", "samples"), "not a directory", "utf8");
  await fsp.writeFile(path.join(root, "learning", "evidence"), "not a directory", "utf8");
  await fsp.writeFile(path.join(root, "learning", "evals"), "not a directory", "utf8");
  await fsp.writeFile(path.join(root, "skills"), "not a directory", "utf8");

  const library = await buildLearningLibrary(root);

  assert.ok(library.records.some((record) => record.recordId === "event:event-kept"));
  assert.ok(library.accessIssues.length >= 4);
  assert.ok(library.accessIssues.every((issue) => issue.area && issue.message));
  assert.ok(library.accessIssues.some((issue) => issue.area === "samples"));
  assert.ok(library.accessIssues.some((issue) => issue.area === "evidence"));
  assert.ok(library.accessIssues.some((issue) => issue.area === "evals"));
  assert.ok(library.accessIssues.some((issue) => issue.area === "skills"));
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
  const record = library.records.find((item) => item.recordId === "event:archive-evidence-failed-canvas-1");

  assert.ok(record);
  assert.strictEqual(record.displayStatus, "失败");
  assert.strictEqual(record.affectsGeneration, false);
  assert.strictEqual(record.generationProof.proofStatus, "failed");
  assert.strictEqual(record.learnedText, "画布已归档，学习证据生成失败");
  assert.strictEqual(record.advanced.error.stage, "write-learning-evidence");
});

test("buildLearningLibrary disables correction action when a record has no primary locator", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-library-correction-disabled-"));
  const learningDir = path.join(root, "learning");
  await fsp.mkdir(learningDir, { recursive: true });
  await fsp.writeFile(
    path.join(learningDir, "events.jsonl"),
    JSON.stringify({
      eventId: "event-context-only",
      internalStatus: "received",
      jobStatus: "waiting",
      learningMode: "uncertain",
      sourceType: "conversation",
      projectId: "project-context",
      canvasId: "canvas-context",
      conversationId: "chat-context",
      topicKey: "storyboard.general",
      conflictKey: "storyboard.general",
      summary: "上下文足够展示，但纠错测试会移除主定位",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }) + "\n",
    "utf8",
  );

  const { buildCorrectionAction } = require("./learningCorrection");
  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === "event:event-context-only");
  const disabled = buildCorrectionAction({
    advanced: {
      projectId: record.advanced.projectId,
      canvasId: record.advanced.canvasId,
      conversationId: record.advanced.conversationId,
      topicKey: record.advanced.topicKey,
      conflictKey: record.advanced.conflictKey,
      learningMode: record.advanced.learningMode,
    },
  });

  assert.strictEqual(record.correctionAction.enabled, true);
  assert.strictEqual(disabled.enabled, false);
  assert.match(disabled.disabledReason, /需要你补充是哪条记录/);
});
