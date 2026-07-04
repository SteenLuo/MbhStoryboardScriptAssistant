const {
  applyStoryboardHardRuleValidation,
  isStoryboardValidationResolved,
  validateStoryboardContent,
} = require("./storyboardValidation");

function applyCanvasStoryboardValidation(canvas = {}, options = {}) {
  const currentRulesUsed = Array.isArray(options.currentRulesUsed) ? options.currentRulesUsed : [];
  return {
    ...canvas,
    nodes: Array.isArray(canvas.nodes)
      ? canvas.nodes.map((node) => applyStoryboardNodeValidation(node, { currentRulesUsed }))
      : [],
  };
}

function applyStoryboardNodeValidation(node = {}, options = {}) {
  if (node.type !== "storyboard") return node;
  if (isStoryboardValidationResolved(node)) return node;

  const currentRulesUsed = Array.isArray(options.currentRulesUsed) ? options.currentRulesUsed : [];
  const hardRuleResult = applyStoryboardHardRuleValidation(node.content || "", { currentRulesUsed });
  const validation = hardRuleResult.validation || validateStoryboardContent(hardRuleResult.content || node.content || "");
  const nextMeta = {
    ...(node.meta || {}),
    validation,
  };

  if (currentRulesUsed.length) {
    nextMeta.currentRulesUsed = currentRulesUsed;
  }
  if (hardRuleResult.hardRuleValidation?.checked) {
    nextMeta.hardRuleValidation = hardRuleResult.hardRuleValidation;
  } else {
    delete nextMeta.hardRuleValidation;
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
