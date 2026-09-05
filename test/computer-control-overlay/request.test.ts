import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { requestPermission } from "../../computer-control-overlay/scripts/request";

const fixture = path.join(__dirname, "fixtures", "permission-app.cjs");

function request(...args: string[]) {
  return requestPermission(process.execPath, [fixture, ...args]);
}

test("waits for delayed approval instead of reading a partial result or retrying", async () => {
  const { result, exitCode } = await request("--scenario", "delayed");
  assert.equal(result.decision, "granted");
  assert.equal(exitCode, 0);
});

test("returns denial without a second request", async () => {
  const { result, exitCode } = await request("--decision", "denied");
  assert.equal(result.decision, "denied");
  assert.equal(exitCode, 2);
});

test("accepts idle bypass only beyond the activity threshold", async () => {
  const { result, exitCode } = await request(
    "--decision", "not-required", "--idle", "31",
  );
  assert.equal(result.decision, "not-required");
  assert.equal(exitCode, 0);
  await assert.rejects(request("--decision", "not-required", "--idle", "30"));
  await assert.rejects(request(
    "--decision", "not-required", "--idle", "31", "--mode", "always",
  ));
});

test("missing results, malformed results, and crashes never grant permission", async () => {
  for (const scenario of ["missing", "malformed", "crash"]) {
    await assert.rejects(request("--scenario", scenario));
  }
  await assert.rejects(requestPermission(path.join(__dirname, "missing-app"), []));
});

test("rejects contradictory exit codes and invalid activity data", async () => {
  await assert.rejects(request("--decision", "denied", "--exit", "0"));
  await assert.rejects(request("--decision", "granted", "--exit", "2"));
  await assert.rejects(request("--mode", "unknown"));
  await assert.rejects(request("--active-within", "-1"));
  await assert.rejects(request("--idle", "-1"));
});

test("rejects caller-supplied result files so old decisions cannot be reused", async () => {
  await assert.rejects(request("--result-file", "old-decision.json"));
  await assert.rejects(request("--result-file=old-decision.json"));
});
