const MAX_DIALOGUE_CHARS = 20;
const STORYBOARD_RATIO_MIN_PERCENT = 30;
const STORYBOARD_RATIO_MAX_PERCENT = 40;
const STORYBOARD_RATIO_MIN_SHOTS = 5;
const DIALOGUE_LINE_PATTERN = /^(\s*(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:(?:\*\*|__)\s*)?(?:台词|对白|dialogue)\s*[:：]\s*(?:(?:\*\*|__)\s*)?)(.+)$/i;
const SPEAKER_MARKER_PATTERN = /^((?:[（(][^）)]{1,20}[）)]\s*)?(?:(?:[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_-]{0,20}(?:OS|VO)?)|旁白|画外音|男声|女声)\s*[:：])\s*(.+)$/;
const FIELD_LINE_PATTERN = /^(\s*)(?:[-*+]\s*)?(?:#{1,6}\s*)?(?:(?:\*\*|__)\s*)?([^：:\n]{1,40})\s*[:：]\s*(?:(?:\*\*|__)\s*)?(.*)$/;
const STORYBOARD_FIELD_LABELS = new Set([
  "场次",
  "地点",
  "时间",
  "人物",
  "镜号",
  "画面内容与构图叙事",
  "景别",
  "运镜",
  "情绪/动作",
  "音效",
  "台词",
  "对白",
  "时长",
  "字幕",
]);
const STABLE_STORYBOARD_SKILL_RULES = [
  {
    ruleId: "stable-skill-storyboard-dialogue-length",
    topicKey: "storyboard.dialogue.length",
    conflictKey: "storyboard.dialogue.length.max-chars",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.length",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-single-speaker",
    topicKey: "storyboard.dialogue.speaker-count",
    conflictKey: "storyboard.dialogue.speaker-count.single-speaker",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.speaker-count",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-dialogue-line-count",
    topicKey: "storyboard.dialogue.line-count",
    conflictKey: "storyboard.dialogue.line-count.single-line",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.line-count",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-dialogue-speaker-marker",
    topicKey: "storyboard.dialogue.speaker-marker",
    conflictKey: "storyboard.dialogue.speaker-marker.required",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.speaker-marker",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-dialogue-fidelity",
    topicKey: "storyboard.dialogue.fidelity",
    conflictKey: "storyboard.dialogue.fidelity.source-exact",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.fidelity",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-dialogue-short-merge",
    topicKey: "storyboard.dialogue.short-merge",
    conflictKey: "storyboard.dialogue.short-merge.same-speaker-under-limit",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.short-merge",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-motion-ratio",
    topicKey: "storyboard.motion.ratio",
    conflictKey: "storyboard.motion.ratio.30-40",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.motion.ratio",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-motion-sequence",
    topicKey: "storyboard.motion.sequence",
    conflictKey: "storyboard.motion.sequence.max-two-moving",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.motion.sequence",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-front-flat-ratio",
    topicKey: "storyboard.composition.front-flat-ratio",
    conflictKey: "storyboard.composition.front-flat-ratio.30-40",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.composition.front-flat-ratio",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
  {
    ruleId: "stable-skill-storyboard-duplicate-composition",
    topicKey: "storyboard.composition.duplicate-sequence",
    conflictKey: "storyboard.composition.duplicate-sequence.no-same-visual",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.composition.duplicate-sequence",
    sourceEventIds: [],
    sourceFile: "skills/03-storyboard/storyboard-generate/SKILL.md",
    origin: "stable-skill",
  },
];

function validateStoryboardContent(content, options = {}) {
  const checkDialogueLength = options.checkDialogueLength === true;
  if (!checkDialogueLength) {
    return {
      ok: true,
      issues: [],
    };
  }
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  const lines = String(content || "").split(/\r?\n/);
  const issues = [];
  lines.forEach((line, index) => {
    const parsedLine = parseDialogueLine(line);
    if (!parsedLine) return;
    const dialogue = trimDialogueQuotes(parsedLine.body);
    if (displayLength(dialogue) <= maxChars) return;
    issues.push({
      type: "dialogue-too-long",
      severity: "error",
      lineNumber: index + 1,
      lineText: line,
      dialogue,
      message: `台词超过 ${maxChars} 字，需拆成新的连续镜号。`,
      suggestedLines: splitDialogueLine(dialogue, maxChars),
    });
  });
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardHardRules(content, options = {}) {
  const appliedRules = getStoryboardValidationRules(options);
  if (!appliedRules.length) {
    return {
      ok: true,
      issues: [],
      appliedRules,
      checked: false,
    };
  }

  const issues = [];
  const ruleGroups = groupRulesByHardRuleId(appliedRules);
  if (ruleGroups.has("storyboard.dialogue.length")) {
    const rules = ruleGroups.get("storyboard.dialogue.length");
    const validation = validateStoryboardContent(content, { ...options, checkDialogueLength: true });
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.length"));
  }
  if (ruleGroups.has("storyboard.dialogue.speaker-count")) {
    const rules = ruleGroups.get("storyboard.dialogue.speaker-count");
    const validation = validateStoryboardSpeakerCount(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.speaker-count"));
  }
  if (ruleGroups.has("storyboard.dialogue.line-count")) {
    const rules = ruleGroups.get("storyboard.dialogue.line-count");
    const validation = validateStoryboardDialogueLineCount(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.line-count"));
  }
  if (ruleGroups.has("storyboard.dialogue.speaker-marker")) {
    const rules = ruleGroups.get("storyboard.dialogue.speaker-marker");
    const validation = validateStoryboardDialogueSpeakerMarker(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.speaker-marker"));
  }
  if (ruleGroups.has("storyboard.dialogue.fidelity")) {
    const rules = ruleGroups.get("storyboard.dialogue.fidelity");
    const validation = validateStoryboardDialogueFidelity(content, options.sourceScript);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.fidelity"));
  }
  if (ruleGroups.has("storyboard.dialogue.short-merge")) {
    const rules = ruleGroups.get("storyboard.dialogue.short-merge");
    const validation = validateStoryboardShortDialogueMerge(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.short-merge"));
  }
  if (ruleGroups.has("storyboard.motion.ratio")) {
    const rules = ruleGroups.get("storyboard.motion.ratio");
    const validation = validateStoryboardMotionRatio(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.motion.ratio"));
  }
  if (ruleGroups.has("storyboard.motion.sequence")) {
    const rules = ruleGroups.get("storyboard.motion.sequence");
    const validation = validateStoryboardMotionSequence(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.motion.sequence"));
  }
  if (ruleGroups.has("storyboard.composition.front-flat-ratio")) {
    const rules = ruleGroups.get("storyboard.composition.front-flat-ratio");
    const validation = validateStoryboardFrontFlatRatio(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.composition.front-flat-ratio"));
  }
  if (ruleGroups.has("storyboard.composition.duplicate-sequence")) {
    const rules = ruleGroups.get("storyboard.composition.duplicate-sequence");
    const validation = validateStoryboardDuplicateComposition(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.composition.duplicate-sequence"));
  }
  return {
    ok: issues.length === 0,
    issues,
    appliedRules,
    checked: true,
  };
}

function getStoryboardValidationRules(options = {}) {
  return options.useStableSkillRules === true ? getStableStoryboardSkillRules() : [];
}

function getStableStoryboardSkillRules() {
  return STABLE_STORYBOARD_SKILL_RULES.map((rule) => ({
    ...rule,
    sourceEventIds: [...rule.sourceEventIds],
  }));
}

function applyStoryboardHardRuleValidation(content, options = {}) {
  const normalizedContent = normalizeStoryboardFieldLabels(content);
  const initial = validateStoryboardHardRules(normalizedContent, options);
  if (!initial.checked || initial.ok) {
    return {
      content: normalizedContent,
      validation: initial.checked ? initial : validateStoryboardContent(normalizedContent, options),
      hardRuleValidation: {
        checked: initial.checked,
        repaired: false,
        finalOk: initial.ok,
        appliedRules: initial.appliedRules,
        initialIssues: initial.issues,
        finalIssues: initial.issues,
      },
    };
  }

  let repairedContent = normalizedContent;
  const repairStrategies = [];
  const dialogueRepair = repairStoryboardDialogueIssues(repairedContent, initial.issues, options);
  if (dialogueRepair.repaired) {
    repairedContent = dialogueRepair.content;
    repairStrategies.push(dialogueRepair.strategy || "split-long-dialogue-into-continuous-shots");
  }

  const afterDialogue = repairStrategies.length
    ? validateStoryboardHardRules(repairedContent, options)
    : initial;
  const balanceRepair = repairStoryboardShotBalanceIssues(repairedContent, afterDialogue.issues);
  if (balanceRepair.repaired) {
    repairedContent = balanceRepair.content;
    repairStrategies.push(balanceRepair.strategy || "rebalance-shot-motion-and-front-flat-ratios");
  }

  if (repairStrategies.length) {
    const finalValidation = validateStoryboardHardRules(repairedContent, options);
    return {
      content: repairedContent,
      validation: finalValidation,
      hardRuleValidation: {
        checked: true,
        repaired: true,
        repairStrategy: repairStrategies.join("+"),
        finalOk: finalValidation.ok,
        appliedRules: initial.appliedRules,
        initialIssues: initial.issues,
        finalIssues: finalValidation.issues,
      },
    };
  }

  return {
    content: normalizedContent,
    validation: initial,
    hardRuleValidation: {
      checked: true,
      repaired: false,
      repairStrategy: "",
      finalOk: initial.ok,
      appliedRules: initial.appliedRules,
      initialIssues: initial.issues,
      finalIssues: initial.issues,
    },
  };
}

function validateStoryboardDialogueLineCount(content) {
  const shots = parseStoryboardShots(content);
  const issues = [];
  for (const shot of shots) {
    const dialogueLines = shot.lines.filter((line) => parseDialogueLine(line.text));
    if (dialogueLines.length <= 1) continue;
    issues.push({
      type: "dialogue-too-many-lines",
      severity: "error",
      lineNumber: dialogueLines[1]?.lineNumber || shot.lineNumber,
      shotNumber: shot.shotNumber,
      dialogueLineCount: dialogueLines.length,
      message: `同一个镜号只能有一行台词字段，当前镜号出现 ${dialogueLines.length} 行。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardSpeakerCount(content) {
  const shots = parseStoryboardShots(content);
  const issues = [];
  for (const shot of shots) {
    const speakers = new Map();
    let firstDialogueLineNumber = 0;
    for (const line of shot.lines) {
      const parsedLine = parseDialogueLine(line.text);
      if (!parsedLine) continue;
      const dialogue = trimDialogueQuotes(parsedLine.body);
      if (isEmptyDialogue(dialogue)) continue;
      if (!firstDialogueLineNumber) firstDialogueLineNumber = line.lineNumber;
      const speakerName = normalizeSpeakerName(parsedLine.speakerMarker);
      if (speakerName) speakers.set(speakerName, speakerName);
      for (const embeddedSpeaker of extractEmbeddedSpeakerNames(dialogue, shot.sceneSpeakers)) {
        speakers.set(embeddedSpeaker, embeddedSpeaker);
      }
    }
    if (speakers.size <= 1) continue;
    const speakerList = Array.from(speakers.values());
    issues.push({
      type: "dialogue-multiple-speakers",
      severity: "error",
      lineNumber: firstDialogueLineNumber || shot.lineNumber,
      shotNumber: shot.shotNumber,
      speakers: speakerList,
      message: `同一个镜号只允许一个说话人，当前镜号出现：${speakerList.join("、")}。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardDialogueSpeakerMarker(content) {
  const shots = parseStoryboardShots(content);
  const issues = [];
  for (const shot of shots) {
    for (const line of shot.lines || []) {
      const parsedLine = parseDialogueLine(line.text);
      if (!parsedLine) continue;
      const dialogue = trimDialogueQuotes(parsedLine.body);
      if (isEmptyDialogue(dialogue)) continue;
      const speakerName = normalizeSpeakerName(parsedLine.speakerMarker);
      if (speakerName && !STORYBOARD_FIELD_LABELS.has(speakerName)) continue;
      issues.push({
        type: "dialogue-missing-speaker-marker",
        severity: "error",
        lineNumber: line.lineNumber,
        shotNumber: shot.shotNumber,
        lineText: line.text,
        dialogue,
        message: "台词字段必须在内容前标注说话人或声音来源，例如：台词：陈建军：秀娥，你今天真好看。",
      });
    }
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardDialogueFidelity(content, sourceScript = "") {
  const sourceIndex = buildSourceDialogueIndex(sourceScript);
  if (!sourceIndex.hasSource) {
    return {
      ok: true,
      issues: [],
    };
  }

  const issues = [];
  const shots = parseStoryboardShots(content);
  for (const shot of shots) {
    for (const line of shot.lines) {
      const parsedLine = parseDialogueLine(line.text);
      if (!parsedLine) continue;
      const dialogue = trimDialogueQuotes(parsedLine.body);
      if (isEmptyDialogue(dialogue)) continue;
      const speakerName = normalizeSpeakerName(parsedLine.speakerMarker);
      if (!speakerName || isNonCharacterSpeaker(speakerName)) continue;
      const normalizedDialogue = normalizeDialogueFidelityText(dialogue);
      if (!normalizedDialogue) continue;
      if (sourceDialogueContains(sourceIndex, speakerName, normalizedDialogue)) continue;
      issues.push({
        type: "dialogue-not-source-exact",
        severity: "error",
        lineNumber: line.lineNumber,
        shotNumber: shot.shotNumber,
        lineText: line.text,
        speaker: speakerName,
        dialogue,
        message: `人物台词不是剧本原句或原句切段：${speakerName}。`,
      });
    }
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardShortDialogueMerge(content, maxChars = MAX_DIALOGUE_CHARS) {
  const shots = parseStoryboardShots(content).filter((shot) => shot.shotNumber);
  const issues = [];
  for (let index = 1; index < shots.length; index += 1) {
    const previousShot = shots[index - 1];
    const currentShot = shots[index];
    if (hasSceneBoundaryBeforeNextShot(previousShot)) continue;
    const previousDialogue = shotDialogueEntry(previousShot);
    const currentDialogue = shotDialogueEntry(currentShot);
    if (!previousDialogue || !currentDialogue) continue;
    if (previousDialogue.speaker !== currentDialogue.speaker) continue;
    const combinedDialogue = `${previousDialogue.dialogue}${currentDialogue.dialogue}`;
    const combinedLength = displayLength(combinedDialogue);
    if (combinedLength > maxChars) continue;
    issues.push({
      type: "dialogue-short-same-speaker-split",
      severity: "error",
      lineNumber: currentDialogue.lineNumber,
      lineText: currentDialogue.lineText,
      previousShotNumber: previousShot.shotNumber,
      shotNumber: currentShot.shotNumber,
      speaker: currentDialogue.speaker,
      combinedDialogue,
      combinedLength,
      message: `同一说话人的连续短台词合并后不超过 ${maxChars} 字，不应拆成多个镜号。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardMotionRatio(content) {
  const profiles = storyboardShotProfiles(content);
  const totalShotCount = profiles.length;
  if (!shouldCheckRatio(totalShotCount)) return { ok: true, issues: [] };
  const dynamicShotCount = profiles.filter((shot) => shot.isMoving).length;
  const percent = ratioPercent(dynamicShotCount, totalShotCount);
  if (percent >= STORYBOARD_RATIO_MIN_PERCENT && percent <= STORYBOARD_RATIO_MAX_PERCENT) {
    return { ok: true, issues: [] };
  }
  return {
    ok: false,
    issues: [{
      type: "storyboard-motion-ratio-out-of-range",
      severity: "error",
      lineNumber: profiles[0]?.lineNumber || 1,
      dynamicShotCount,
      totalShotCount,
      percent,
      message: `运动镜头占比应在 ${STORYBOARD_RATIO_MIN_PERCENT}% 到 ${STORYBOARD_RATIO_MAX_PERCENT}% 之间，当前为 ${percent}%。`,
    }],
  };
}

function validateStoryboardMotionSequence(content) {
  const profiles = storyboardShotProfiles(content);
  const issues = [];
  let sequenceStart = null;
  let sequenceLength = 0;
  for (const shot of profiles) {
    if (shot.isMoving) {
      if (sequenceLength === 0) sequenceStart = shot;
      sequenceLength += 1;
      continue;
    }
    if (sequenceLength >= 3) {
      issues.push(movingSequenceIssue(sequenceStart, sequenceLength));
    }
    sequenceStart = null;
    sequenceLength = 0;
  }
  if (sequenceLength >= 3) {
    issues.push(movingSequenceIssue(sequenceStart, sequenceLength));
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function movingSequenceIssue(sequenceStart, sequenceLength) {
  return {
    type: "storyboard-motion-three-consecutive",
    severity: "error",
    lineNumber: sequenceStart?.lineNumber || 1,
    shotNumber: sequenceStart?.shotNumber || "",
    sequenceLength,
    message: `禁止出现连续 3 个及以上运动镜头，当前连续 ${sequenceLength} 个。`,
  };
}

function validateStoryboardFrontFlatRatio(content) {
  const profiles = storyboardShotProfiles(content);
  const totalShotCount = profiles.length;
  if (!shouldCheckRatio(totalShotCount)) return { ok: true, issues: [] };
  const frontFlatShotCount = profiles.filter((shot) => shot.isFrontFlat).length;
  const percent = ratioPercent(frontFlatShotCount, totalShotCount);
  if (percent >= STORYBOARD_RATIO_MIN_PERCENT && percent <= STORYBOARD_RATIO_MAX_PERCENT) {
    return { ok: true, issues: [] };
  }
  return {
    ok: false,
    issues: [{
      type: "storyboard-front-flat-ratio-out-of-range",
      severity: "error",
      lineNumber: profiles[0]?.lineNumber || 1,
      frontFlatShotCount,
      totalShotCount,
      percent,
      message: `正面平视镜头占比应在 ${STORYBOARD_RATIO_MIN_PERCENT}% 到 ${STORYBOARD_RATIO_MAX_PERCENT}% 之间，当前为 ${percent}%。`,
    }],
  };
}

function validateStoryboardDuplicateComposition(content) {
  const profiles = storyboardShotProfiles(content);
  const issues = [];
  let sameCompositionRunLength = 1;
  for (let index = 1; index < profiles.length; index += 1) {
    const previous = profiles[index - 1];
    const current = profiles[index];
    if (previous.sceneBoundaryBeforeNext || !sameShotComposition(previous, current)) {
      sameCompositionRunLength = 1;
      continue;
    }
    sameCompositionRunLength += 1;
    if (!isRepeatedSameVisualBeat(previous, current)) continue;
    issues.push({
      type: "storyboard-duplicate-composition-sequence",
      severity: "error",
      lineNumber: current.shotTypeLineNumber || current.lineNumber,
      previousShotNumber: previous.shotNumber,
      shotNumber: current.shotNumber,
      shotType: current.shotType,
      action: current.action,
      sequenceLength: sameCompositionRunLength,
      message: `连续镜号使用相同景别/角度/构图拍摄同一画面内容：${current.shotType}。请改用反打、过肩、近景/特写、手部/物品/反应镜头，或合并同一画面。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function shouldCheckRatio(totalShotCount) {
  return totalShotCount >= STORYBOARD_RATIO_MIN_SHOTS;
}

function storyboardShotProfiles(content) {
  return parseStoryboardShots(content)
    .filter((shot) => shot.shotNumber)
    .map((shot) => {
      const cameraField = storyboardShotField(shot, "运镜");
      const shotTypeField = storyboardShotField(shot, "景别");
      const actionField = storyboardShotField(shot, "情绪/动作") || storyboardShotField(shot, "画面内容与构图叙事");
      const camera = cameraField?.value || "";
      const shotType = shotTypeField?.value || "";
      return {
        shotNumber: shot.shotNumber,
        lineNumber: shot.lineNumber,
        cameraLineNumber: cameraField?.lineNumber || 0,
        shotTypeLineNumber: shotTypeField?.lineNumber || 0,
        camera,
        shotType,
        actionLineNumber: actionField?.lineNumber || 0,
        action: actionField?.value || "",
        sceneBoundaryBeforeNext: hasSceneBoundaryBeforeNextShot(shot),
        isMoving: isMovingCamera(camera),
        isFrontFlat: isFrontFlatShotType(shotType),
      };
    });
}

function storyboardShotFieldValue(shot, label) {
  return storyboardShotField(shot, label)?.value || "";
}

function storyboardShotField(shot, label) {
  for (const line of Array.isArray(shot?.lines) ? shot.lines : []) {
    const field = matchStoryboardFieldLine(line.text);
    if (field?.label === label) {
      return {
        ...field,
        lineNumber: line.lineNumber,
      };
    }
  }
  return null;
}

function isMovingCamera(camera) {
  const text = String(camera || "").trim();
  if (!text) return false;
  return !/固定/.test(text);
}

function isFrontFlatShotType(shotType) {
  const text = normalizeShotTypeText(shotType);
  if (!text) return false;
  if (/正三四|侧面|过肩|反打|前景|遮挡|仰|俯|低角度|高角度|地面|鸟瞰|背面|主观|第一人称/.test(text)) {
    return false;
  }
  if (/正面平视|平视正面/.test(text)) return true;
  if (/^(?:正面|平视)?(?:远景|全景|中景|中近景|近景|近特写|特写|面部特写)$/.test(text)) return true;
  return /^(?:远景|全景|中景|中近景|近景|近特写|特写|面部特写)$/.test(text);
}

function normalizeShotTypeText(shotType) {
  return String(shotType || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[()（）【】[\]：:，,。；;、]/g, "");
}

function sameShotComposition(previous, current) {
  const previousKey = normalizeShotCompositionKey(previous?.shotType);
  const currentKey = normalizeShotCompositionKey(current?.shotType);
  return Boolean(previousKey && currentKey && previousKey === currentKey);
}

function normalizeShotCompositionKey(shotType) {
  const text = normalizeShotTypeText(shotType);
  if (!text) return "";
  return text
    .replace(/^(?:正面平视|平视正面|正面|平视)+/, "")
    .replace(/(?:正面平视|平视正面|正面|平视)+$/, "");
}

function isRepeatedSameVisualBeat(previous, current) {
  const combinedAction = `${previous?.action || ""}\n${current?.action || ""}`;
  return hasSameVisualContinuationCue(combinedAction);
}

function hasSameVisualContinuationCue(text) {
  return /维持上一镜|维持前一镜|继续上一镜|继续前一镜|接上一镜|接前一镜|承接上一镜|承接前一镜|延续上一镜|延续前一镜|保持上一镜|保持前一镜|上一镜的构图|前一镜的构图|同一构图|相同构图|同样构图|同一景别|相同景别|同一机位|相同机位|机位不变|同一画面|相同画面|同样画面|画面不变/.test(String(text || ""));
}

function ratioPercent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function buildSourceDialogueIndex(sourceScript = "") {
  const bySpeaker = new Map();
  const unattributed = [];
  const all = [];
  const lines = String(sourceScript || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim().replace(/^△\s*/, "");
    if (!line) continue;
    const speakerMatch = line.match(/^([^：:\n]{1,24})[:：]\s*(.+)$/);
    if (speakerMatch) {
      const speakerName = normalizeSpeakerName(speakerMatch[1]);
      if (!speakerName || STORYBOARD_FIELD_LABELS.has(speakerName) || isNonCharacterSpeaker(speakerName)) continue;
      const normalizedText = normalizeDialogueFidelityText(speakerMatch[2]);
      if (!normalizedText) continue;
      if (!bySpeaker.has(speakerName)) bySpeaker.set(speakerName, []);
      bySpeaker.get(speakerName).push(normalizedText);
      all.push(normalizedText);
      continue;
    }
    const quoteMatch = line.match(/^[“"「『](.+?)[”"」』]?$/);
    if (quoteMatch) {
      const normalizedText = normalizeDialogueFidelityText(quoteMatch[1]);
      if (!normalizedText) continue;
      unattributed.push(normalizedText);
      all.push(normalizedText);
    }
  }
  return {
    bySpeaker,
    unattributed,
    all,
    hasSource: all.length > 0,
  };
}

function sourceDialogueContains(sourceIndex, speakerName, normalizedDialogue) {
  const sameSpeakerLines = sourceIndex.bySpeaker.get(speakerName) || [];
  if (sameSpeakerLines.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  if (sourceIndex.unattributed.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  if (!sameSpeakerLines.length && sourceIndex.all.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  return false;
}

function normalizeDialogueFidelityText(text) {
  return Array.from(String(text || "").normalize("NFKC"))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");
}

function isNonCharacterSpeaker(speakerName) {
  return /^(旁白|画外音|系统|系统音|男声|女声|VO|OS)$/i.test(String(speakerName || "").trim());
}

function shotDialogueEntry(shot) {
  const dialogueLines = (shot?.lines || []).filter((line) => parseDialogueLine(line.text));
  if (dialogueLines.length !== 1) return null;
  const dialogueLine = dialogueLines[0];
  const parsed = parseDialogueLine(dialogueLine.text);
  if (!parsed) return null;
  const dialogue = trimDialogueQuotes(parsed.body);
  if (isEmptyDialogue(dialogue)) return null;
  const speaker = normalizeSpeakerName(parsed.speakerMarker);
  if (!speaker || STORYBOARD_FIELD_LABELS.has(speaker) || isNonCharacterSpeaker(speaker)) return null;
  return {
    lineNumber: dialogueLine.lineNumber,
    lineText: dialogueLine.text,
    speaker,
    dialogue,
  };
}

function hasSceneBoundaryBeforeNextShot(shot) {
  return (shot?.lines || []).some((line) => {
    if (line.lineNumber === shot.lineNumber) return false;
    const text = String(line.text || "").trim();
    if (/^第[一二三四五六七八九十百千万\d]+集/.test(text)) return true;
    const field = matchStoryboardFieldLine(text);
    return ["场次", "地点", "时间", "人物"].includes(field?.label);
  });
}

function parseStoryboardShots(content) {
  const lines = String(content || "").split(/\r?\n/);
  const shots = [];
  let current = null;
  let sceneSpeakers = new Set();
  lines.forEach((line, index) => {
    const field = matchStoryboardFieldLine(line);
    if (field?.label === "人物") {
      sceneSpeakers = parseSceneSpeakers(field.value);
    }
    const shotNumber = parseShotNumberLine(line);
    if (shotNumber) {
      current = {
        shotNumber,
        lineNumber: index + 1,
        sceneSpeakers: new Set(sceneSpeakers),
        lines: [],
      };
      shots.push(current);
    }
    if (current) {
      current.lines.push({ lineNumber: index + 1, text: line });
    }
  });
  if (shots.length) return shots;
  return [{
    shotNumber: "",
    lineNumber: 1,
    lines: lines.map((line, index) => ({ lineNumber: index + 1, text: line })),
  }];
}

function parseShotNumberLine(line) {
  const field = matchStoryboardFieldLine(line);
  if (!field || field.label !== "镜号") return "";
  const match = field.value.match(/\d+/);
  return match ? match[0] : field.value.trim();
}

function normalizeStoryboardFieldLabels(content) {
  const normalizedLines = String(content || "")
    .split(/\r?\n/)
    .map(normalizeStoryboardFieldLabelLine);
  return stripNonStoryboardScaffolding(normalizedLines).join("\n").trim();
}

function normalizeStoryboardFieldLabelLine(line) {
  const field = matchStoryboardFieldLine(line);
  if (!field || !STORYBOARD_FIELD_LABELS.has(field.label)) return line;
  return `${field.indent}${field.label}：${field.value}`;
}

function stripNonStoryboardScaffolding(lines = []) {
  const withoutMarkdownChrome = lines.filter((line) =>
    !isMarkdownStoryboardHeading(line) && !isMarkdownSeparator(line)
  );
  const startIndex = withoutMarkdownChrome.findIndex(isStoryboardStartLine);
  if (startIndex <= 0) return withoutMarkdownChrome;
  return withoutMarkdownChrome.slice(startIndex);
}

function isMarkdownStoryboardHeading(line) {
  return /^\s*#{1,6}\s*第.+分镜/.test(String(line || "").trim());
}

function isMarkdownSeparator(line) {
  return /^\s*-{3,}\s*$/.test(String(line || ""));
}

function isStoryboardStartLine(line) {
  const field = matchStoryboardFieldLine(line);
  return !!field && ["场次", "地点", "时间", "人物", "镜号"].includes(field.label);
}

function repairStoryboardDialogueIssues(content, issues = [], options = {}) {
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  const repairableIssues = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue?.type === "dialogue-too-long");
  if (!repairableIssues.length) {
    return {
      content,
      repaired: false,
    };
  }
  const repaired = splitLongDialogueShots(content, maxChars);
  if (!repaired.changed) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: repaired.content,
    repaired: true,
    strategy: "split-long-dialogue-into-continuous-shots",
  };
}

function repairStoryboardShotBalanceIssues(content, issues = []) {
  const repairableTypes = new Set([
    "storyboard-motion-ratio-out-of-range",
    "storyboard-motion-three-consecutive",
    "storyboard-front-flat-ratio-out-of-range",
  ]);
  if (!(Array.isArray(issues) ? issues : []).some((issue) => repairableTypes.has(issue?.type))) {
    return {
      content,
      repaired: false,
    };
  }
  const lines = String(content || "").split(/\r?\n/);
  const motionChanged = repairStoryboardMotionBalanceLines(lines);
  const frontFlatChanged = repairStoryboardFrontFlatBalanceLines(lines);
  if (!motionChanged && !frontFlatChanged) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: lines.join("\n").trim(),
    repaired: true,
    strategy: [
      motionChanged ? "rebalance-motion-ratio-and-sequence" : "",
      frontFlatChanged ? "rebalance-front-flat-ratio" : "",
    ].filter(Boolean).join("+"),
  };
}

function repairStoryboardMotionBalanceLines(lines = []) {
  let changed = false;
  for (let attempt = 0; attempt < lines.length * 3; attempt += 1) {
    const profiles = storyboardShotProfiles(lines.join("\n"));
    const total = profiles.length;
    if (!shouldCheckRatio(total)) return changed;
    const minMoving = Math.ceil(total * STORYBOARD_RATIO_MIN_PERCENT / 100);
    const maxMoving = Math.floor(total * STORYBOARD_RATIO_MAX_PERCENT / 100);
    if (minMoving > maxMoving) return changed;
    const movingFlags = profiles.map((shot) => shot.isMoving);
    const currentMoving = movingFlags.filter(Boolean).length;
    const sequenceIndex = firstThreeMovingSequenceIndex(movingFlags);
    if (sequenceIndex >= 0) {
      if (!setShotFieldValue(lines, profiles[sequenceIndex], "运镜", "固定")) return changed;
      changed = true;
      continue;
    }
    if (currentMoving < minMoving) {
      const index = findFixedShotToMove(profiles, movingFlags);
      if (index < 0) return changed;
      if (!setShotFieldValue(lines, profiles[index], "运镜", motionCameraForIndex(index))) return changed;
      changed = true;
      continue;
    }
    if (currentMoving > maxMoving) {
      const index = findMovingShotToFix(profiles);
      if (index < 0) return changed;
      if (!setShotFieldValue(lines, profiles[index], "运镜", "固定")) return changed;
      changed = true;
      continue;
    }
    return changed;
  }
  return changed;
}

function repairStoryboardFrontFlatBalanceLines(lines = []) {
  let changed = false;
  for (let attempt = 0; attempt < lines.length * 2; attempt += 1) {
    const profiles = storyboardShotProfiles(lines.join("\n"));
    const total = profiles.length;
    if (!shouldCheckRatio(total)) return changed;
    const minFrontFlat = Math.ceil(total * STORYBOARD_RATIO_MIN_PERCENT / 100);
    const maxFrontFlat = Math.floor(total * STORYBOARD_RATIO_MAX_PERCENT / 100);
    if (minFrontFlat > maxFrontFlat) return changed;
    const currentFrontFlat = profiles.filter((shot) => shot.isFrontFlat).length;
    if (currentFrontFlat < minFrontFlat) {
      const index = profiles.findIndex((shot) => !shot.isFrontFlat && shot.shotTypeLineNumber);
      if (index < 0) return changed;
      if (!setShotFieldValue(lines, profiles[index], "景别", frontFlatShotTypeFrom(profiles[index].shotType))) return changed;
      changed = true;
      continue;
    }
    if (currentFrontFlat > maxFrontFlat) {
      const index = profiles.findIndex((shot) => shot.isFrontFlat && shot.shotTypeLineNumber);
      if (index < 0) return changed;
      if (!setShotFieldValue(lines, profiles[index], "景别", angledShotTypeFrom(profiles[index].shotType, index))) return changed;
      changed = true;
      continue;
    }
    return changed;
  }
  return changed;
}

function setShotFieldValue(lines, shot, label, value) {
  const lineNumber = label === "运镜" ? shot.cameraLineNumber : shot.shotTypeLineNumber;
  if (!lineNumber || !lines[lineNumber - 1]) return false;
  const field = matchStoryboardFieldLine(lines[lineNumber - 1]);
  if (!field || field.label !== label) return false;
  lines[lineNumber - 1] = `${field.indent}${field.label}：${value}`;
  return true;
}

function firstThreeMovingSequenceIndex(movingFlags = []) {
  for (let index = 2; index < movingFlags.length; index += 1) {
    if (movingFlags[index - 2] && movingFlags[index - 1] && movingFlags[index]) return index;
  }
  return -1;
}

function findFixedShotToMove(profiles = [], movingFlags = []) {
  for (let index = 0; index < profiles.length; index += 1) {
    if (movingFlags[index] || !profiles[index].cameraLineNumber) continue;
    const nextFlags = movingFlags.slice();
    nextFlags[index] = true;
    if (firstThreeMovingSequenceIndex(nextFlags) < 0) return index;
  }
  return -1;
}

function findMovingShotToFix(profiles = []) {
  for (let index = profiles.length - 1; index >= 0; index -= 1) {
    if (profiles[index].isMoving && profiles[index].cameraLineNumber) return index;
  }
  return -1;
}

function motionCameraForIndex(index) {
  return ["缓推", "轻移", "拉", "缓移"][Math.abs(Number(index || 0)) % 4];
}

function frontFlatShotTypeFrom(shotType) {
  return baseShotTypeFrom(shotType);
}

function angledShotTypeFrom(shotType, index) {
  const prefixes = ["正三四", "侧面", "过肩", "前景遮挡"];
  return `${prefixes[Math.abs(Number(index || 0)) % prefixes.length]}${baseShotTypeFrom(shotType)}`;
}

function baseShotTypeFrom(shotType) {
  const text = normalizeShotTypeText(shotType);
  const match = text.match(/(面部特写|近特写|中近景|远景|全景|中景|近景|特写)$/);
  return match ? match[1] : "中景";
}

function splitLongDialogueShots(content, maxChars = MAX_DIALOGUE_CHARS) {
  const lines = String(content || "").split(/\r?\n/);
  const shots = parseStoryboardShots(content);
  if (!shots.length || !shots[0].shotNumber) {
    return { content, changed: false };
  }

  const output = [];
  let changed = false;
  const firstShotIndex = Math.max(0, shots[0].lineNumber - 1);
  output.push(...lines.slice(0, firstShotIndex));

  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const startIndex = shot.lineNumber - 1;
    const endIndex = index + 1 < shots.length ? shots[index + 1].lineNumber - 1 : lines.length;
    const block = lines.slice(startIndex, endIndex);
    const dialogueLines = shot.lines.filter((line) => parseDialogueLine(line.text));
    if (dialogueLines.length !== 1) {
      output.push(...block);
      continue;
    }

    const dialogueLine = dialogueLines[0];
    const parsed = parseDialogueLine(dialogueLine.text);
    const dialogue = trimDialogueQuotes(parsed?.body || "");
    if (!parsed || displayLength(dialogue) <= maxChars) {
      output.push(...block);
      continue;
    }

    const pieces = splitDialogueLine(dialogue, maxChars);
    if (pieces.length <= 1) {
      output.push(...block);
      continue;
    }

    changed = true;
    const dialogueIndex = dialogueLine.lineNumber - 1 - startIndex;
    for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
      const nextBlock = block.slice();
      nextBlock[dialogueIndex] = `${parsed.fieldPrefix}${parsed.speakerMarker || ""}${pieces[pieceIndex].text}`;
      if (pieceIndex > 0 && output.length && output[output.length - 1] !== "") {
        output.push("");
      }
      output.push(...nextBlock);
    }
  }

  if (!changed) return { content, changed: false };
  return {
    content: renumberStoryboardShots(output).join("\n").trim(),
    changed: true,
  };
}

function renumberStoryboardShots(lines = []) {
  let shotNumber = 0;
  return lines.map((line) => {
    const field = matchStoryboardFieldLine(line);
    if (!field || field.label !== "镜号") return line;
    shotNumber += 1;
    return `${field.indent}镜号：${shotNumber}`;
  });
}

function parseDialogueLine(line) {
  const match = matchDialogueLine(line);
  if (!match) return null;
  const rawDialogue = String(match.body || "").trim();
  const markerMatch = rawDialogue.match(SPEAKER_MARKER_PATTERN);
  if (markerMatch) {
    return {
      fieldPrefix: match.fieldPrefix,
      speakerMarker: markerMatch[1],
      body: markerMatch[2],
    };
  }
  const fallbackMarker = firstDialogueMarker(rawDialogue);
  if (!fallbackMarker) {
    return {
      fieldPrefix: match.fieldPrefix,
      speakerMarker: "",
      body: rawDialogue,
    };
  }
  return {
    fieldPrefix: match.fieldPrefix,
    speakerMarker: fallbackMarker.marker,
    body: fallbackMarker.body,
  };
}

function matchDialogueLine(line) {
  const match = String(line || "").match(DIALOGUE_LINE_PATTERN);
  if (!match) return null;
  return {
    fieldPrefix: match[1],
    body: match[2],
  };
}

function firstDialogueMarker(rawDialogue) {
  const text = String(rawDialogue || "").trim();
  const colonMatch = [...text.matchAll(/[：:]/g)].find((match) => match.index > 0 && match.index <= 40);
  if (!colonMatch) return null;
  return {
    marker: text.slice(0, colonMatch.index + 1),
    body: text.slice(colonMatch.index + 1).trim(),
  };
}

function splitDialogueLine(dialogue, maxChars = MAX_DIALOGUE_CHARS) {
  const clean = String(dialogue || "").trim();
  if (!clean) return [];
  if (displayLength(clean) <= maxChars) return [{ text: clean }];
  const parts = clean.match(/[^，。！？；,.!?;]+[，。！？；,.!?;]?/g) || [clean];
  const lines = [];
  let current = "";
  for (const part of parts) {
    if (displayLength(current + part) <= maxChars) {
      current += part;
      continue;
    }
    if (current) {
      lines.push({ text: current });
      current = "";
    }
    if (displayLength(part) <= maxChars) {
      current = part;
      continue;
    }
    for (const chunk of chunkByDisplayLength(part, maxChars)) {
      lines.push({ text: chunk });
    }
  }
  if (current) lines.push({ text: current });
  return lines;
}

function trimDialogueQuotes(text) {
  return String(text || "")
    .replace(/^[“"「『]+/, "")
    .replace(/[”"」』]+$/, "")
    .trim();
}

function isEmptyDialogue(text) {
  return /^(无|暂无|没有|空|-|—|--)?$/.test(String(text || "").trim());
}

function matchStoryboardFieldLine(line) {
  const match = String(line || "").match(FIELD_LINE_PATTERN);
  if (!match) return null;
  return {
    indent: match[1] || "",
    label: normalizeFieldLabel(match[2]),
    value: stripClosingMarkdown(match[3]).trimStart(),
  };
}

function normalizeFieldLabel(label) {
  return String(label || "")
    .replace(/[*_#\s]/g, "")
    .trim();
}

function stripClosingMarkdown(value) {
  return String(value || "")
    .replace(/\s*(?:\*\*|__)\s*$/, "")
    .trimEnd();
}

function normalizeSpeakerName(marker) {
  let speaker = String(marker || "")
    .replace(/[：:]\s*$/, "")
    .trim();
  speaker = speaker.replace(/^[（(][^）)]{1,20}[）)]\s*/, "").trim();
  speaker = speaker.replace(/[（(]\s*(?:os|vo|旁白|画外音)\s*[）)]$/i, "").trim();
  speaker = speaker.replace(/(?:OS|VO)$/i, "").trim();
  return speaker;
}

function parseSceneSpeakers(value) {
  const speakers = new Set();
  for (const part of String(value || "").split(/[、,，/／;；\s]+/)) {
    const name = normalizeSpeakerName(part)
      .replace(/[（(].*?[）)]/g, "")
      .trim();
    if (name) speakers.add(name);
  }
  return speakers;
}

function extractEmbeddedSpeakerNames(text, allowedSpeakers = new Set()) {
  const allowed = allowedSpeakers instanceof Set ? allowedSpeakers : new Set();
  if (!allowed.size) return [];
  const names = [];
  const pattern = /(?:^|[，。！？；,.!?;\s])((?:[（(][^）)]{1,20}[）)]\s*)?(?:(?:[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_-]{0,20}(?:OS|VO)?)|旁白|画外音|男声|女声))\s*[:：]/g;
  for (const match of String(text || "").matchAll(pattern)) {
    const name = normalizeSpeakerName(match[1]);
    if (name && allowed.has(name)) names.push(name);
  }
  return names;
}

function groupRulesByHardRuleId(rules = []) {
  const groups = new Map();
  for (const rule of Array.isArray(rules) ? rules : []) {
    const hardRuleId = String(rule?.hardRuleId || "").trim();
    if (!hardRuleId) continue;
    if (!groups.has(hardRuleId)) groups.set(hardRuleId, []);
    groups.get(hardRuleId).push(rule);
  }
  return groups;
}

function attachHardRuleMeta(issues = [], rules = [], hardRuleId = "") {
  const skillRulesUsedRefs = rules
    .filter((rule) => rule.origin === "stable-skill")
    .map((rule) => rule.ruleId)
    .filter(Boolean);
  const sourceEventIds = collectRuleSourceEventIds(rules);
  return (Array.isArray(issues) ? issues : []).map((issue) => ({
    ...issue,
    hardRuleId,
    skillRulesUsedRefs,
    sourceEventIds,
  }));
}

function chunkByDisplayLength(text, maxChars) {
  const chars = Array.from(String(text || ""));
  const chunks = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    chunks.push(chars.slice(index, index + maxChars).join(""));
  }
  return chunks;
}

function displayLength(text) {
  return Array.from(String(text || "")).filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
}

function storyboardContentFingerprint(content) {
  const text = String(content || "");
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function collectRuleSourceEventIds(rules = []) {
  const ids = new Set();
  for (const rule of Array.isArray(rules) ? rules : []) {
    for (const id of Array.isArray(rule.sourceEventIds) ? rule.sourceEventIds : []) {
      const value = String(id || "").trim();
      if (value) ids.add(value);
    }
  }
  return Array.from(ids);
}

function isStoryboardValidationResolved(node) {
  const resolution = node?.meta?.validationResolution;
  if (!["acknowledged", "adopted"].includes(resolution?.action)) return false;
  return resolution.contentFingerprint === storyboardContentFingerprint(node?.content);
}

module.exports = {
  applyStoryboardHardRuleValidation,
  getStableStoryboardSkillRules,
  isStoryboardValidationResolved,
  MAX_DIALOGUE_CHARS,
  normalizeStoryboardFieldLabels,
  repairStoryboardDialogueIssues,
  storyboardContentFingerprint,
  splitDialogueLine,
  validateStoryboardHardRules,
  validateStoryboardContent,
  validateStoryboardSpeakerCount,
};
