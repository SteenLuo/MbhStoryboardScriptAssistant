const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildLearningLibrary } = require("./learningLibrary");
const { recordArchiveLearningEvidence, writeLearningEvidence, writeLearningSample } = require("./learningEvidence");

function sampleCanvas() {
  return {
    id: "canvas:demo/unsafe",
    title: "归档样例",
    archivedAt: "2026-07-04T08:00:00.000Z",
    archiveReadiness: {
      readiness: {
        finalNodeIds: {
          novel: ["novel-1"],
          script: ["script-final"],
          storyboard: ["storyboard-1"],
        },
      },
    },
    nodes: [
      { id: "novel-1", type: "novel", title: "小说", content: "原文", meta: {} },
      {
        id: "script-final",
        type: "script",
        title: "最终剧本",
        content: "剧本正文",
        meta: {
          variantKind: "merged",
          primaryVersionId: "v2",
          versions: [
            { id: "v1", nodeId: "script-a", title: "剧本 A" },
            { id: "v2", nodeId: "script-b", title: "剧本 B", isPrimary: true },
          ],
          currentRulesUsed: [{ ruleId: "rule-1", sourceEventIds: ["event-rule"] }],
        },
      },
      {
        id: "storyboard-1",
        type: "storyboard",
        title: "第 1 集分镜",
        content: "分镜正文",
        meta: {
          episodeNumber: 1,
          currentRulesUsed: [{ ruleId: "rule-2", sourceEventIds: ["event-storyboard"] }],
        },
      },
    ],
    edges: [],
  };
}

test("writeLearningEvidence saves a traceable evidence package with final versions and adoption signal", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-evidence-"));

  const result = await writeLearningEvidence(root, {
    canvas: sampleCanvas(),
    outputId: "output/final:1",
    sourceEventIds: ["event-manual"],
    createdAt: "2026-07-04T08:01:00.000Z",
  });

  assert.match(result.evidenceId, /^evidence-canvas-demo-unsafe-output-final-1-[a-f0-9]{12}$/);
  assert.ok(!/[\\/:*?"<>|]/.test(path.basename(result.path)));
  assert.strictEqual(result.canvasId, "canvas:demo/unsafe");
  assert.strictEqual(result.outputId, "output/final:1");
  assert.deepStrictEqual(result.sourceEventIds.sort(), ["event-manual", "event-rule", "event-storyboard"]);

  const saved = JSON.parse(await fsp.readFile(result.path, "utf8"));
  assert.strictEqual(saved.evidenceId, result.evidenceId);
  assert.strictEqual(saved.canvasId, "canvas:demo/unsafe");
  assert.strictEqual(saved.outputId, "output/final:1");
  assert.strictEqual(saved.createdAt, "2026-07-04T08:01:00.000Z");
  assert.strictEqual(saved.archivedAt, "2026-07-04T08:00:00.000Z");
  assert.deepStrictEqual(saved.acceptanceSignal, {
    sourceType: "archive",
    accepted: true,
    signal: "canvas-archived",
    archivedAt: "2026-07-04T08:00:00.000Z",
  });
  assert.deepStrictEqual(saved.location, {
    canvasId: "canvas:demo/unsafe",
    outputId: "output/final:1",
    sourceType: "archive",
  });
  assert.ok(saved.finalVersions.some((version) => version.nodeId === "script-final" && version.primaryVersionId === "v2"));
});

test("writeLearningSample saves a passive sample without affecting generation", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-learning-sample-"));

  const result = await writeLearningSample(root, {
    summary: "同一类分镜修正样例",
    content: "样例正文",
    canvasId: "canvas-1",
    outputId: "output-1",
    sourceEventIds: ["event-a"],
    createdAt: "2026-07-04T09:00:00.000Z",
  });

  assert.match(result.sampleId, /^sample-canvas-1-output-1-[a-f0-9]{12}$/);
  assert.strictEqual(result.sourceEventIds[0], "event-a");

  const saved = JSON.parse(await fsp.readFile(result.path, "utf8"));
  assert.strictEqual(saved.sampleId, result.sampleId);
  assert.strictEqual(saved.summary, "同一类分镜修正样例");
  assert.strictEqual(saved.content, "样例正文");
  assert.strictEqual(saved.affectsGeneration, false);
  assert.strictEqual(saved.location.canvasId, "canvas-1");
});

test("recordArchiveLearningEvidence returns a saved evidence id that the library can trace", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-archive-learning-evidence-"));

  const learningEvidence = await recordArchiveLearningEvidence(root, {
    canvas: sampleCanvas(),
    outputId: "output-final",
    sourceEventIds: ["event-archive"],
    createdAt: "2026-07-04T12:00:00.000Z",
  });
  const library = await buildLearningLibrary(root);
  const record = library.records.find((item) => item.recordId === `evidence:${learningEvidence.evidenceId}`);

  assert.strictEqual(learningEvidence.status, "saved");
  assert.ok(record);
  assert.strictEqual(record.advanced.evidenceId, learningEvidence.evidenceId);
  assert.strictEqual(record.affectsGeneration, false);
});

test("recordArchiveLearningEvidence appends a failed learning event without throwing", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-archive-learning-evidence-failure-"));

  const learningEvidence = await recordArchiveLearningEvidence(root, {
    canvas: { ...sampleCanvas(), id: "canvas-failed" },
    outputId: "output-final",
    createdAt: "2026-07-04T12:30:00.000Z",
  }, {
    writeLearningEvidence: async () => {
      throw new Error("simulated write failure");
    },
    now: () => "2026-07-04T12:31:00.000Z",
  });
  const library = await buildLearningLibrary(root);
  const failureRecord = library.records.find((item) => item.advanced.canvasId === "canvas-failed");

  assert.strictEqual(learningEvidence.status, "failed");
  assert.strictEqual(learningEvidence.warning, "画布已归档，学习证据生成失败");
  assert.strictEqual(learningEvidence.error.stage, "write-learning-evidence");
  assert.ok(failureRecord);
  assert.strictEqual(failureRecord.displayStatus, "失败");
  assert.strictEqual(failureRecord.learnedText, "画布已归档，学习证据生成失败");
  assert.strictEqual(failureRecord.advanced.error.message, "simulated write failure");
});
