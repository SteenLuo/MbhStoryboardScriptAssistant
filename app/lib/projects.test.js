const assert = require("assert");
const test = require("node:test");

const {
  DEFAULT_PROJECT_ID,
  createProject,
  groupConversationsByProject,
  normalizeProjects,
  renameProject,
} = require("./projects");

test("normalizeProjects always keeps the no-project bucket first", () => {
  const projects = normalizeProjects([
    { id: "custom", title: "猫剧项目", createdAt: "2026-06-10T00:00:00.000Z" },
  ]);

  assert.strictEqual(projects[0].id, DEFAULT_PROJECT_ID);
  assert.strictEqual(projects[0].title, "无项目");
  assert.strictEqual(projects[1].id, "custom");
});

test("groupConversationsByProject puts legacy conversations under no-project", () => {
  const projects = normalizeProjects([{ id: "p1", title: "项目一" }]);
  const grouped = groupConversationsByProject([
    { id: "old", title: "旧对话" },
    { id: "new", title: "新对话", projectId: "p1" },
    { id: "missing", title: "坏引用", projectId: "gone" },
  ], projects);

  assert.deepStrictEqual(grouped.map((item) => item.id), [DEFAULT_PROJECT_ID, "p1"]);
  assert.deepStrictEqual(grouped[0].conversations.map((item) => item.id), ["old", "missing"]);
  assert.deepStrictEqual(grouped[1].conversations.map((item) => item.id), ["new"]);
});

test("createProject creates stable local project records with safe titles", () => {
  const result = createProject([], "  新 剧目  ", () => "2026-06-27T00:00:00.000Z", () => "abcd12");

  assert.strictEqual(result.project.id, "project-abcd12");
  assert.strictEqual(result.project.title, "新 剧目");
  assert.strictEqual(result.projects[0].id, DEFAULT_PROJECT_ID);
  assert.strictEqual(result.projects[1].id, "project-abcd12");
});

test("renameProject updates a custom project title", () => {
  const projects = normalizeProjects([
    { id: "p1", title: "旧项目", createdAt: "2026-06-27T00:00:00.000Z" },
  ], () => "2026-06-27T00:00:00.000Z");
  const result = renameProject(projects, "p1", "  新 项目  ", () => "2026-06-28T00:00:00.000Z");

  assert.strictEqual(result.project.id, "p1");
  assert.strictEqual(result.project.title, "新 项目");
  assert.strictEqual(result.project.createdAt, "2026-06-27T00:00:00.000Z");
  assert.strictEqual(result.project.updatedAt, "2026-06-28T00:00:00.000Z");
});

test("renameProject can rename the no-project bucket while keeping it first", () => {
  const result = renameProject([], DEFAULT_PROJECT_ID, "临时收纳", () => "2026-06-28T00:00:00.000Z");

  assert.strictEqual(result.project.id, DEFAULT_PROJECT_ID);
  assert.strictEqual(result.project.title, "临时收纳");
  assert.strictEqual(result.projects[0].id, DEFAULT_PROJECT_ID);
  assert.strictEqual(result.projects[0].title, "临时收纳");
});
