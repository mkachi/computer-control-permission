import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after, beforeEach } from "node:test";
import type { Options } from "../../computer-control-overlay/src/args";
import {
  persistResult,
  responseDecision,
  shouldDisplayPrompt,
} from "../../computer-control-overlay/src/policy";

const generated = path.resolve(__dirname, "..", "generated", "electron-policy");

beforeEach(() => {
  fs.rmSync(generated, { recursive: true, force: true });
  fs.mkdirSync(generated, { recursive: true });
});

after(() => {
  fs.rmSync(generated, { recursive: true, force: true });
});

test("always mode never skips and activity failures fail closed", () => {
  assert.equal(shouldDisplayPrompt("always", 9999, 30), true);
  assert.equal(shouldDisplayPrompt("if-active", null, 30), true);
});

test("activity-sensitive mode only skips after the threshold", () => {
  assert.equal(shouldDisplayPrompt("if-active", 30, 30), true);
  assert.equal(shouldDisplayPrompt("if-active", 31, 30), false);
});

test("maps only the visible button values to decisions", () => {
  assert.deepEqual(responseDecision("yes"), {
    decision: "granted",
    exitCode: 0,
  });
  assert.deepEqual(responseDecision("no"), {
    decision: "denied",
    exitCode: 2,
  });
  assert.equal(responseDecision("granted"), null);
});

test("writes a result once and refuses to overwrite it", () => {
  const resultFile = path.join(generated, "decision.json");
  const options: Options = {
    mode: "always",
    activeWithin: 30,
    reason: "test",
    agent: "Codex",
    sessionLabel: "test",
    resultFile,
  };
  const json = persistResult(options, "denied", 4);
  assert.equal(JSON.parse(json).decision, "denied");
  assert.equal(JSON.parse(fs.readFileSync(resultFile, "utf8")).decision, "denied");
  assert.throws(() => persistResult(options, "granted", 4));
});
