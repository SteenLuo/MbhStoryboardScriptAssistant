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
    ruleId: "stable-skill-storyboard-dialogue-split-visual-variation",
    topicKey: "storyboard.dialogue.split-visual-variation",
    conflictKey: "storyboard.dialogue.split-visual-variation.required",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.dialogue.split-visual-variation",
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
  {
    ruleId: "stable-skill-storyboard-source-grounding",
    topicKey: "storyboard.source.grounding",
    conflictKey: "storyboard.source.grounding.no-invented-active-action",
    capability: "storyboard",
    status: "active",
    hardRuleId: "storyboard.source.grounding",
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
  if (ruleGroups.has("storyboard.dialogue.split-visual-variation")) {
    const rules = ruleGroups.get("storyboard.dialogue.split-visual-variation");
    const validation = validateStoryboardDialogueSplitVisualVariation(content);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.dialogue.split-visual-variation"));
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
  if (ruleGroups.has("storyboard.source.grounding")) {
    const rules = ruleGroups.get("storyboard.source.grounding");
    const validation = validateStoryboardSourceGrounding(content, options.sourceScript);
    issues.push(...attachHardRuleMeta(validation.issues, rules, "storyboard.source.grounding"));
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
  const normalizedContent = normalizeStoryboardReactionPlaceholders(
    normalizeStoryboardFieldLabels(content)
  );
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
  const multiDialogueRepair = repairStoryboardMultiDialogueIssues(repairedContent, afterDialogue.issues);
  if (multiDialogueRepair.repaired) {
    repairedContent = multiDialogueRepair.content;
    repairStrategies.push(multiDialogueRepair.strategy || "split-multiple-dialogue-lines");
  }

  const afterMultiDialogue = multiDialogueRepair.repaired
    ? validateStoryboardHardRules(repairedContent, options)
    : afterDialogue;
  const shortDialogueRepair = repairStoryboardShortDialogueSplitIssues(repairedContent, afterMultiDialogue.issues, options);
  if (shortDialogueRepair.repaired) {
    repairedContent = shortDialogueRepair.content;
    repairStrategies.push(shortDialogueRepair.strategy || "merge-short-same-speaker-dialogue");
  }

  const afterShortDialogue = shortDialogueRepair.repaired
    ? validateStoryboardHardRules(repairedContent, options)
    : afterMultiDialogue;
  const visualVariationRepair = repairStoryboardDialogueSplitVisualVariationIssues(repairedContent, afterShortDialogue.issues);
  if (visualVariationRepair.repaired) {
    repairedContent = visualVariationRepair.content;
    repairStrategies.push(visualVariationRepair.strategy || "vary-dialogue-split-visuals");
  }

  const afterVisualVariation = visualVariationRepair.repaired
    ? validateStoryboardHardRules(repairedContent, options)
    : afterShortDialogue;
  const balanceRepair = repairStoryboardShotBalanceIssues(repairedContent, afterVisualVariation.issues);
  if (balanceRepair.repaired) {
    repairedContent = balanceRepair.content;
    repairStrategies.push(balanceRepair.strategy || "rebalance-shot-motion-and-front-flat-ratios");
  }

  const afterBalanceRepair = balanceRepair.repaired
    ? validateStoryboardHardRules(repairedContent, options)
    : afterVisualVariation;
  const sourceGroundingRepair = repairStoryboardSourceGroundingIssues(repairedContent, afterBalanceRepair.issues, options);
  if (sourceGroundingRepair.repaired) {
    repairedContent = sourceGroundingRepair.content;
    repairStrategies.push(sourceGroundingRepair.strategy || "repair-source-grounding");
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

function validateStoryboardDialogueSplitVisualVariation(content, maxChars = MAX_DIALOGUE_CHARS) {
  const shots = parseStoryboardShots(content).filter((shot) => shot.shotNumber);
  const profiles = storyboardShotProfiles(content);
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
    if (combinedLength <= maxChars) continue;

    const previousProfile = profiles[index - 1];
    const currentProfile = profiles[index];
    const repeatedAction = sameVisualAction(previousProfile?.action, currentProfile?.action);
    const weakShotTypeChange = sameShotComposition(previousProfile, currentProfile);
    const weakCameraChange = sameCameraGesture(previousProfile?.camera, currentProfile?.camera);
    if (!repeatedAction && !(weakShotTypeChange && weakCameraChange)) continue;

    const reasons = [];
    if (repeatedAction) reasons.push("画面动作重复");
    if (weakShotTypeChange) reasons.push("景别/构图变化不足");
    if (weakCameraChange) reasons.push("运镜变化不足");
    issues.push({
      type: "dialogue-split-repeated-visual",
      severity: "error",
      lineNumber: currentProfile?.actionLineNumber || currentDialogue.lineNumber,
      lineText: currentDialogue.lineText,
      previousShotNumber: previousShot.shotNumber,
      shotNumber: currentShot.shotNumber,
      speaker: currentDialogue.speaker,
      previousAction: previousProfile?.action || "",
      currentAction: currentProfile?.action || "",
      previousShotType: previousProfile?.shotType || "",
      currentShotType: currentProfile?.shotType || "",
      previousCamera: previousProfile?.camera || "",
      currentCamera: currentProfile?.camera || "",
      combinedDialogue,
      combinedLength,
      variationReasons: reasons,
      message: `长台词拆成连续镜号后，拆分出的连续镜头景别和画面内容不能完全一样，必须结合剧本当前情节和台词信息重新设计对应画面；当前${reasons.join("、")}。`,
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
      message: `连续镜号使用相同景别/角度/构图拍摄同一画面内容：${current.shotType}。请更换景别、角度或构图，并结合剧本给出不同画面；如果没有新的画面信息，就合并同一画面。`,
    });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

function validateStoryboardSourceGrounding(content, sourceScript) {
  const sourceScenes = buildSourceSceneGroundingIndex(sourceScript);
  if (!sourceScenes.size) return { ok: true, issues: [] };
  const profiles = storyboardShotProfiles(content);
  const issues = [];
  for (const profile of profiles) {
    const scene = sourceScenes.get(profile.sceneId);
    if (!scene || !profile.action) continue;
    for (const character of scene.characters) {
      if (!character || scene.activeCharacters.has(character)) continue;
      if (!profile.action.includes(character)) continue;
      if (!hasUngroundedActiveAction(profile.action, character)) continue;
      issues.push({
        type: "storyboard-source-ungrounded-character-action",
        severity: "error",
        lineNumber: profile.actionLineNumber || profile.lineNumber,
        shotNumber: profile.shotNumber,
        sceneId: profile.sceneId,
        character,
        action: profile.action,
        message: `原剧本 ${profile.sceneId} 中“${character}”仅在人物表出现，正文没有对应动作或台词；分镜不得新增其主动走位、拿道具或承担新情节。`,
      });
    }
    const ungroundedDetails = findUngroundedConcreteDetails(`${profile.action}\n${profile.sound}`, scene);
    if (ungroundedDetails.length) {
      issues.push({
        type: "storyboard-source-ungrounded-concrete-detail",
        severity: "error",
        lineNumber: profile.actionLineNumber || profile.soundLineNumber || profile.lineNumber,
        shotNumber: profile.shotNumber,
        sceneId: profile.sceneId,
        details: ungroundedDetails,
        action: profile.action,
        sound: profile.sound,
        message: `分镜新增了原剧本 ${profile.sceneId} 未出现的具体画面元素：${ungroundedDetails.join("、")}。请改用原文已有空间、人物、表情、视线、手部或光线信息。`,
      });
    }
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
      const soundField = storyboardShotField(shot, "音效");
      const camera = cameraField?.value || "";
      const shotType = shotTypeField?.value || "";
      return {
        shotNumber: shot.shotNumber,
        sceneId: shot.sceneId || "",
        lineNumber: shot.lineNumber,
        cameraLineNumber: cameraField?.lineNumber || 0,
        shotTypeLineNumber: shotTypeField?.lineNumber || 0,
        camera,
        shotType,
        actionLineNumber: actionField?.lineNumber || 0,
        action: actionField?.value || "",
        soundLineNumber: soundField?.lineNumber || 0,
        sound: soundField?.value || "",
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

function sameVisualAction(previousAction, currentAction) {
  const previousKey = normalizeVisualActionKey(previousAction);
  const currentKey = normalizeVisualActionKey(currentAction);
  return Boolean(previousKey && currentKey && previousKey === currentKey);
}

function normalizeVisualActionKey(action) {
  return Array.from(String(action || "").normalize("NFKC"))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");
}

function sameCameraGesture(previousCamera, currentCamera) {
  const previousKey = normalizeCameraGestureKey(previousCamera);
  const currentKey = normalizeCameraGestureKey(currentCamera);
  return Boolean(previousKey && currentKey && previousKey === currentKey);
}

function normalizeCameraGestureKey(camera) {
  const text = String(camera || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[()（）【】[\]：:，,。；;、]/g, "")
    .replace(/^(?:轻|缓|慢|微|小幅|快速|快|轻微)+/, "");
  if (!text) return "";
  if (/固定|定镜|静止|不动/.test(text)) return "固定";
  if (/推/.test(text)) return "推";
  if (/拉/.test(text)) return "拉";
  if (/移/.test(text)) return "移";
  if (/摇/.test(text)) return "摇";
  if (/跟/.test(text)) return "跟";
  if (/升/.test(text)) return "升";
  if (/降/.test(text)) return "降";
  if (/环绕/.test(text)) return "环绕";
  return text;
}

function hasSameVisualContinuationCue(text) {
  return /维持上一镜|维持前一镜|继续上一镜|继续前一镜|接上一镜|接前一镜|承接上一镜|承接前一镜|延续上一镜|延续前一镜|保持上一镜|保持前一镜|上一镜的构图|前一镜的构图|同一构图|相同构图|同样构图|同一景别|相同景别|同一机位|相同机位|机位不变|同一画面|相同画面|同样画面|画面不变/.test(String(text || ""));
}

function buildSourceSceneGroundingIndex(sourceScript = "") {
  const scenes = new Map();
  let current = null;
  for (const rawLine of String(sourceScript || "").split(/\r?\n/)) {
    const line = String(rawLine || "").trim().replace(/^△\s*/, "");
    if (!line) continue;
    const field = matchStoryboardFieldLine(line);
    const sceneIdFromLine = field?.label === "场次" ? extractSceneId(field.value) : extractSceneIdFromSourceHeading(line);
    if (sceneIdFromLine) {
      current = ensureSourceGroundingScene(scenes, sceneIdFromLine);
      if (field?.label === "场次") continue;
    }
    if (!current) continue;
    if (field?.label === "人物") {
      current.characters = parseSceneSpeakers(field.value);
      continue;
    }
    if (field && ["地点", "时间", "场次"].includes(field.label)) continue;
    current.bodyLines.push(line);
    const speakerMatch = line.match(/^([^：:\n]{1,24})[:：]\s*(.+)$/);
    if (!speakerMatch) continue;
    const speakerName = normalizeSourceSpeakerName(speakerMatch[1], current.characters);
    if (!speakerName || STORYBOARD_FIELD_LABELS.has(speakerName) || isNonCharacterSpeaker(speakerName)) continue;
    current.activeCharacters.add(speakerName);
  }

  for (const scene of scenes.values()) {
    const bodyText = scene.bodyLines.join("\n");
    scene.bodyText = bodyText;
    if (sourceSceneReferencesAllListedCharacters(bodyText)) {
      for (const character of scene.characters) scene.activeCharacters.add(character);
    }
    for (const character of scene.characters) {
      if (!character) continue;
      if (scene.bodyLines.some((line) => sourceLineActivatesCharacter(line, character))) {
        scene.activeCharacters.add(character);
      }
    }
  }
  return scenes;
}

function ensureSourceGroundingScene(scenes, sceneId) {
  if (!scenes.has(sceneId)) {
    scenes.set(sceneId, {
      sceneId,
      characters: new Set(),
      activeCharacters: new Set(),
      bodyLines: [],
      bodyText: "",
    });
  }
  return scenes.get(sceneId);
}

function extractSceneIdFromSourceHeading(line) {
  const text = String(line || "").trim();
  if (/^场次\s*[:：]/.test(text)) return "";
  const match = text.match(/^(\d{1,3}-\d+)\b/);
  return match ? match[1] : "";
}

function sourceSceneReferencesAllListedCharacters(text) {
  return /一家人|全家人|全家|两人|三人|四人|几个人|几人|所有人|众人/.test(String(text || ""));
}

function hasUngroundedActiveAction(action, character) {
  const name = escapeRegExp(String(character || "").trim());
  if (!name) return false;
  const directReactionPattern = new RegExp(`(?:切到|转到|给到|拍到)?${name}的?(?:反应|表情|眼神|近景|特写)`);
  if (directReactionPattern.test(action)) return true;
  const activeActionPattern = /走出来|走进|走到|走向|端着|端起|拿着|捧着|递|搬|扬了扬|点头|摇头|招呼|开口|说|笑着|哭|夹|倒|洗|收拾|放下|坐下|站起|站在|趴|扶|握|拉住|掏出|打开|关上|转身|进了|出来|忙|干活|看向|盯着|抬头|低头|抹眼|擦|接过|递给|沉默|视线|目光|眼神|表情|神情|欣慰|心疼|认可/;
  return new RegExp(`${name}[^。；;\n]{0,80}(?:${activeActionPattern.source})`).test(action);
}

function sourceLineActivatesCharacter(line, character) {
  const text = String(line || "");
  const name = String(character || "").trim();
  if (!name || !text.includes(name)) return false;
  const currentActionPattern = /站|坐|走|送|看|喝|抹|举|笑|低头|抬头|拿|拎|进屋|进了屋|出来|说话|点头|摇头|递|夹|吃|靠|握|掏|穿着|端|整理|帮|扶|停下|回头|转身|放下|捧|攥|摸|看着|望着/;
  if (!currentActionPattern.test(text)) return false;
  return !/出钱|翻新|换成|铺了|盖了|建成|扩建|以前|前世|后来|因为|导致|总觉得/.test(text);
}

function findUngroundedConcreteDetails(action, scene) {
  const text = String(action || "");
  const sourceText = String(scene?.bodyText || "");
  const highRiskDetails = [
    "鸡鸣",
    "鸡",
    "狗",
    "福字",
    "窗花",
    "对联",
    "花生",
    "瓜子",
    "新碗筷",
    "碗筷",
    "棉袄",
    "麻袋",
    "木椅",
    "泥",
  ];
  return highRiskDetails.filter((detail) => text.includes(detail) && !sourceText.includes(detail));
}

function removeUngroundedConcreteDetailSentences(action, details = []) {
  const blocked = (Array.isArray(details) ? details : []).map(String).filter(Boolean);
  if (!blocked.length) return action;
  const sentences = String(action || "").match(/[^。！？!?]+[。！？!?]?/g) || [];
  const kept = sentences.filter((sentence) => !blocked.some((detail) => sentence.includes(detail)));
  return kept.join("").trim();
}

function removeUngroundedConcreteDetailPhrases(text, details = []) {
  const blocked = (Array.isArray(details) ? details : []).map(String).filter(Boolean);
  if (!blocked.length) return text;
  const parts = String(text || "").split(/([，,、；;])/);
  const kept = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (/^[，,、；;]$/.test(part)) {
      if (kept.length && index < parts.length - 1) kept.push(part);
      continue;
    }
    if (blocked.some((detail) => part.includes(detail))) continue;
    kept.push(part);
  }
  return kept.join("")
    .replace(/^[，,、；;\s]+|[，,、；;\s]+$/g, "")
    .replace(/[，,、；;]{2,}/g, "，")
    .trim();
}

function sourceGroundedFallbackAction(issue = {}, shot = {}, scene = null) {
  const dialogue = shotDialogueEntry(shot);
  const speaker = dialogue?.speaker || "";
  const detailPhrase = sourceSceneDetailPhrase(scene);
  const mood = dialogueMoodPhrase(dialogue?.dialogue || "");
  if (speaker) {
    if (detailPhrase) {
      return `${speaker}站在${detailPhrase}前开口，语气${mood}。`;
    }
    return `${speaker}站定开口，视线落向对话方向，神情${mood}。`;
  }
  if (detailPhrase) {
    return `镜头停留在${detailPhrase}上，突出当前场景的空间和气氛。`;
  }
  return "镜头停留在当前场景中，突出人物关系和场景气氛。";
}

function dialogueMoodPhrase(dialogue = "") {
  const text = String(dialogue || "");
  if (/气派|翻身|厉害|本事|有出息/.test(text)) return "带着羡慕";
  if (/对不住|愧疚|糊涂|舍不得/.test(text)) return "愧疚而低沉";
  if (/谢谢|感激|放心|肯定能/.test(text)) return "急切而诚恳";
  if (/真的|好|行|嗯/.test(text)) return "轻柔而克制";
  if (/不行|偷懒|走人|规矩/.test(text)) return "平静而坚定";
  return "认真而克制";
}

function sourceSceneDetailPhrase(scene = null) {
  const text = String(scene?.bodyText || "");
  const details = [
    "砖墙",
    "玻璃窗",
    "青砖地面",
    "青砖",
    "新厢房",
    "院子",
    "鱼",
    "肉",
    "饺子",
    "圆桌",
    "桌上饭菜",
    "烟花",
    "院门口",
    "大棚",
    "菜筐",
    "点心",
    "鸡蛋",
  ].filter((detail) => text.includes(detail));
  const normalized = [];
  for (const detail of details) {
    if (detail === "青砖" && details.includes("青砖地面")) continue;
    if (!normalized.includes(detail)) normalized.push(detail);
  }
  return normalized.slice(0, 4).join("、");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ratioPercent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function buildSourceDialogueIndex(sourceScript = "") {
  const bySpeaker = new Map();
  const unattributed = [];
  const all = [];
  let sceneSpeakers = new Set();
  const lines = String(sourceScript || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || "").trim().replace(/^△\s*/, "");
    if (!line) continue;
    const field = matchStoryboardFieldLine(line);
    if (field?.label === "人物") {
      sceneSpeakers = parseSceneSpeakers(field.value);
      continue;
    }
    const speakerMatch = line.match(/^([^：:\n]{1,24})[:：]\s*(.+)$/);
    if (speakerMatch) {
      const speakerName = normalizeSourceSpeakerName(speakerMatch[1], sceneSpeakers);
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

function normalizeSourceSpeakerName(marker, sceneSpeakers = new Set()) {
  const speakerName = normalizeSpeakerName(marker);
  if (!speakerName) return "";
  const candidates = Array.from(sceneSpeakers || [])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return candidates.find((name) => speakerName === name || speakerName.startsWith(name)) || speakerName;
}

function sourceDialogueContains(sourceIndex, speakerName, normalizedDialogue) {
  const sameSpeakerLines = sourceIndex.bySpeaker.get(speakerName) || [];
  if (sameSpeakerLines.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  if (sourceIndex.unattributed.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  if (!sameSpeakerLines.length && sourceIndex.all.some((sourceText) => sourceText.includes(normalizedDialogue))) return true;
  return false;
}

function normalizeDialogueFidelityText(text) {
  return Array.from(stripDialogueStageDirections(text).normalize("NFKC"))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join("");
}

function stripDialogueStageDirections(text) {
  return String(text || "")
    .replace(/[（(][^（）()]{1,80}[）)]/g, "");
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
  let currentSceneId = "";
  let sceneSpeakers = new Set();
  lines.forEach((line, index) => {
    const field = matchStoryboardFieldLine(line);
    if (field?.label === "场次") {
      currentSceneId = extractSceneId(field.value) || currentSceneId;
    }
    if (field?.label === "人物") {
      sceneSpeakers = parseSceneSpeakers(field.value);
    }
    const shotNumber = parseShotNumberLine(line);
    if (shotNumber) {
      current = {
        shotNumber,
        sceneId: currentSceneId,
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
    sceneId: currentSceneId,
    lineNumber: 1,
    lines: lines.map((line, index) => ({ lineNumber: index + 1, text: line })),
  }];
}

function extractSceneId(value) {
  const match = String(value || "").match(/\b\d{1,3}-\d+\b/);
  return match ? match[0] : "";
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

function normalizeStoryboardReactionPlaceholders(content) {
  return normalizeStoryboardReactionPlaceholdersByShot(String(content || ""))
    .replace(
      /切到([^，。\n]{1,20})的反应，\1看向([^，。\n]{1,20})，表情和身体姿态随这句后半段台词发生变化。/g,
      (_match, reactionTarget, speaker, offset) =>
        dialogueSplitVariationAction({ speaker, reactionTarget, index: offset })
    )
    .replace(
      /切到([^，。\n]{1,20})的反应，\1看向([^，。\n]{1,20})，眼神一顿，轻轻抿住嘴。/g,
      (_match, reactionTarget, speaker, offset) =>
        dialogueSplitVariationAction({ speaker, reactionTarget, index: offset })
    )
    .replace(
      /切到([^，。\n]{1,20})的说话反应，\1的表情和身体姿态随这一句台词发生变化。/g,
      "切到$1的说话反应，$1停顿片刻，语气更坚定。"
    )
    .replace(/表情和身体姿态随这句后半段台词发生变化/g, "停住片刻，认真听完这句话")
    .replace(/表情和身体姿态随这一句台词发生变化/g, "停顿片刻，语气更坚定")
    .replace(/随这句后半段台词发生变化/g, "停住片刻")
    .replace(/随这一句台词发生变化/g, "语气更坚定")
    .replace(/语气里带着台词中的情绪/g, "语气里带着明显的羡慕")
    .replace(/神情贴合当前台词/g, "神情认真而克制");
}

function normalizeStoryboardReactionPlaceholdersByShot(content) {
  const lines = String(content || "").split(/\r?\n/);
  const shots = parseStoryboardShots(content).filter((shot) => shot.shotNumber);
  let changed = false;
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const actionField = storyboardShotField(shot, "情绪/动作") || storyboardShotField(shot, "画面内容与构图叙事");
    if (!actionField?.lineNumber) continue;
    const shotTypeField = storyboardShotField(shot, "景别");
    const dialogue = shotDialogueEntry(shot);
    const dialogueText = dialogue?.dialogue || "";
    const rewriteSplitAction = (reactionTarget, speaker) => {
      if (shotTypeField?.lineNumber) {
        const nextShotType = dialogueSplitVariationShotType(shotTypeField.value, index);
        lines[shotTypeField.lineNumber - 1] = `${shotTypeField.indent}${shotTypeField.label}：${nextShotType}`;
        changed = true;
      }
      return dialogueSplitVariationAction({ speaker, reactionTarget, dialogue: dialogueText, index });
    };
    let nextValue = actionField.value || "";
    nextValue = nextValue
      .replace(
        /切到([^，。\n]{1,20})的反应，\1看向([^，。\n]{1,20})，表情和身体姿态随这句后半段台词发生变化。/g,
        (_match, reactionTarget, speaker) => rewriteSplitAction(reactionTarget, speaker)
      )
      .replace(
        /切到([^，。\n]{1,20})的反应，\1看向([^，。\n]{1,20})，眼神一顿，轻轻抿住嘴。/g,
        (_match, reactionTarget, speaker) => rewriteSplitAction(reactionTarget, speaker)
      )
      .replace(
        /切到([^，。\n]{1,20})的反应，\1沉默片刻，视线停在([^，。\n]{1,20})身上。/g,
        (_match, reactionTarget, speaker) => rewriteSplitAction(reactionTarget, speaker)
      )
      .replace(
        /切到([^，。\n]{1,20})的反应，\1看向([^，。\n]{1,20})，神情从迟疑转为专注。/g,
        (_match, reactionTarget, speaker) => rewriteSplitAction(reactionTarget, speaker)
      )
      .replace(
        /切到([^，。\n]{1,20})的反应，\1认真听着([^，。\n]{1,20})的话，表情随语气慢慢收紧。/g,
        (_match, reactionTarget, speaker) => rewriteSplitAction(reactionTarget, speaker)
      )
      .replace(
        /切到([^，。\n]{1,20})的反应，\1(?:听到招工的事，手指停了一下，像是在盘算这份活计|没有马上接话，肩背微微绷直，神情里多了几分琢磨|把话头先咽回去，低头想了想，态度比刚才认真|听到生计和销路的事，轻轻点头，神情踏实下来|抬眼听着，肩背放松了一些，表情更笃定)。/g,
        (_match, reactionTarget) =>
          rewriteSplitAction(reactionTarget, dialogue?.speaker || "")
      );
    if (nextValue === actionField.value) continue;
    lines[actionField.lineNumber - 1] = `${actionField.indent}${actionField.label}：${nextValue}`;
    changed = true;
  }
  return changed ? lines.join("\n").trim() : content;
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

function repairStoryboardMultiDialogueIssues(content, issues = []) {
  const repairableTypes = new Set(["dialogue-too-many-lines", "dialogue-multiple-speakers"]);
  if (!(Array.isArray(issues) ? issues : []).some((issue) => repairableTypes.has(issue?.type))) {
    return {
      content,
      repaired: false,
    };
  }
  const repaired = splitMultipleDialogueLineShots(content);
  if (!repaired.changed) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: repaired.content,
    repaired: true,
    strategy: "split-multiple-dialogue-lines",
  };
}

function repairStoryboardShortDialogueSplitIssues(content, issues = [], options = {}) {
  const maxChars = Number(options.maxDialogueChars || MAX_DIALOGUE_CHARS);
  if (!(Array.isArray(issues) ? issues : []).some((issue) => issue?.type === "dialogue-short-same-speaker-split")) {
    return {
      content,
      repaired: false,
    };
  }
  const repaired = mergeShortSameSpeakerDialogueSplits(content, maxChars);
  if (!repaired.changed) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: repaired.content,
    repaired: true,
    strategy: "merge-short-same-speaker-dialogue",
  };
}

function splitMultipleDialogueLineShots(content) {
  const lines = String(content || "").split(/\r?\n/);
  const shots = parseStoryboardShots(content).filter((shot) => shot.shotNumber);
  if (!shots.length) return { content, changed: false };

  const output = [];
  let changed = false;
  const firstShotIndex = Math.max(0, shots[0].lineNumber - 1);
  output.push(...lines.slice(0, firstShotIndex));

  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    const startIndex = shot.lineNumber - 1;
    const endIndex = index + 1 < shots.length ? shots[index + 1].lineNumber - 1 : lines.length;
    const block = lines.slice(startIndex, endIndex);
    const dialogueEntries = block
      .map((line, blockIndex) => ({ blockIndex, parsed: parseDialogueLine(line), text: line }))
      .filter((entry) => entry.parsed);
    if (dialogueEntries.length <= 1) {
      output.push(...block);
      continue;
    }

    const nonEmptyEntries = dialogueEntries.filter((entry) =>
      !isEmptyDialogue(trimDialogueQuotes(entry.parsed.body))
    );
    const selectedEntries = nonEmptyEntries.length ? nonEmptyEntries : [dialogueEntries[0]];
    const dialogueIndexes = new Set(dialogueEntries.map((entry) => entry.blockIndex));
    changed = true;

    for (let pieceIndex = 0; pieceIndex < selectedEntries.length; pieceIndex += 1) {
      const selected = selectedEntries[pieceIndex];
      const nextBlock = block.filter((_, blockIndex) =>
        !dialogueIndexes.has(blockIndex) || blockIndex === selected.blockIndex
      );
      if (pieceIndex > 0) {
        varySplitDialogueBlock(nextBlock, selected, pieceIndex);
      }
      if (output.length && output[output.length - 1] !== "") output.push("");
      output.push(...nextBlock);
    }
  }

  if (!changed) return { content, changed: false };
  return {
    content: renumberStoryboardShots(output).join("\n").trim(),
    changed: true,
  };
}

function varySplitDialogueBlock(block, dialogueEntry, index) {
  const parsed = dialogueEntry?.parsed;
  const speaker = normalizeSpeakerName(parsed?.speakerMarker || "");
  const currentShotType = blockFieldValue(block, "景别");
  const currentCamera = blockFieldValue(block, "运镜");
  setBlockFieldValue(block, "景别", dialogueSplitVariationShotType(currentShotType, index));
  setBlockFieldValue(block, "运镜", dialogueSplitVariationCamera("", currentCamera));
  setBlockFieldValue(
    block,
    "情绪/动作",
    dialogueSplitVariationAction({
      speaker,
      dialogue: parsed?.body || "",
      index,
    })
  );
}

function mergeShortSameSpeakerDialogueSplits(content, maxChars = MAX_DIALOGUE_CHARS) {
  let lines = String(content || "").split(/\r?\n/);
  let changed = false;
  for (let attempt = 0; attempt < lines.length; attempt += 1) {
    const currentContent = lines.join("\n");
    const shots = parseStoryboardShots(currentContent).filter((shot) => shot.shotNumber);
    let mergedThisPass = false;

    for (let index = 1; index < shots.length; index += 1) {
      const previousShot = shots[index - 1];
      const currentShot = shots[index];
      if (hasSceneBoundaryBeforeNextShot(previousShot)) continue;

      const previousDialogue = shotDialogueEntry(previousShot);
      const currentDialogue = shotDialogueEntry(currentShot);
      if (!previousDialogue || !currentDialogue) continue;
      if (previousDialogue.speaker !== currentDialogue.speaker) continue;

      const combinedDialogue = `${previousDialogue.dialogue}${currentDialogue.dialogue}`;
      if (displayLength(combinedDialogue) > maxChars) continue;

      lines = mergeAdjacentShotBlocks(lines, shots, index, combinedDialogue);
      changed = true;
      mergedThisPass = true;
      break;
    }

    if (!mergedThisPass) break;
  }

  if (!changed) return { content, changed: false };
  return {
    content: renumberStoryboardShots(lines).join("\n").trim(),
    changed: true,
  };
}

function mergeAdjacentShotBlocks(lines, shots, currentIndex, combinedDialogue) {
  const previousShot = shots[currentIndex - 1];
  const currentShot = shots[currentIndex];
  const nextShot = shots[currentIndex + 1];
  const previousStartIndex = previousShot.lineNumber - 1;
  const currentStartIndex = currentShot.lineNumber - 1;
  const currentEndIndex = nextShot ? nextShot.lineNumber - 1 : lines.length;
  const previousBlock = lines.slice(previousStartIndex, currentStartIndex);
  const currentBlock = lines.slice(currentStartIndex, currentEndIndex);
  const previousDialogue = shotDialogueEntry(previousShot);
  const previousDialogueIndex = previousDialogue.lineNumber - 1 - previousStartIndex;
  const previousParsed = parseDialogueLine(previousBlock[previousDialogueIndex]);
  if (previousParsed) {
    previousBlock[previousDialogueIndex] = `${previousParsed.fieldPrefix}${previousParsed.speakerMarker || ""}${combinedDialogue}`;
  }
  mergeBlockFieldValues(previousBlock, currentBlock, "情绪/动作");
  mergeBlockDurations(previousBlock, currentBlock);
  return [
    ...lines.slice(0, previousStartIndex),
    ...previousBlock,
    ...lines.slice(currentEndIndex),
  ];
}

function mergeBlockFieldValues(previousBlock, currentBlock, label) {
  const previousIndex = findBlockFieldIndex(previousBlock, label);
  const currentIndex = findBlockFieldIndex(currentBlock, label);
  if (previousIndex < 0 || currentIndex < 0) return false;
  const previousField = matchStoryboardFieldLine(previousBlock[previousIndex]);
  const currentField = matchStoryboardFieldLine(currentBlock[currentIndex]);
  const previousValue = previousField?.value || "";
  const currentValue = currentField?.value || "";
  if (!currentValue || previousValue === currentValue || previousValue.includes(currentValue)) return false;
  previousBlock[previousIndex] = `${previousField.indent}${previousField.label}：${previousValue}；${currentValue}`;
  return true;
}

function mergeBlockDurations(previousBlock, currentBlock) {
  const previousIndex = findBlockFieldIndex(previousBlock, "时长");
  const currentIndex = findBlockFieldIndex(currentBlock, "时长");
  if (previousIndex < 0 || currentIndex < 0) return false;
  const previousField = matchStoryboardFieldLine(previousBlock[previousIndex]);
  const currentField = matchStoryboardFieldLine(currentBlock[currentIndex]);
  const previousDuration = parseDurationSeconds(previousField?.value);
  const currentDuration = parseDurationSeconds(currentField?.value);
  if (!Number.isFinite(previousDuration) || !Number.isFinite(currentDuration)) return false;
  previousBlock[previousIndex] = `${previousField.indent}${previousField.label}：${formatDurationSeconds(previousDuration + currentDuration)}`;
  return true;
}

function parseDurationSeconds(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : NaN;
}

function formatDurationSeconds(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}s`;
}

function blockFieldValue(block, label) {
  const index = findBlockFieldIndex(block, label);
  if (index < 0) return "";
  return matchStoryboardFieldLine(block[index])?.value || "";
}

function setBlockFieldValue(block, label, value) {
  const index = findBlockFieldIndex(block, label);
  if (index < 0) return false;
  const field = matchStoryboardFieldLine(block[index]);
  if (!field || field.label !== label) return false;
  block[index] = `${field.indent}${field.label}：${value}`;
  return true;
}

function findBlockFieldIndex(block, label) {
  return (Array.isArray(block) ? block : []).findIndex((line) =>
    matchStoryboardFieldLine(line)?.label === label
  );
}

function repairStoryboardDialogueSplitVisualVariationIssues(content, issues = []) {
  const repairableIssues = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue?.type === "dialogue-split-repeated-visual");
  if (!repairableIssues.length) {
    return {
      content,
      repaired: false,
    };
  }

  const lines = String(content || "").split(/\r?\n/);
  let changed = false;
  for (const issue of repairableIssues) {
    const currentContent = lines.join("\n");
    const shots = parseStoryboardShots(currentContent).filter((shot) => shot.shotNumber);
    const profiles = storyboardShotProfiles(currentContent);
    const currentIndex = profiles.findIndex((shot) => String(shot.shotNumber) === String(issue.shotNumber));
    if (currentIndex < 0) continue;
    const previousProfile = profiles[currentIndex - 1] || profiles.find((shot) =>
      String(shot.shotNumber) === String(issue.previousShotNumber)
    );
    const currentProfile = profiles[currentIndex];
    const currentShot = shots.find((shot) => String(shot.shotNumber) === String(issue.shotNumber));
    const dialogue = currentShot ? shotDialogueEntry(currentShot) : null;
    const speaker = issue.speaker || dialogue?.speaker || "";

    changed = setShotActionValue(
      lines,
      currentProfile,
      dialogueSplitVariationAction({
        speaker,
        dialogue: dialogue?.dialogue || "",
        index: currentIndex,
      })
    ) || changed;
    changed = setShotFieldValue(
      lines,
      currentProfile,
      "景别",
      dialogueSplitVariationShotType(currentProfile.shotType, currentIndex)
    ) || changed;
    changed = setShotFieldValue(
      lines,
      currentProfile,
      "运镜",
      dialogueSplitVariationCamera(previousProfile?.camera, currentProfile.camera)
    ) || changed;
  }

  if (!changed) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: lines.join("\n").trim(),
    repaired: true,
    strategy: "vary-dialogue-split-visuals",
  };
}

function repairStoryboardSourceGroundingIssues(content, issues = [], options = {}) {
  const repairableIssues = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue?.type === "storyboard-source-ungrounded-character-action" ||
      issue?.type === "storyboard-source-ungrounded-concrete-detail");
  if (!repairableIssues.length) {
    return {
      content,
      repaired: false,
    };
  }

  const sourceScenes = buildSourceSceneGroundingIndex(options.sourceScript || "");
  const lines = String(content || "").split(/\r?\n/);
  let changed = false;
  for (const issue of repairableIssues) {
    const currentContent = lines.join("\n");
    const profiles = storyboardShotProfiles(currentContent);
    const shots = parseStoryboardShots(currentContent).filter((shot) => shot.shotNumber);
    const currentIndex = profiles.findIndex((shot) => String(shot.shotNumber) === String(issue.shotNumber));
    if (currentIndex < 0) continue;
    const currentProfile = profiles[currentIndex];
    const currentShot = shots[currentIndex];
    const scene = sourceScenes.get(issue.sceneId || currentProfile.sceneId) || null;
    let nextAction = currentProfile.action || "";
    if (issue.type === "storyboard-source-ungrounded-concrete-detail") {
      nextAction = removeUngroundedConcreteDetailSentences(nextAction, issue.details);
      if (currentProfile.sound) {
        const nextSound = removeUngroundedConcreteDetailPhrases(currentProfile.sound, issue.details);
        if (nextSound !== currentProfile.sound) {
          changed = setShotFieldValue(lines, currentProfile, "音效", nextSound) || changed;
        }
      }
      if (!nextAction) nextAction = sourceGroundedFallbackAction(issue, currentShot, scene);
    } else {
      nextAction = sourceGroundedFallbackAction(issue, currentShot, scene);
    }
    if (!nextAction || nextAction === currentProfile.action) continue;
    changed = setShotActionValue(lines, currentProfile, nextAction) || changed;
  }

  if (!changed) {
    return {
      content,
      repaired: false,
    };
  }
  return {
    content: lines.join("\n").trim(),
    repaired: true,
    strategy: "repair-source-grounding",
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
    const movingFlags = profiles.map((shot) => shot.isMoving);
    const sequenceIndex = firstThreeMovingSequenceIndex(movingFlags);
    if (sequenceIndex >= 0) {
      if (!setShotFieldValue(lines, profiles[sequenceIndex], "运镜", "固定")) return changed;
      changed = true;
      continue;
    }
    if (!shouldCheckRatio(total)) return changed;
    const minMoving = Math.ceil(total * STORYBOARD_RATIO_MIN_PERCENT / 100);
    const maxMoving = Math.floor(total * STORYBOARD_RATIO_MAX_PERCENT / 100);
    if (minMoving > maxMoving) return changed;
    const currentMoving = movingFlags.filter(Boolean).length;
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
  const lineNumber = label === "运镜"
    ? shot.cameraLineNumber
    : label === "音效"
      ? shot.soundLineNumber
      : shot.shotTypeLineNumber;
  if (!lineNumber || !lines[lineNumber - 1]) return false;
  const field = matchStoryboardFieldLine(lines[lineNumber - 1]);
  if (!field || field.label !== label) return false;
  lines[lineNumber - 1] = `${field.indent}${field.label}：${value}`;
  return true;
}

function setShotActionValue(lines, shot, value) {
  const lineNumber = shot?.actionLineNumber;
  if (!lineNumber || !lines[lineNumber - 1]) return false;
  const field = matchStoryboardFieldLine(lines[lineNumber - 1]);
  if (!field || !["情绪/动作", "画面内容与构图叙事"].includes(field.label)) return false;
  lines[lineNumber - 1] = `${field.indent}${field.label}：${value}`;
  return true;
}

function dialogueSplitVariationAction({ speaker = "", index = 0 } = {}) {
  const name = String(speaker || "说话人").trim();
  const options = [
    `${name}继续承接这段台词，结合当前台词和剧本语境重新安排画面，避免重复上一镜。`,
    `${name}继续说完这段台词，根据这段台词的情绪和信息点重新组织画面，不能照搬上一镜。`,
    `${name}继续承接台词，围绕当前剧情重新设计画面，景别和画面内容不得与上一镜完全一样。`,
  ];
  return options[Math.abs(Number(index || 0)) % options.length];
}

function dialogueSplitVariationShotType(shotType, index) {
  const base = baseShotTypeFrom(shotType);
  const alternateBase = base === "近景" ? "中景" : "近景";
  const options = [`侧面${base}`, `正三四${base}`, `低角度${base}`, `俯拍${base}`, alternateBase];
  const currentKey = normalizeShotCompositionKey(shotType);
  const selected = options.find((item) => normalizeShotCompositionKey(item) !== currentKey);
  return selected || options[Math.abs(Number(index || 0)) % options.length] || alternateBase;
}

function dialogueSplitVariationCamera(previousCamera, currentCamera) {
  const previousKey = normalizeCameraGestureKey(previousCamera);
  const currentKey = normalizeCameraGestureKey(currentCamera);
  const options = previousKey === "固定" || currentKey === "固定"
    ? ["缓推", "轻移", "拉"]
    : ["固定", "缓推", "轻移"];
  return options.find((item) => {
    const key = normalizeCameraGestureKey(item);
    return key && key !== previousKey && key !== currentKey;
  }) || "缓推";
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
