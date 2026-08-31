const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const { resolveSessionSecret } = require("../lib/sessionSecret");

test("resolveSessionSecret uses fallback in non-production", () => {
  const prev = { NODE_ENV: process.env.NODE_ENV, SESSION_SECRET: process.env.SESSION_SECRET };
  process.env.NODE_ENV = "test";
  delete process.env.SESSION_SECRET;
  assert.equal(resolveSessionSecret(), "dev-insecure-secret");
  process.env.NODE_ENV = prev.NODE_ENV;
  if (prev.SESSION_SECRET) process.env.SESSION_SECRET = prev.SESSION_SECRET;
});

test("resolveSessionSecret exits in production without secret", () => {
  const res = spawnSync(process.execPath, ["-e", "require('./lib/sessionSecret').resolveSessionSecret()"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "" },
    encoding: "utf8"
  });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /SESSION_SECRET/i);
});

test("resolveSessionSecret exits in production with short secret", () => {
  const res = spawnSync(process.execPath, ["-e", "require('./lib/sessionSecret').resolveSessionSecret()"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "short" },
    encoding: "utf8"
  });
  assert.notEqual(res.status, 0);
});
