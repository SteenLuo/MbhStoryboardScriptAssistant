const {
  applyStoryboardHardRuleValidation,
  isStoryboardValidationResolved,
  validateStoryboardContent,
} = require("./storyboardValidation");

function applyCanvasStoryboardValidation(canvas = {}, options = {}) {
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return {
    ...canvas,
    nodes: nodes.length
      ? nodes.map((node) => applyStoryboardNodeValidation(node, {
        ...options,
        sourceScript: sourceScriptForStoryboardNode(node, nodesById, options),
      }))
      : [],
  };
}

function sourceScriptForStoryboardNode(node = {}, nodesById = new Map(), options = {}) {
  if (node.type !== "storyboard") return options.sourceScript || "";
  if (options.sourceScript) return options.sourceScript;
  const sourceScriptNodeId = node.meta?.sourceScriptNodeId || node.meta?.sourceNodeId;
  if (!sourceScriptNodeId) return "";
  const sourceNode = nodesById.get(sourceScriptNodeId);
  return sourceNode?.type === "script" ? String(sourceNode.content || "") : "";
}

function applyStoryboardNodeValidation(node = {}, options = {}) {
  if (node.type !== "storyboard") return node;
  if (isStoryboardValidationResolved(node)) return node;

  const hardRuleResult = applyStoryboardHardRuleValidation(node.content || "", {
    useStableSkillRules: options.useStableSkillRules === true,
    sourceScript: options.sourceScript || "",
  });
  const validation = hardRuleResult.validation || validateStoryboardContent(hardRuleResult.content || node.content || "", {
    checkDialogueLength: false,
  });
  const nextMeta = {
    ...(node.meta || {}),
    validation,
  };

  delete nextMeta.currentRulesUsed;
  if (hardRuleResult.hardRuleValidation?.checked) {
    nextMeta.hardRuleValidation = hardRuleResult.hardRuleValidation;
    nextMeta.skillRulesUsed = hardRuleResult.hardRuleValidation.appliedRules || [];
  } else {
    delete nextMeta.hardRuleValidation;
    delete nextMeta.skillRulesUsed;
  }
  if (!validation.ok) {
    delete nextMeta.validationResolution;
  }

  return {
    ...node,
    content: hardRuleResult.content,
    meta: nextMeta,
  };
}

module.exports = {
  applyCanvasStoryboardValidation,
};
