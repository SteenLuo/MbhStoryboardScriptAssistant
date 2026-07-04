const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("learning acceptance docs enumerate app test files instead of passing the app directory", () => {
  const designDoc = read("docs/自主学习机制闭环重构方案.md");

  assert.doesNotMatch(designDoc, /(^|\r?\n)node --test app(\r?\n|$)/);
  assert.match(designDoc, /Get-ChildItem -Path \.\\app -Recurse -Filter \*\.test\.js/);
  assert.match(designDoc, /node --test @appTests/);
});

test("service fixture manual checks have an explicit keep-alive mode and cleanup path", () => {
  const script = read("tools/Invoke-LearningAcceptance.ps1");
  const designDoc = read("docs/自主学习机制闭环重构方案.md");

  assert.match(script, /\[switch\]\$KeepAlive/);
  assert.match(script, /keepAlive = \$KeepAlive\.IsPresent/);
  assert.match(script, /pid = \$process\.Id/);
  assert.match(script, /\$shouldKeepAlive = \$KeepAlive\.IsPresent/);
  assert.match(script, /if \(!\$KeepAlive\) \{\s+\$startArgs\.RedirectStandardOutput = \$stdout\s+\$startArgs\.RedirectStandardError = \$stderr\s+\}/);
  assert.match(script, /if \(\$process -and !\$process\.HasExited -and !\$shouldKeepAlive\)/);

  assert.match(designDoc, /-ServiceMode -Port 17878 -KeepAlive/);
  assert.match(designDoc, /Stop-Process -Id \$servicePid/);
});
