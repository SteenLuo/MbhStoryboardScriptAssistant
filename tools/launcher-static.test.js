const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.join(__dirname, "..");
const startScript = fs.readFileSync(path.join(__dirname, "Start-MbhAssistant.ps1"), "utf8");
const packageScript = fs.readFileSync(path.join(__dirname, "New-CustomerTrialPackage.ps1"), "utf8");
const startBat = fs.readFileSync(path.join(rootDir, "启动助手.bat"), "utf8");
const restartBat = fs.readFileSync(path.join(rootDir, "重启服务.bat"), "utf8");

test("PowerShell startup supports skipping browser launch", () => {
  assert.match(startScript, /\[switch\]\$NoOpenBrowser/);
  assert.match(startScript, /function Open-AssistantPage/);
  assert.match(startScript, /if \(\$NoOpenBrowser\)/);
  assert.match(startScript, /Browser launch skipped/);
});

test("double-click launcher opens browser by default and accepts no-open option", () => {
  assert.match(startBat, /START_ARGS=/);
  assert.match(startBat, /--no-open-browser/);
  assert.match(startBat, /-NoOpenBrowser/);
  assert.match(startBat, /Start-MbhAssistant\.ps1" %START_ARGS%/);
});

test("restart launcher defaults to no browser for development restarts", () => {
  assert.match(restartBat, /START_ARGS=/);
  assert.match(restartBat, /START_ARGS=-NoOpenBrowser/);
  assert.match(restartBat, /--open-browser/);
  assert.match(restartBat, /--no-open-browser/);
  assert.match(restartBat, /Start-MbhAssistant\.ps1" %START_ARGS%/);
});

test("customer package excludes internal prototype pages", () => {
  assert.match(packageScript, /app\/public\/prototypes/);
});
