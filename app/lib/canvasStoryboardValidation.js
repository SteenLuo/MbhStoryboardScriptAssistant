const {
  applyStoryboardHardRuleValidation,
  isStoryboardValidationResolved,
  validateStoryboardContent,
} = require("./storyboardValidation");

function applyCanvasStoryboardValidation(canvas = {}, options = {}) {
  return {
    ...canvas,
    nodes: Array.isArray(canvas.nodes)
      ? canvas.nodes.map((node) => applyStoryboardNodeValidation(node, options))
      : [],
  };
}

function applyStoryboardNodeValidation(node = {}, options = {}) {
  if (node.type !== "storyboard") return node;
  if (isStoryboardValidationResolved(node)) return node;

  const hardRuleResult = applyStoryboardHardRuleValidation(node.content || "", {
    useStableSkillRules: options.useStableSkillRules !== false,
  });
  const validation = hardRuleResult.validation || validateStoryboardContent(hardRuleResult.content || node.content || "");
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
