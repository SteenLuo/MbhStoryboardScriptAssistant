const assert = require("assert");
const test = require("node:test");

const { buildAssistantMessage } = require("./chatUsage");

test("buildAssistantMessage stores model and token usage on assistant messages", () => {
  const message = buildAssistantMessage(
    {
      content: "连接成功。",
      model: "deepseek-v4-flash",
      usage: {
        prompt_tokens: 205,
        completion_tokens: 211,
        total_tokens: 416,
      },
      skillRoute: {
        id: "storyboard-generate",
        name: "分镜生成",
      },
      chatIntent: {
        intent: "storyboard",
        mode: "skill",
      },
      scriptGrade: "A",
    },
    () => new Date("2026-06-11T03:54:53.198Z"),
  );

  assert.deepStrictEqual(message, {
    role: "assistant",
    content: "连接成功。",
    time: "2026-06-11T03:54:53.198Z",
    model: "deepseek-v4-flash",
    usage: {
      prompt_tokens: 205,
      completion_tokens: 211,
      total_tokens: 416,
    },
    skillRoute: {
      id: "storyboard-generate",
      name: "分镜生成",
    },
    chatIntent: {
      intent: "storyboard",
      mode: "skill",
    },
    scriptGrade: "A",
  });
});
