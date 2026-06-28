const WORKBENCH_STAGES = [
  {
    task: "input-analysis",
    file: "input-analysis.md",
    title: "整理素材",
    actionLabel: "生成输入整理",
    description: "把小说、剧本或附件材料先理清楚，作为后续生成剧本和分镜的依据。",
  },
  {
    task: "script-generate",
    file: "generated-script.md",
    title: "生成剧本",
    actionLabel: "生成剧本",
    description: "把已整理的材料改编成适合 AI 漫剧生产的分场剧本。",
  },
  {
    task: "script-review",
    file: "script-review.md",
    title: "检查剧本",
    actionLabel: "评审剧本",
    description: "检查剧本能不能进入分镜环节，并给出通过、轻改或重写建议。",
  },
  {
    task: "storyboard-generate",
    file: "generated-storyboard.md",
    title: "生成分镜",
    actionLabel: "生成分镜",
    description: "基于剧本生成适合 AI 绘图和视频生成的分镜表。",
  },
  {
    task: "storyboard-review",
    file: "storyboard-review.md",
    title: "检查分镜",
    actionLabel: "评审分镜",
    description: "检查分镜是否覆盖剧情，镜头、景别、运镜和连续性是否达标。",
  },
];

const MIND_MAP_GROUPS = [
  {
    id: "group:input",
    title: "输入与理解",
    emptyText: "还没有输入材料或素材整理。",
    patterns: [
      { pattern: /^chat\.md$/i, title: "对话记录", type: "input" },
      { pattern: /^input\.md$/i, title: "输入材料", type: "input" },
      { pattern: /^input-analysis(?:-v(\d+))?\.md$/i, title: "素材理解", type: "analysis" },
    ],
  },
  {
    id: "group:script",
    title: "剧本生成与检查",
    emptyText: "还没有剧本版本或剧本检查记录。",
    patterns: [
      { pattern: /^generated-script(?:-v(\d+))?\.md$/i, title: "剧本", type: "script" },
      { pattern: /^script-review(?:-v(\d+))?\.md$/i, title: "剧本检查", type: "script-review" },
    ],
  },
  {
    id: "group:storyboard",
    title: "分镜生成与检查",
    emptyText: "还没有分镜版本或分镜检查记录。",
    patterns: [
      { pattern: /^generated-storyboard(?:-v(\d+))?\.md$/i, title: "分镜", type: "storyboard" },
      { pattern: /^storyboard-review(?:-v(\d+))?\.md$/i, title: "分镜检查", type: "storyboard-review" },
    ],
  },
  {
    id: "group:archive",
    title: "归档学习",
    emptyText: "整套流程完成后，可手动整理采纳清单并归档学习。",
    patterns: [
      { pattern: /^manual-learning-archive.*\.md$/i, title: "手动归档", type: "archive" },
    ],
  },
];

function parseArtifactNode(file, group) {
  for (const item of group.patterns) {
    const match = file.name.match(item.pattern);
    if (!match) continue;
    const version = Number(match[1] || 1);
    const title = item.type === "input" || item.type === "archive"
      ? item.title
      : `${item.title} v${version}`;
    return {
      id: `artifact:${file.name}`,
      type: item.type,
      title,
      file: file.name,
      status: "done",
      version,
      size: Number(file.size || 0),
      updatedAt: file.updatedAt || "",
      archiveEligible: item.type !== "input" && item.type !== "archive",
      children: [],
    };
  }
  return null;
}

function buildMindMapTree({ runName = "", files = [] } = {}) {
  const safeFiles = Array.isArray(files) ? files.filter((file) => file && file.name) : [];
  const children = MIND_MAP_GROUPS.map((group) => {
    const groupChildren = safeFiles
      .map((file) => parseArtifactNode(file, group))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.version !== b.version) return a.version - b.version;
        return a.title.localeCompare(b.title, "zh-Hans-CN");
      });

    return {
      id: group.id,
      type: "group",
      title: group.title,
      status: groupChildren.length ? "done" : "empty",
      emptyText: group.emptyText,
      children: groupChildren,
    };
  });

  return {
    id: `run:${runName || "未选择"}`,
    type: "root",
    title: "创作流程",
    status: children.some((node) => node.status === "done") ? "active" : "empty",
    runName,
    children,
  };
}

function buildWorkbenchState({ runName = "", files = [] } = {}) {
  const artifactMap = new Map(
    (Array.isArray(files) ? files : [])
      .filter((file) => file && file.name)
      .map((file) => [file.name, file]),
  );

  const stages = WORKBENCH_STAGES.map((stage) => {
    const artifact = artifactMap.get(stage.file);
    return {
      ...stage,
      status: artifact ? "done" : "todo",
      size: artifact ? Number(artifact.size || 0) : 0,
      updatedAt: artifact?.updatedAt || "",
    };
  });
  const tree = buildMindMapTree({ runName, files });
  const archiveCandidates = tree.children
    .flatMap((node) => node.children || [])
    .filter((node) => node.archiveEligible);

  return {
    runName,
    inputAvailable: artifactMap.has("input.md") || artifactMap.has("chat.md"),
    completedCount: stages.filter((stage) => stage.status === "done").length,
    totalCount: stages.length,
    stages,
    tree,
    archiveCandidates,
    nodeCount: tree.children.reduce((count, node) => count + 1 + (node.children || []).length, 1),
  };
}

function buildArchiveRecordMarkdown({ runName = "", selections = [], createdAt = new Date().toISOString() } = {}) {
  const safeSelections = Array.isArray(selections) ? selections : [];
  const lines = [
    "# 手动归档学习记录",
    "",
    "来源类型：manual-archive",
    `运行目录：${runName || "未指定"}`,
    `归档时间：${createdAt}`,
    "",
    "## 采纳清单",
    "",
  ];

  if (!safeSelections.length) {
    lines.push("暂无采纳项。");
  }

  safeSelections.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.title || "未命名节点"}`);
    lines.push("");
    lines.push(`- 来源文件：${item.file || "未指定"}`);
    lines.push(`- 采纳范围：${item.scope || "未填写"}`);
    lines.push(`- 处理决定：${item.decision || "采纳"}`);
    lines.push(`- 采纳原因：${item.reason || "未填写"}`);
    lines.push("");
  });

  lines.push("## 后续学习提示");
  lines.push("");
  lines.push("正式规则仍需人工确认；本记录作为候选学习证据进入后续学习闭环。");
  lines.push("");
  return lines.join("\n");
}

module.exports = {
  WORKBENCH_STAGES,
  buildArchiveRecordMarkdown,
  buildWorkbenchState,
  buildMindMapTree,
};
