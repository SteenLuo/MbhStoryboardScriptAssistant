const assert = require("assert");
const test = require("node:test");

const { buildArchiveRecordMarkdown, buildWorkbenchState, WORKBENCH_STAGES } = require("./workbench");

test("WORKBENCH_STAGES defines the M8 stage order and output files", () => {
  assert.deepStrictEqual(
    WORKBENCH_STAGES.map((stage) => [stage.task, stage.file]),
    [
      ["input-analysis", "input-analysis.md"],
      ["script-generate", "generated-script.md"],
      ["script-review", "script-review.md"],
      ["storyboard-generate", "generated-storyboard.md"],
      ["storyboard-review", "storyboard-review.md"],
    ],
  );
});

test("buildWorkbenchState marks completed stages from artifacts", () => {
  const state = buildWorkbenchState({
    runName: "20260611-demo",
    files: [
      { name: "input.md", size: 20, updatedAt: "2026-06-11T00:00:00.000Z" },
      { name: "generated-script.md", size: 120, updatedAt: "2026-06-11T00:05:00.000Z" },
    ],
  });

  assert.strictEqual(state.runName, "20260611-demo");
  assert.strictEqual(state.inputAvailable, true);
  assert.strictEqual(state.completedCount, 1);
  assert.strictEqual(state.totalCount, WORKBENCH_STAGES.length);
  assert.strictEqual(state.stages[1].status, "done");
  assert.strictEqual(state.stages[1].size, 120);
  assert.strictEqual(state.stages[0].status, "todo");
  assert.strictEqual(state.stages[0].actionLabel, "生成输入整理");
});

test("buildWorkbenchState keeps artifact lookup scoped to stage outputs", () => {
  const state = buildWorkbenchState({
    runName: "run",
    files: [
      { name: "feedback.md", size: 50, updatedAt: "2026-06-11T00:00:00.000Z" },
      { name: "storyboard-review.md", size: 500, updatedAt: "2026-06-11T00:10:00.000Z" },
    ],
  });

  assert.strictEqual(state.completedCount, 1);
  assert.strictEqual(state.stages[4].status, "done");
  assert.strictEqual(state.stages[4].file, "storyboard-review.md");
  assert.strictEqual(state.stages[2].status, "todo");
});

test("buildWorkbenchState builds a mind map tree with versioned artifacts", () => {
  const state = buildWorkbenchState({
    runName: "20260611-demo",
    files: [
      { name: "chat.md", size: 20, updatedAt: "2026-06-11T00:00:00.000Z" },
      { name: "generated-script.md", size: 120, updatedAt: "2026-06-11T00:05:00.000Z" },
      { name: "generated-script-v2.md", size: 140, updatedAt: "2026-06-11T00:08:00.000Z" },
      { name: "script-review-v2.md", size: 80, updatedAt: "2026-06-11T00:10:00.000Z" },
      { name: "generated-storyboard.md", size: 300, updatedAt: "2026-06-11T00:20:00.000Z" },
    ],
  });

  const scriptNode = state.tree.children.find((node) => node.id === "group:script");
  const storyboardNode = state.tree.children.find((node) => node.id === "group:storyboard");

  assert.strictEqual(state.tree.title, "创作流程");
  assert.ok(scriptNode.children.some((node) => node.title === "剧本 v1" && node.file === "generated-script.md"));
  assert.ok(scriptNode.children.some((node) => node.title === "剧本 v2" && node.file === "generated-script-v2.md"));
  assert.ok(scriptNode.children.some((node) => node.title === "剧本检查 v2" && node.file === "script-review-v2.md"));
  assert.ok(storyboardNode.children.some((node) => node.title === "分镜 v1" && node.file === "generated-storyboard.md"));
  assert.ok(state.archiveCandidates.some((node) => node.file === "generated-script-v2.md"));
});

test("buildArchiveRecordMarkdown records mixed accepted selections", () => {
  const markdown = buildArchiveRecordMarkdown({
    runName: "run-a",
    createdAt: "2026-06-11T00:00:00.000Z",
    selections: [
      {
        title: "剧本 v1",
        file: "generated-script.md",
        scope: "第1-2集",
        decision: "采纳",
        reason: "冲突更清楚",
      },
      {
        title: "剧本 v2",
        file: "generated-script-v2.md",
        scope: "第3-4集",
        decision: "采纳",
        reason: "节奏更快",
      },
    ],
  });

  assert.match(markdown, /运行目录：run-a/);
  assert.match(markdown, /来源类型：manual-archive/);
  assert.match(markdown, /第1-2集/);
  assert.match(markdown, /generated-script-v2\.md/);
  assert.match(markdown, /节奏更快/);
});
