const { parseEpisodeNumber, splitScriptIntoEpisodes } = require("./episodeSplit");

function analyzeCanvasArchiveReadiness(canvas = {}) {
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : [];
  const issues = [];
  const novels = finalNodesByType(nodes, "novel");
  const scripts = finalNodesByType(nodes, "script");
  const storyboards = finalNodesByType(nodes, "storyboard");

  if (novels.length > 1) {
    issues.push({
      code: "duplicate-novel-version",
      message: "小说存在多个最终版本，请先合并为唯一版本。",
    });
  }
  if (scripts.length !== 1) {
    issues.push({
      code: scripts.length ? "duplicate-script-version" : "missing-script-version",
      message: scripts.length ? "剧本存在多个最终版本，请先合并为唯一版本。" : "缺少剧本最终版本。",
    });
  }

  const requiredEpisodes = scripts.length === 1
    ? splitScriptIntoEpisodes(scripts[0].content).map((episode) => Number(episode.number || 1))
    : [];
  const storyboardByEpisode = new Map();
  for (const node of storyboards) {
    const episodeNumber = episodeNumberForStoryboard(node);
    if (!episodeNumber) {
      issues.push({
        code: "storyboard-missing-episode-number",
        nodeId: node.id,
        message: `分镜「${node.title || node.id}」缺少集数标记。`,
      });
      continue;
    }
    const group = storyboardByEpisode.get(episodeNumber) || [];
    group.push(node);
    storyboardByEpisode.set(episodeNumber, group);
  }

  for (const episodeNumber of requiredEpisodes) {
    const group = storyboardByEpisode.get(episodeNumber) || [];
    if (group.length === 0) {
      issues.push({
        code: "missing-storyboard-version",
        episodeNumber,
        message: `第 ${episodeNumber} 集缺少唯一分镜版本。`,
      });
    }
    if (group.length > 1) {
      issues.push({
        code: "duplicate-storyboard-version",
        episodeNumber,
        nodeIds: group.map((node) => node.id),
        message: `第 ${episodeNumber} 集存在多个分镜版本，请先合并为唯一版本。`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    requiredEpisodes,
    finalNodeIds: {
      novel: novels.map((node) => node.id),
      script: scripts.map((node) => node.id),
      storyboard: storyboards.map((node) => node.id),
    },
  };
}

function finalNodesByType(nodes, type) {
  const candidates = nodes.filter((node) => node?.type === type && !isRevisionNode(node));
  const merged = candidates.filter(isMergedNode);
  const covered = new Set();
  for (const node of merged) {
    for (const version of node.meta?.versions || []) {
      if (version?.nodeId) covered.add(String(version.nodeId));
    }
  }
  return candidates.filter((node) => isMergedNode(node) || !covered.has(String(node.id || "")));
}

function episodeNumberForStoryboard(node) {
  const fromMeta = Number(node?.meta?.episodeNumber || 0);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  const title = String(node?.title || "");
  const match = title.match(/第\s*([0-9]+|[一二三四五六七八九十]{1,3})\s*集/);
  return match ? parseEpisodeNumber(match[1]) : 0;
}

function isRevisionNode(node) {
  return node?.meta?.variantKind === "revision";
}

function isMergedNode(node) {
  return node?.meta?.variantKind === "merged";
}

module.exports = {
  analyzeCanvasArchiveReadiness,
  episodeNumberForStoryboard,
};
