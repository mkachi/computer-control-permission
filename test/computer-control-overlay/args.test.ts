import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "../../computer-control-overlay/src/args";

test("defaults to activity-sensitive handoff", () => {
  const options = parseArgs([]);
  assert.equal(options.mode, "if-active");
  assert.equal(options.activeWithin, 30);
  assert.equal(options.sessionLabel, "현재 Codex 세션");
});

test("always mode remains an explicit opt-in", () => {
  assert.equal(parseArgs(["--mode", "always"]).mode, "always");
});

test("parses session and activity options", () => {
  const options = parseArgs([
    "--mode",
    "if-active",
    "--active-within",
    "45",
    "--session-label",
    "Codex · overlay 작업",
  ]);
  assert.equal(options.mode, "if-active");
  assert.equal(options.activeWithin, 45);
  assert.equal(options.sessionLabel, "Codex · overlay 작업");
});

test("normalizes and bounds displayed labels", () => {
  const options = parseArgs(["--reason", `  ${"가".repeat(300)}  `]);
  assert.equal(Array.from(options.reason).length, 240);
});

test("rejects unknown, incomplete, and positional arguments", () => {
  assert.throws(() => parseArgs(["--mode"]));
  assert.throws(() => parseArgs(["--unknown"]));
  assert.throws(() => parseArgs(["unexpected"]));
});
