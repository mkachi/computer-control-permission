import fs from "node:fs";
import type { Options } from "./args";

export type Decision = "granted" | "denied" | "not-required";

export interface PermissionResult {
  decision: Decision;
  mode: Options["mode"];
  idleSeconds: number | null;
  activeWithin: number;
}

export interface ResponseDecision {
  decision: Extract<Decision, "granted" | "denied">;
  exitCode: 0 | 2;
}

export function shouldDisplayPrompt(
  mode: Options["mode"],
  idleSeconds: number | null,
  activeWithin: number,
): boolean {
  if (mode === "always") return true;
  return idleSeconds === null || idleSeconds <= activeWithin;
}

export function responseDecision(value: unknown): ResponseDecision | null {
  if (value === "yes") return { decision: "granted", exitCode: 0 };
  if (value === "no") return { decision: "denied", exitCode: 2 };
  return null;
}

export function createResult(
  options: Options,
  decision: Decision,
  idleSeconds: number | null,
): PermissionResult {
  return {
    decision,
    mode: options.mode,
    idleSeconds,
    activeWithin: options.activeWithin,
  };
}

export function persistResult(
  options: Options,
  decision: Decision,
  idleSeconds: number | null,
): string {
  const json = JSON.stringify(createResult(options, decision, idleSeconds));
  if (options.resultFile) {
    const descriptor = fs.openSync(options.resultFile, "wx");
    try {
      fs.writeFileSync(descriptor, `${json}\n`, "utf8");
    } finally {
      fs.closeSync(descriptor);
    }
  }
  return json;
}
