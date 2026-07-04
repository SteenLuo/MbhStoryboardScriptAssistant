const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const NOTIFICATION_STATUSES = new Set(["unread", "handled", "withdrawn"]);
const TYPE_PRIORITY = {
  learning: 0,
  system: 1,
  care: 2,
};

function notificationFile(root) {
  return path.join(root, "app", "data", "notifications.json");
}

async function readNotificationStore(root) {
  const file = notificationFile(root);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(await fsp.readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed.map(normalizeNotification).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeNotificationStore(root, notifications) {
  const file = notificationFile(root);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(
    file,
    JSON.stringify((Array.isArray(notifications) ? notifications : []).map(normalizeNotification).filter(Boolean), null, 2),
    "utf8",
  );
}

async function addNotification(root, notification, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const idSource = options.idSource || (() => `notice-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const createdAt = now();
  const notifications = await readNotificationStore(root);
  const normalized = normalizeNotification({
    ...notification,
    id: notification?.id || idSource(),
    status: "unread",
    createdAt: notification?.createdAt || createdAt,
    updatedAt: createdAt,
  });

  const existingIndex = notifications.findIndex((item) =>
    item.status === "unread" &&
    item.sourceType &&
    item.sourceId &&
    item.sourceType === normalized.sourceType &&
    item.sourceId === normalized.sourceId
  );

  const next = existingIndex >= 0
    ? notifications.map((item, index) => index === existingIndex
      ? { ...item, ...normalized, id: item.id, createdAt: item.createdAt, updatedAt: createdAt }
      : item)
    : [...notifications, normalized];

  await writeNotificationStore(root, next);
  return existingIndex >= 0 ? next[existingIndex] : normalized;
}

async function listNotifications(root, options = {}) {
  const notifications = await readNotificationStore(root);
  const visible = options.includeHandled
    ? notifications
    : notifications.filter((item) => item.status === "unread");
  return visible.sort(compareNotifications);
}

async function handleNotification(root, id, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const handledAt = now();
  const notifications = await readNotificationStore(root);
  let handled = null;
  const next = notifications.map((item) => {
    if (item.id !== id) return item;
    handled = {
      ...item,
      status: "handled",
      handledAt,
      updatedAt: handledAt,
    };
    return handled;
  });
  if (!handled) throw new Error("通知不存在");
  await writeNotificationStore(root, next);
  return handled;
}

async function withdrawNotificationsForSource(root, sourceType, sourceId, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const handledAt = now();
  const notifications = await readNotificationStore(root);
  const withdrawn = [];
  const next = notifications.map((item) => {
    if (
      item.status !== "unread" ||
      item.sourceType !== sourceType ||
      item.sourceId !== sourceId
    ) {
      return item;
    }
    const updated = {
      ...item,
      status: "withdrawn",
      handledAt,
      updatedAt: handledAt,
    };
    withdrawn.push(updated);
    return updated;
  });
  if (withdrawn.length) await writeNotificationStore(root, next);
  return withdrawn;
}

function normalizeNotification(notification) {
  if (!notification || typeof notification !== "object") return null;
  const id = String(notification.id || "").trim();
  if (!id) return null;
  const status = NOTIFICATION_STATUSES.has(notification.status) ? notification.status : "unread";
  return {
    id,
    type: String(notification.type || "system").trim() || "system",
    sourceId: String(notification.sourceId || "").trim(),
    sourceType: String(notification.sourceType || "").trim(),
    title: String(notification.title || "通知").trim() || "通知",
    summary: String(notification.summary || "").trim(),
    target: notification.target && typeof notification.target === "object" ? notification.target : {},
    status,
    createdAt: String(notification.createdAt || notification.updatedAt || new Date().toISOString()),
    updatedAt: String(notification.updatedAt || notification.createdAt || new Date().toISOString()),
    handledAt: notification.handledAt ? String(notification.handledAt) : "",
  };
}

function compareNotifications(left, right) {
  const leftPriority = TYPE_PRIORITY[left.type] ?? 9;
  const rightPriority = TYPE_PRIORITY[right.type] ?? 9;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  return String(left.createdAt).localeCompare(String(right.createdAt));
}

module.exports = {
  addNotification,
  handleNotification,
  listNotifications,
  readNotificationStore,
  withdrawNotificationsForSource,
};
