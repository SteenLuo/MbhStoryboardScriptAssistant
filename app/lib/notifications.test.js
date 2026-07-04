const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  addNotification,
  handleNotification,
  listNotifications,
  withdrawNotificationsForSource,
} = require("./notifications");

async function tempRoot() {
  return fsp.mkdtemp(path.join(os.tmpdir(), "mbh-notifications-"));
}

test("addNotification persists unread notifications and prioritizes learning failures", async () => {
  const root = await tempRoot();
  const times = [
    "2026-07-01T10:01:00.000Z",
    "2026-07-01T10:00:00.000Z",
  ];
  let timeIndex = 0;
  let idIndex = 0;
  const now = () => times[timeIndex++];
  const idSource = () => `notice-${++idIndex}`;

  await addNotification(root, {
    type: "care",
    title: "记得吃饭",
    summary: "到饭点了",
    target: { page: "home" },
  }, { now, idSource });
  await addNotification(root, {
    type: "learning",
    sourceType: "learning-event",
    sourceId: "event-1",
    title: "学习失败",
    summary: "分镜台词长度规则未能发布",
    target: { page: "learning", eventId: "event-1" },
  }, { now, idSource });

  const unread = await listNotifications(root);

  assert.deepStrictEqual(unread.map((item) => item.id), ["notice-2", "notice-1"]);
  assert.strictEqual(unread[0].status, "unread");
  assert.deepStrictEqual(unread[0].target, { page: "learning", eventId: "event-1" });
});

test("handleNotification marks a notification handled without deleting evidence", async () => {
  const root = await tempRoot();
  await addNotification(root, {
    type: "learning",
    sourceId: "event-2",
    title: "学习失败",
    summary: "规则发布失败",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "notice-1",
  });

  const handled = await handleNotification(root, "notice-1", {
    now: () => "2026-07-01T10:05:00.000Z",
  });
  const unread = await listNotifications(root);
  const all = await listNotifications(root, { includeHandled: true });

  assert.strictEqual(handled.status, "handled");
  assert.strictEqual(handled.handledAt, "2026-07-01T10:05:00.000Z");
  assert.deepStrictEqual(unread, []);
  assert.strictEqual(all[0].status, "handled");
});

test("withdrawNotificationsForSource removes stale unread prompts for covered events", async () => {
  const root = await tempRoot();
  await addNotification(root, {
    type: "learning",
    sourceType: "learning-event",
    sourceId: "event-old",
    title: "学习失败",
    summary: "旧规则失败",
  }, {
    now: () => "2026-07-01T10:00:00.000Z",
    idSource: () => "notice-old",
  });

  const withdrawn = await withdrawNotificationsForSource(root, "learning-event", "event-old", {
    now: () => "2026-07-01T10:10:00.000Z",
  });
  const unread = await listNotifications(root);
  const all = await listNotifications(root, { includeHandled: true });

  assert.strictEqual(withdrawn.length, 1);
  assert.strictEqual(withdrawn[0].status, "withdrawn");
  assert.deepStrictEqual(unread, []);
  assert.strictEqual(all[0].handledAt, "2026-07-01T10:10:00.000Z");
});
