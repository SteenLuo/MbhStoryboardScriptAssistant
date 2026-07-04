const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { appendLearningEvent, listLearningEvents } = require("./autonomousLearning");

async function writeLearningEvidence(root, input = {}) {
  const canvas = input.canvas && typeof input.canvas === "object" ? input.canvas : {};
  const canvasId = normalizeString(input.canvasId || canvas.id);
  const outputId = normalizeString(input.outputId || canvas.outputId);
  const archivedAt = normalizeString(input.archivedAt || canvas.archivedAt);
  const createdAt = normalizeString(input.createdAt) || new Date().toISOString();
  const sourceEventIds = collectSourceEventIds(input, canvas);
  const finalNodeIds = resolveFinalNodeIds(input, canvas);
  const finalVersions = buildFinalVersions(canvas, finalNodeIds);

  const evidenceId = buildStableId("evidence", {
    canvasId,
    outputId,
    archivedAt,
    sourceEventIds,
    finalNodeIds,
  });
  const record = {
    evidenceId,
    canvasId,
    outputId,
    createdAt,
    archivedAt,
    finalNodeIds,
    finalVersions,
    acceptanceSignal: {
      sourceType: "archive",
      accepted: true,
      signal: "canvas-archived",
      archivedAt,
    },
    sourceEventIds,
    topicKey: normalizeString(input.topicKey),
    conflictKey: normalizeString(input.conflictKey || input.topicKey),
    evidenceType: normalizeString(input.evidenceType || input.neededSampleType),
    relatedTaskId: normalizeString(input.relatedTaskId),
    relatedRecordIds: normalizeStringArray(input.relatedRecordIds),
    location: {
      canvasId,
      outputId,
      sourceType: "archive",
    },
  };

  const filePath = path.join(root, "learning", "evidence", `${evidenceId}.json`);
  await writeJson(filePath, record);
  await safeRefreshSampleInsufficientTasks(root, { ...record, recordId: `evidence:${evidenceId}`, materialKind: "evidence" });
  return { evidenceId, path: filePath, sourceEventIds, canvasId, outputId };
}

async function writeLearningSample(root, input = {}) {
  const canvasId = normalizeString(input.canvasId);
  const outputId = normalizeString(input.outputId);
  const sourceEventIds = normalizeStringArray(input.sourceEventIds);
  const createdAt = normalizeString(input.createdAt) || new Date().toISOString();
  const summary = normalizeString(input.summary);
  const content = normalizeString(input.content);
  const sampleId = buildStableId("sample", {
    canvasId,
    outputId,
    summary,
    content,
    sourceEventIds,
  });
  const record = {
    sampleId,
    summary,
    content,
    sourceEventIds,
    createdAt,
    affectsGeneration: false,
    topicKey: normalizeString(input.topicKey),
    conflictKey: normalizeString(input.conflictKey || input.topicKey),
    sampleType: normalizeString(input.sampleType || input.neededSampleType),
    relatedTaskId: normalizeString(input.relatedTaskId),
    relatedRecordIds: normalizeStringArray(input.relatedRecordIds),
    canvasId,
    outputId,
    location: {
      canvasId,
      outputId,
      sourceType: normalizeString(input.sourceType) || "sample",
    },
  };

  const filePath = path.join(root, "learning", "samples", `${sampleId}.json`);
  await writeJson(filePath, record);
  await safeRefreshSampleInsufficientTasks(root, { ...record, recordId: `sample:${sampleId}`, materialKind: "sample" });
  return { sampleId, path: filePath, sourceEventIds };
}

async function recordArchiveLearningEvidence(root, input = {}, deps = {}) {
  const writeEvidence = deps.writeLearningEvidence || writeLearningEvidence;
  const appendEvent = deps.appendLearningEvent || appendLearningEvent;
  const now = deps.now || (() => new Date().toISOString());
  const canvas = input.canvas && typeof input.canvas === "object" ? input.canvas : {};
  try {
    return {
      status: "saved",
      ...(await writeEvidence(root, {
        ...input,
        canvas,
      })),
    };
  } catch (error) {
    const summary = "画布已归档，学习证据生成失败";
    const failedAt = now();
    const result = {
      status: "failed",
      warning: summary,
      error: {
        stage: "write-learning-evidence",
        message: error.message || String(error),
      },
    };
    try {
      await appendEvent(root, {
        eventId: archiveEvidenceFailureEventId(canvas.id, input.archivedAt || canvas.archivedAt || failedAt),
        internalStatus: "failed",
        jobStatus: "failed",
        learningMode: "evidence",
        sourceType: "archive",
        canvasId: normalizeString(canvas.id),
        outputId: normalizeString(input.outputId),
        sourceEventIds: normalizeStringArray(input.sourceEventIds),
        summary,
        error: result.error,
        createdAt: failedAt,
        updatedAt: failedAt,
      });
    } catch (eventError) {
      result.eventWarning = eventError.message || String(eventError);
    }
    return result;
  }
}

function collectSourceEventIds(input, canvas) {
  const ids = new Set(normalizeStringArray(input.sourceEventIds));
  for (const node of Array.isArray(canvas.nodes) ? canvas.nodes : []) {
    for (const rule of Array.isArray(node?.meta?.currentRulesUsed) ? node.meta.currentRulesUsed : []) {
      for (const id of normalizeStringArray(rule?.sourceEventIds)) ids.add(id);
    }
    for (const version of Array.isArray(node?.meta?.versions) ? node.meta.versions : []) {
      for (const rule of Array.isArray(version?.currentRulesUsed) ? version.currentRulesUsed : []) {
        for (const id of normalizeStringArray(rule?.sourceEventIds)) ids.add(id);
      }
    }
  }
  return Array.from(ids).sort();
}

function resolveFinalNodeIds(input, canvas) {
  const finalNodeIds = input.finalNodeIds ||
    input.archiveCheck?.readiness?.finalNodeIds ||
    canvas.archiveReadiness?.readiness?.finalNodeIds ||
    {};
  return {
    novel: normalizeStringArray(finalNodeIds.novel),
    script: normalizeStringArray(finalNodeIds.script),
    storyboard: normalizeStringArray(finalNodeIds.storyboard),
  };
}

function buildFinalVersions(canvas, finalNodeIds) {
  const ids = new Set(Object.values(finalNodeIds).flat());
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  const selected = ids.size
    ? nodes.filter((node) => ids.has(normalizeString(node?.id)))
    : nodes.filter((node) => ["novel", "script", "storyboard"].includes(node?.type));
  return selected.map(publicFinalVersion);
}

function publicFinalVersion(node = {}) {
  const meta = node.meta && typeof node.meta === "object" ? node.meta : {};
  return compactObject({
    nodeId: normalizeString(node.id),
    type: normalizeString(node.type),
    title: normalizeString(node.title),
    contentLength: String(node.content || "").length,
    contentHash: hashValue(String(node.content || "")),
    variantKind: normalizeString(meta.variantKind),
    generatedAt: normalizeString(meta.generatedAt),
    revisedAt: normalizeString(meta.revisedAt),
    model: normalizeString(meta.model),
    episodeNumber: normalizeString(meta.episodeNumber),
    sourceNodeId: normalizeString(meta.sourceNodeId),
    parentNodeId: normalizeString(meta.parentNodeId),
    primaryVersionId: normalizeString(meta.primaryVersionId),
    versionIds: normalizeStringArray(meta.versionIds),
    versions: Array.isArray(meta.versions) ? meta.versions.map(publicVersionInfo) : [],
  });
}

function publicVersionInfo(version = {}) {
  return compactObject({
    id: normalizeString(version.id || version.versionId),
    nodeId: normalizeString(version.nodeId),
    type: normalizeString(version.type),
    title: normalizeString(version.title),
    parentNodeId: normalizeString(version.parentNodeId),
    sourceKind: normalizeString(version.sourceKind),
    createdAt: normalizeString(version.createdAt),
    isPrimary: Boolean(version.isPrimary),
  });
}

async function safeRefreshSampleInsufficientTasks(root, material = {}) {
  try {
    await refreshSampleInsufficientTasks(root, material);
  } catch {
    // Evidence/sample writes are primary. Re-eval bookkeeping must not block them.
  }
}

async function refreshSampleInsufficientTasks(root, material = {}) {
  const topicKey = normalizeString(material.topicKey);
  const conflictKey = normalizeString(material.conflictKey || topicKey);
  if (!topicKey && !conflictKey) return [];
  const events = await listLearningEvents(root, { includeCovered: true });
  const tasks = events.filter((event) =>
    event?.landingType === "sample-insufficient" &&
    event.internalStatus !== "failed" &&
    event.internalStatus !== "covered" &&
    event.jobStatus === "waiting" &&
    isSameTopicOrConflict(event, topicKey, conflictKey)
  );
  if (!tasks.length) return [];

  const materialRecords = await listLearningMaterialRecords(root);
  const updates = [];
  for (const task of tasks) {
    const matched = materialRecords.filter((record) =>
      isSameTopicOrConflict(record, task.topicKey, task.conflictKey) &&
      matchesSampleNeed(task, record)
    );
    const neededCount = Number(task.neededCount || 0);
    if (!neededCount || matched.length < neededCount) continue;
    const sampleRecordIds = matched.filter((record) => record.materialKind === "sample").map((record) => record.recordId);
    const evidenceRecordIds = matched.filter((record) => record.materialKind === "evidence").map((record) => record.recordId);
    const updatedAt = new Date().toISOString();
    const update = {
      ...task,
      internalStatus: "landed",
      jobStatus: "completed",
      learningMode: "evidence",
      landingType: "eval",
      affectsGeneration: false,
      sampleCount: matched.length,
      sampleRecordIds,
      evidenceRecordIds,
      reevaluationTaskId: `reeval-${task.eventId}`,
      summary: task.summary || "Sample count satisfied; re-evaluation task is ready.",
      generationProof: {
        proofStatus: "not_applicable",
        claimText: "样例已补齐并生成可追溯评测状态，不会直接影响生成。",
      },
      updatedAt,
    };
    await appendLearningEvent(root, update);
    updates.push(update);
  }
  return updates;
}

async function listLearningMaterialRecords(root) {
  const [samples, evidence] = await Promise.all([
    readMaterialRecords(path.join(root, "learning", "samples"), "sampleId", "sample"),
    readMaterialRecords(path.join(root, "learning", "evidence"), "evidenceId", "evidence"),
  ]);
  return [...samples, ...evidence];
}

async function readMaterialRecords(dir, idField, materialKind) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const records = [];
    for (const entry of entries) {
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") continue;
      try {
        const parsed = JSON.parse(await fsp.readFile(path.join(dir, entry.name), "utf8"));
        const id = normalizeString(parsed[idField]);
        if (!id) continue;
        records.push({
          ...parsed,
          materialKind,
          recordId: `${materialKind}:${id}`,
          topicKey: normalizeString(parsed.topicKey),
          conflictKey: normalizeString(parsed.conflictKey || parsed.topicKey),
          sampleType: normalizeString(parsed.sampleType),
          evidenceType: normalizeString(parsed.evidenceType),
          relatedTaskId: normalizeString(parsed.relatedTaskId),
          relatedRecordIds: normalizeStringArray(parsed.relatedRecordIds),
        });
      } catch {
        continue;
      }
    }
    return records;
  } catch {
    return [];
  }
}

function matchesSampleNeed(task = {}, record = {}) {
  const taskId = normalizeString(task.eventId);
  const neededSampleType = normalizeString(task.neededSampleType);
  const recordType = normalizeString(record.sampleType || record.evidenceType);
  const relatedRecordIds = new Set(normalizeStringArray(task.relatedRecordIds));
  if (normalizeString(record.relatedTaskId) && normalizeString(record.relatedTaskId) === taskId) return true;
  if (
    relatedRecordIds.has(normalizeString(record.recordId)) ||
    relatedRecordIds.has(normalizeString(record.sampleId)) ||
    relatedRecordIds.has(normalizeString(record.evidenceId))
  ) {
    return true;
  }
  if (!neededSampleType) return true;
  return recordType === neededSampleType;
}

function isSameTopicOrConflict(item, topicKey, conflictKey) {
  if (!item || typeof item !== "object") return false;
  const itemTopic = normalizeString(item.topicKey);
  const itemConflict = normalizeString(item.conflictKey || itemTopic);
  return Boolean(
    (topicKey && itemTopic === topicKey) ||
    (conflictKey && itemConflict === conflictKey)
  );
}

function buildStableId(prefix, payload) {
  const hash = hashValue(stableStringify(payload)).slice(0, 12);
  const canvasSegment = safeSegment(payload.canvasId, prefix);
  const outputSegment = safeSegment(payload.outputId || payload.archivedAt || payload.summary, "archive");
  return `${prefix}-${canvasSegment}-${outputSegment}-${hash}`;
}

function archiveEvidenceFailureEventId(canvasId, archivedAt) {
  const safeCanvasId = normalizeString(canvasId)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "canvas";
  const safeArchivedAt = normalizeString(archivedAt || Date.now())
    .replace(/[^0-9A-Za-z]+/g, "")
    .slice(0, 20) || String(Date.now());
  return `archive-evidence-failed-${safeCanvasId}-${safeArchivedAt}`;
}

function safeSegment(value, fallback) {
  const segment = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return segment || fallback;
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (Array.isArray(item)) return item.length > 0;
    return item !== "";
  }));
}

async function writeJson(filePath, record) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

module.exports = {
  recordArchiveLearningEvidence,
  writeLearningEvidence,
  writeLearningSample,
};
