const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const UPDATED_SKILL_BEGIN = "=== UPDATED_SKILL_MD_BEGIN ===";
const UPDATED_SKILL_END = "=== UPDATED_SKILL_MD_END ===";
const CHANGE_SUMMARY_BEGIN = "=== CHANGE_SUMMARY_BEGIN ===";
const CHANGE_SUMMARY_END = "=== CHANGE_SUMMARY_END ===";
const VALIDATION_NOTES_BEGIN = "=== VALIDATION_NOTES_BEGIN ===";
const VALIDATION_NOTES_END = "=== VALIDATION_NOTES_END ===";

const SKILL_PATH_BY_ID = Object.freeze({
  "mbh-workflow": "skills/00-orchestrator/mbh-workflow",
  "novel-intake": "skills/01-input-analysis/novel-intake",
  "script-generate": "skills/02-script/script-generate",
  "script-hard-issue-review": "skills/02-script/script-hard-issue-review",
  "script-manju-adaptation-analysis": "skills/02-script/script-manju-adaptation-analysis",
  "script-review-rewrite": "skills/02-script/script-review-rewrite",
  "storyboard-generate": "skills/03-storyboard/storyboard-generate",
  "sample-ingest": "skills/04-learning/sample-ingest",
  "skill-creator": "skills/05-evolution/skill-creator",
});

function targetSkillPathFor(skillId) {
  return SKILL_PATH_BY_ID[String(skillId || "").trim()] || SKILL_PATH_BY_ID["skill-creator"];
}

async function readTargetSkillMarkdown(root, skillId) {
  const base = path.resolve(root);
  const resolvedSkillId = String(skillId || "skill-creator").trim() || "skill-creator";
  const skillRelativePath = targetSkillPathFor(resolvedSkillId);
  const skillDir = safeResolve(base, skillRelativePath);
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`目标技能不存在：${skillRelativePath}/SKILL.md`);
  }
  return {
    skillId: resolvedSkillId,
    skillPath: skillRelativePath,
    skillFile,
    relativePath: path.relative(base, skillFile).replace(/\\/g, "/"),
    markdown: await fsp.readFile(skillFile, "utf8"),
  };
}

async function writeSkillCreatorUpdatedSkill(root, input = {}) {
  const target = await readTargetSkillMarkdown(root, input.skillId);
  const parsed = parseSkillCreatorApplyResult(input.creatorOutput);
  validateUpdatedSkillMarkdown(parsed.updatedSkillMarkdown, target.markdown);

  const normalized = `${normalizeNewlines(parsed.updatedSkillMarkdown).trim()}\n`.replace(/\n/g, "\r\n");
  await fsp.writeFile(target.skillFile, normalized, "utf8");

  return {
    skillId: target.skillId,
    skillPath: target.skillPath,
    relativePath: target.relativePath,
    learningId: String(input.learningId || input.eventId || "").trim(),
    changeSummary: parsed.changeSummary,
    validationNotes: parsed.validationNotes,
  };
}

function parseSkillCreatorApplyResult(output) {
  const text = String(output || "").trim();
  if (!text) {
    throw new Error("skill-creator 没有返回可写入的修改结果");
  }

  const markedMarkdown = extractBetween(text, UPDATED_SKILL_BEGIN, UPDATED_SKILL_END).trim();
  if (markedMarkdown) {
    return {
      updatedSkillMarkdown: markedMarkdown,
      changeSummary: extractBetween(text, CHANGE_SUMMARY_BEGIN, CHANGE_SUMMARY_END).trim() || "已按技能学习材料更新。",
      validationNotes: extractBetween(text, VALIDATION_NOTES_BEGIN, VALIDATION_NOTES_END).trim() || "已通过基础格式校验。",
    };
  }

  const unwrapped = unwrapJsonFence(text);
  let data;
  try {
    data = JSON.parse(unwrapped);
  } catch (firstError) {
    const objectText = extractJsonObject(unwrapped);
    if (!objectText) {
      throw new Error(`skill-creator 返回格式不是 JSON：${firstError.message}`);
    }
    try {
      data = JSON.parse(objectText);
    } catch (secondError) {
      throw new Error(`skill-creator 返回 JSON 无法解析：${secondError.message}`);
    }
  }

  const updatedSkillMarkdown = String(
    data.updatedSkillMarkdown || data.skillMarkdown || data.skill_md || data.skill || "",
  ).trim();
  if (!updatedSkillMarkdown) {
    throw new Error("skill-creator 返回结果缺少 updatedSkillMarkdown");
  }

  return {
    updatedSkillMarkdown,
    changeSummary: String(data.changeSummary || data.summary || "已按技能学习材料更新。").trim(),
    validationNotes: String(data.validationNotes || data.validation || "已通过基础格式校验。").trim(),
  };
}

function validateUpdatedSkillMarkdown(updatedMarkdown, originalMarkdown = "") {
  const updated = normalizeNewlines(updatedMarkdown).trim();
  const original = normalizeNewlines(originalMarkdown).trim();
  const updatedMeta = parseFrontmatter(updated);
  const originalMeta = parseFrontmatter(original);

  if (!updatedMeta) {
    throw new Error("skill-creator 输出的 SKILL.md 缺少 YAML frontmatter");
  }
  if (!updatedMeta.fields.name) {
    throw new Error("skill-creator 输出的 SKILL.md 缺少 frontmatter.name");
  }
  if (!updatedMeta.fields.description) {
    throw new Error("skill-creator 输出的 SKILL.md 缺少 frontmatter.description");
  }
  if (originalMeta?.fields?.name && updatedMeta.fields.name !== originalMeta.fields.name) {
    throw new Error(`skill-creator 不应修改技能 name：${originalMeta.fields.name} -> ${updatedMeta.fields.name}`);
  }
  if (!/^#{1,6}\s+\S/m.test(updatedMeta.body)) {
    throw new Error("skill-creator 输出的 SKILL.md 正文缺少 Markdown 标题");
  }
  if (/MBH_SKILL_LEARNING_BEGIN|用户学习规则（自动写入）/.test(updated)) {
    throw new Error("skill-creator 输出仍包含旧的自动直写区块，拒绝写入");
  }
}

function parseFrontmatter(markdown) {
  const text = normalizeNewlines(markdown);
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!item) continue;
    fields[item[1]] = stripYamlScalar(item[2]);
  }
  return { fields, body: match[2] || "" };
}

function stripYamlScalar(value) {
  const trimmed = String(value || "").trim();
  const quoted = trimmed.match(/^(['"])([\s\S]*)\1$/);
  return quoted ? quoted[2].trim() : trimmed;
}

function unwrapJsonFence(text) {
  const match = String(text || "").trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : String(text || "").trim();
}

function extractJsonObject(text) {
  const value = String(text || "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) return "";
  return value.slice(start, end + 1);
}

function extractBetween(text, begin, end) {
  const value = String(text || "");
  const start = value.indexOf(begin);
  if (start === -1) return "";
  const contentStart = start + begin.length;
  const finish = value.indexOf(end, contentStart);
  if (finish === -1) return "";
  return value.slice(contentStart, finish).trim();
}

function safeResolve(base, relativePath) {
  const root = path.resolve(base);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("技能写入路径不合法");
  }
  return target;
}

function normalizeNewlines(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

module.exports = {
  CHANGE_SUMMARY_BEGIN,
  CHANGE_SUMMARY_END,
  parseSkillCreatorApplyResult,
  readTargetSkillMarkdown,
  targetSkillPathFor,
  UPDATED_SKILL_BEGIN,
  UPDATED_SKILL_END,
  validateUpdatedSkillMarkdown,
  VALIDATION_NOTES_BEGIN,
  VALIDATION_NOTES_END,
  writeSkillCreatorUpdatedSkill,
};
