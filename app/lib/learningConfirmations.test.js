const assert = require("assert");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

const { applyLearningDecision } = require("./learningConfirmations");

test("applyLearningDecision writes confirmed preference when remembered", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-confirm-"));
  const conversation = {
    messages: [
      { role: "user", content: "以后分镜不要连续固定镜头" },
      {
        role: "assistant",
        content: "收到",
        learningSuggestion: {
          status: "pending",
          summary: "分镜要避免连续固定镜头。",
          source: "learning/conversation-records/test.md",
        },
      },
    ],
  };

  const result = await applyLearningDecision(
    root,
    { conversation, messageIndex: 1, action: "remember" },
    () => new Date("2026-06-11T04:30:00Z"),
  );

  const confirmedPath = path.join(root, "learning", "accepted-rules", "web-confirmed-preferences.md");
  const text = fs.readFileSync(confirmedPath, "utf8");
  assert.strictEqual(result.status, "remembered");
  assert.strictEqual(conversation.messages[1].learningSuggestion.status, "remembered");
  assert.match(text, /分镜要避免连续固定镜头/);
});

test("applyLearningDecision skips without writing confirmed preference", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "mbh-confirm-"));
  const conversation = {
    messages: [
      { role: "user", content: "测试" },
      {
        role: "assistant",
        content: "收到",
        learningSuggestion: {
          status: "pending",
          summary: "临时偏好。",
        },
      },
    ],
  };

  const result = await applyLearningDecision(root, { conversation, messageIndex: 1, action: "skip" });

  assert.strictEqual(result.status, "skipped");
  assert.strictEqual(conversation.messages[1].learningSuggestion.status, "skipped");
  assert.strictEqual(fs.existsSync(path.join(root, "learning", "accepted-rules", "web-confirmed-preferences.md")), false);
});
