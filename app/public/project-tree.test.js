const assert = require("assert");
const test = require("node:test");

const {
  isProjectExpanded,
  normalizeCollapsedProjectIds,
  toggleProjectExpansion,
} = require("./project-tree");

test("project is expanded by default when it is not collapsed", () => {
  const collapsed = normalizeCollapsedProjectIds(["other"]);

  assert.strictEqual(isProjectExpanded("no-project", collapsed), true);
  assert.strictEqual(isProjectExpanded("other", collapsed), false);
});

test("toggleProjectExpansion collapses an expanded project without changing current project", () => {
  const result = toggleProjectExpansion({
    projectId: "no-project",
    currentProjectId: "no-project",
    collapsedProjectIds: [],
  });

  assert.strictEqual(result.currentProjectId, "no-project");
  assert.deepStrictEqual(Array.from(result.collapsedProjectIds), ["no-project"]);
});

test("toggleProjectExpansion expands a collapsed project and makes it current", () => {
  const result = toggleProjectExpansion({
    projectId: "story",
    currentProjectId: "no-project",
    collapsedProjectIds: ["story"],
  });

  assert.strictEqual(result.currentProjectId, "story");
  assert.strictEqual(result.collapsedProjectIds.has("story"), false);
});
