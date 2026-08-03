const CHINESE_NUMBERS = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  两: 2,
  贰: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
  十: 10,
  拾: 10,
};

const CHINESE_NUMBER_UNITS = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
};

const EPISODE_DECORATED_NUMBER_SOURCE = "[①-⑳⑴-⒇⒈-⒛❶-❿➀-➉➊-➓㉑-㉟㊱-㊿]";
const EPISODE_KEYCAP_NUMBER_SOURCE = "(?:[0-9]\\uFE0F?\\u20E3)+";
const EPISODE_NUMBER_TOKEN_SOURCE = `(?:[0-9０-９]+|${EPISODE_KEYCAP_NUMBER_SOURCE}|[零〇一二三四五六七八九十百千两壹贰叁肆伍陆柒捌玖拾佰仟]+|${EPISODE_DECORATED_NUMBER_SOURCE})`;
const EPISODE_WRAPPER_OPEN_SOURCE = "[\\(（﹙\\[［【﹝\\{｛<＜〈《「『〔〖〘〚]";
const EPISODE_WRAPPER_CLOSE_SOURCE = "[\\)）﹚\\]］】﹞\\}｝>＞〉》」』〕〗〙〛]";
const EPISODE_UNIT_SOURCE = "[集话章回期]";
const EPISODE_HEADING_BOUNDARY_SOURCE = "(?=$|\\s|[：:\\-—])";

const DECORATED_NUMBER_RANGES = [
  { start: 0x2460, end: 0x2473, offset: 1 },
  { start: 0x2474, end: 0x2487, offset: 1 },
  { start: 0x2488, end: 0x249b, offset: 1 },
  { start: 0x2776, end: 0x277f, offset: 1 },
  { start: 0x2780, end: 0x2789, offset: 1 },
  { start: 0x278a, end: 0x2793, offset: 1 },
  { start: 0x3251, end: 0x325f, offset: 21 },
  { start: 0x32b1, end: 0x32bf, offset: 36 },
];

const EPISODE_WRAPPER_PAIRS = new Map([
  ["(", ")"],
  ["（", "）"],
  ["﹙", "﹚"],
  ["[", "]"],
  ["［", "］"],
  ["【", "】"],
  ["﹝", "﹞"],
  ["{", "}"],
  ["｛", "｝"],
  ["<", ">"],
  ["＜", "＞"],
  ["〈", "〉"],
  ["《", "》"],
  ["「", "」"],
  ["『", "』"],
  ["〔", "〕"],
  ["〖", "〗"],
  ["〘", "〙"],
  ["〚", "〛"],
]);

function normalizeFullWidthDigits(value) {
  return String(value || "").replace(/[０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0));
}

function parseDecoratedEpisodeNumber(value) {
  const text = String(value || "").trim();
  if ([...text].length !== 1) return 0;
  const codePoint = text.codePointAt(0);
  for (const range of DECORATED_NUMBER_RANGES) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return codePoint - range.start + range.offset;
    }
  }
  return 0;
}

function parseEpisodeNumber(value) {
  const text = normalizeFullWidthDigits(value)
    .replace(/\uFE0F?\u20E3/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (/^\d+$/.test(text)) return Number(text);
  const decoratedNumber = parseDecoratedEpisodeNumber(text);
  if (decoratedNumber) return decoratedNumber;
  if (!/^[零〇一二三四五六七八九十百千两壹贰叁肆伍陆柒捌玖拾佰仟]+$/.test(text)) return 1;
  if (!/[十拾百佰千仟]/.test(text)) {
    const digits = [...text].map((character) => CHINESE_NUMBERS[character]);
    if (digits.some((digit) => digit === undefined)) return 1;
    const parsed = Number(digits.join(""));
    return parsed > 0 ? parsed : 1;
  }
  let total = 0;
  let current = 0;
  for (const character of text) {
    if (Object.prototype.hasOwnProperty.call(CHINESE_NUMBER_UNITS, character)) {
      total += (current || 1) * CHINESE_NUMBER_UNITS[character];
      current = 0;
    } else {
      current = CHINESE_NUMBERS[character] || 0;
    }
  }
  return total + current || 1;
}

function normalizeEpisodeHeadingTitle(value) {
  return String(value || "")
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/[*_`]+/g, "")
    .trim();
}

function stripMatchingEpisodeWrappers(value) {
  let text = String(value || "").trim();
  let changed = false;
  while (text.length >= 2) {
    const close = EPISODE_WRAPPER_PAIRS.get(text[0]);
    if (!close || text.at(-1) !== close) break;
    text = text.slice(1, -1).trim();
    changed = true;
  }
  return { text, changed };
}

function stripLeadingEpisodeOrdinal(value) {
  const prefixPattern = new RegExp(
    `^(?:${EPISODE_WRAPPER_OPEN_SOURCE}\\s*${EPISODE_NUMBER_TOKEN_SOURCE}\\s*${EPISODE_WRAPPER_CLOSE_SOURCE}|${EPISODE_DECORATED_NUMBER_SOURCE}|[0-9０-９]+[.、．。\\)）])\\s*(.+)$`,
  );
  return String(value || "").match(prefixPattern)?.[1]?.trim() || "";
}

function matchExplicitEpisodeHeading(value) {
  const pattern = new RegExp(
    `^${EPISODE_WRAPPER_OPEN_SOURCE}?\\s*(?:第\\s*)?${EPISODE_WRAPPER_OPEN_SOURCE}?\\s*(${EPISODE_NUMBER_TOKEN_SOURCE})\\s*${EPISODE_WRAPPER_CLOSE_SOURCE}?\\s*${EPISODE_UNIT_SOURCE}${EPISODE_WRAPPER_CLOSE_SOURCE}?${EPISODE_HEADING_BOUNDARY_SOURCE}(?:.*)$`,
    "i",
  );
  return String(value || "").match(pattern);
}

function extractEpisodeHeading(value) {
  const title = normalizeEpisodeHeadingTitle(value);
  if (!title) return null;
  const unwrapped = stripMatchingEpisodeWrappers(title);
  const candidates = [title, unwrapped.text];
  const withoutOrdinal = stripLeadingEpisodeOrdinal(unwrapped.text);
  if (withoutOrdinal) candidates.push(withoutOrdinal);

  for (const candidate of candidates) {
    const explicit = matchExplicitEpisodeHeading(candidate);
    if (explicit) return { full: title, rawNumber: explicit[1] };
    const english = candidate.match(new RegExp(
      `^(?:EP|EPISODE)\\.?\\s*(${EPISODE_NUMBER_TOKEN_SOURCE})${EPISODE_HEADING_BOUNDARY_SOURCE}(?:.*)$`,
      "i",
    ));
    if (english) return { full: title, rawNumber: english[1] };
  }

  const standalonePattern = new RegExp(`^(${EPISODE_NUMBER_TOKEN_SOURCE})$`);
  if (unwrapped.changed) {
    const standalone = unwrapped.text.match(standalonePattern);
    if (standalone) return { full: title, rawNumber: standalone[1] };
  }
  const decorated = title.match(new RegExp(`^(${EPISODE_DECORATED_NUMBER_SOURCE}|${EPISODE_KEYCAP_NUMBER_SOURCE})$`));
  if (decorated) return { full: title, rawNumber: decorated[1] };
  const punctuated = title.match(new RegExp(`^(${EPISODE_NUMBER_TOKEN_SOURCE})\\s*[.、．。\\)）]$`));
  if (punctuated) return { full: title, rawNumber: punctuated[1] };
  return null;
}

function extractBareEpisodeHeading(value, followingText) {
  const title = normalizeEpisodeHeadingTitle(value);
  const bareNumber = title.match(new RegExp(`^(${EPISODE_NUMBER_TOKEN_SOURCE})$`));
  if (!bareNumber) return null;
  const episodeNumber = parseEpisodeNumber(bareNumber[1]);
  const nextLine = String(followingText || "")
    .split(/\r\n|\n|\r/)
    .map((line) => normalizeFullWidthDigits(line).trim())
    .find(Boolean);
  if (!nextLine) return null;
  const scenePrefix = new RegExp(`^${episodeNumber}\\s*[-—－]\\s*\\d+(?=$|\\s|[：:])`);
  if (!scenePrefix.test(nextLine)) return null;
  return { full: title, rawNumber: bareNumber[1] };
}

function splitScriptIntoEpisodes(scriptText) {
  const source = String(scriptText || "").trim();
  if (!source) return [{ number: 1, title: "第1集", content: "" }];
  const matches = [];
  const linePattern = /[^\r\n]*(?:\r\n|\n|\r|$)/g;
  let lineMatch;
  while ((lineMatch = linePattern.exec(source)) !== null) {
    if (!lineMatch[0]) break;
    const rawLine = lineMatch[0].replace(/[\r\n]+$/, "");
    const contentIndex = lineMatch.index + lineMatch[0].length;
    const heading = extractEpisodeHeading(rawLine)
      || extractBareEpisodeHeading(rawLine, source.slice(contentIndex));
    if (!heading) continue;
    matches.push({
      blockIndex: lineMatch.index,
      contentIndex,
      full: heading.full,
      rawNumber: heading.rawNumber,
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
  extractBareEpisodeHeading,
  extractEpisodeHeading,
  parseEpisodeNumber,
  splitScriptIntoEpisodes,
};
