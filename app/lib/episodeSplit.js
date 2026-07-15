const CHINESE_NUMBERS = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseEpisodeNumber(value) {
  const text = String(value || "").replace(/\s+/g, "").trim();
  if (/^\d+$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.startsWith("十")) return 10 + (CHINESE_NUMBERS[text.slice(1)] || 0);
  if (text.endsWith("十")) return (CHINESE_NUMBERS[text[0]] || 1) * 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (CHINESE_NUMBERS[tens] || 1) * 10 + (CHINESE_NUMBERS[ones] || 0);
  }
  return CHINESE_NUMBERS[text] || 1;
}

function normalizeEpisodeHeadingTitle(value) {
  return String(value || "")
    .trim()
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .trim();
}

function splitScriptIntoEpisodes(scriptText) {
  const source = String(scriptText || "").trim();
  if (!source) return [{ number: 1, title: "第1集", content: "" }];
  const headingPattern = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?(第\s*([0-9]+|[一二三四五六七八九十]{1,3})\s*集(?=$|\s|[：:\-—*])(?:[^\n]*?))(?:\*\*)?(?=\s*(?:\n|$))/g;
  const matches = [];
  let match;
  while ((match = headingPattern.exec(source)) !== null) {
    matches.push({
      index: match.index + match[0].indexOf(match[1]),
      blockIndex: match.index,
      contentIndex: match.index + match[0].length,
      full: normalizeEpisodeHeadingTitle(match[1]),
      rawNumber: match[2],
    });
  }
  if (!matches.length) {
    return [{ number: 1, title: "第1集", content: source }];
  }
  return matches.map((item, index) => {
    const next = matches[index + 1];
    return {
      number: parseEpisodeNumber(item.rawNumber),
      title: item.full,
      content: source.slice(item.contentIndex, next ? next.blockIndex : source.length).trim(),
    };
  });
}

function buildStoryboardNodePlan({ scriptNodeId, episodes = [], origin = {} } = {}, idSource = () => Math.random().toString(16).slice(2, 8)) {
  const startX = Number.isFinite(Number(origin.x)) ? Number(origin.x) + 460 : 700;
  const startY = Number.isFinite(Number(origin.y)) ? Number(origin.y) : 120;
  const nodes = episodes.map((episode, index) => {
    const id = `storyboard-${idSource()}-${index + 1}`;
    return {
      id,
      type: "storyboard",
      title: `${episode.title || `第${episode.number || index + 1}集`} 分镜`,
      content: "",
      x: startX,
      y: startY + index * 300,
      width: 380,
      height: 260,
      meta: {
        episodeNumber: episode.number || index + 1,
        episodeTitle: episode.title || "",
        sourceScriptNodeId: scriptNodeId,
      },
    };
  });
  return {
    nodes,
    edges: nodes.map((node) => ({
      id: `edge-${scriptNodeId}-${node.id}`,
      from: scriptNodeId,
      to: node.id,
      label: "生成分镜",
    })),
  };
}

module.exports = {
  buildStoryboardNodePlan,
  parseEpisodeNumber,
  splitScriptIntoEpisodes,
};
