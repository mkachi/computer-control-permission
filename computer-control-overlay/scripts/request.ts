import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface PermissionResult {
  decision: "granted" | "denied" | "not-required";
  mode: "always" | "if-active";
  idleSeconds: number | null;
  activeWithin: number;
}

function validateResult(value: unknown, exitCode: number): PermissionResult {
  if (!value || typeof value !== "object") {
    throw new Error("permission result is not an object");
  }
  const result = value as Partial<PermissionResult>;
  const { decision, mode, idleSeconds, activeWithin } = result;
  if (
    (mode !== "always" && mode !== "if-active") ||
    typeof activeWithin !== "number" ||
    !Number.isSafeInteger(activeWithin) || activeWithin < 0 ||
    (idleSeconds !== null &&
      (typeof idleSeconds !== "number" ||
        !Number.isSafeInteger(idleSeconds) || idleSeconds < 0))
  ) {
    throw new Error("permission result has invalid activity data");
  }
  if (
    (decision === "granted" && exitCode === 0) ||
    (decision === "denied" && exitCode === 2) ||
    (decision === "not-required" && exitCode === 0 &&
      mode === "if-active" && idleSeconds !== null &&
      idleSeconds > activeWithin)
  ) {
    return { decision, mode, idleSeconds, activeWithin };
  }
  throw new Error("permission decision does not match the exit code or activity");
}

export async function requestPermission(
  executable: string,
  args: string[],
): Promise<{ result: PermissionResult; exitCode: 0 | 2 }> {
  if (args.some((argument) => argument.split("=", 1)[0] === "--result-file")) {
    throw new Error("request.js manages --result-file internally");
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ccp-request-"));
  const resultFile = path.join(directory, "result.json");
  try {
    const child = spawn(executable, [...args, "--result-file", resultFile], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "inherit"],
    });
    // Keep one foreground request alive until the native process actually closes.
    // A tool yielding a session ID is not an exit and must not cause a new prompt.
    const [exitCode, signal] = await once(child, "close");
    if (signal || (exitCode !== 0 && exitCode !== 2)) {
      throw new Error(`permission app failed (${signal || exitCode})`);
    }
    const result = validateResult(
      JSON.parse(fs.readFileSync(resultFile, "utf8")),
      exitCode,
    );
    return { result, exitCode };
  } finally {
    fs.rmSync(resultFile, { force: true });
    fs.rmdirSync(directory);
  }
}

async function main(): Promise<void> {
  const [executable, ...args] = process.argv.slice(2);
  if (!executable) throw new Error("usage: node request.js <app-path> [app-options]");
  const { result, exitCode } = await requestPermission(path.resolve(executable), [
    // Explicit defaults also work with the already published v0.4.0 native app.
    "--mode", "if-active", "--active-within", "30", ...args,
  ]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCode;
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${JSON.stringify({ decision: "error", message })}\n`);
    process.exitCode = 3;
  });
}
