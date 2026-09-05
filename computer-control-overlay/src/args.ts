import path from "node:path";

export interface Options {
  mode: "always" | "if-active";
  activeWithin: number;
  reason: string;
  agent: string;
  sessionLabel: string;
  resultFile: string | null;
}

export const DEFAULTS: Readonly<Options> = Object.freeze({
  mode: "if-active",
  activeWithin: 30,
  reason: "네이티브 마우스 및 키보드 제어",
  agent: "Codex",
  sessionLabel: "현재 Codex 세션",
  resultFile: null,
});

const MAX_LABEL_CHARS = 240;

function boundedLabel(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  return Array.from(normalized || fallback).slice(0, MAX_LABEL_CHARS).join("");
}

function takeValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseArgs(args: string[]): Options {
  const options: Options = { ...DEFAULTS };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    switch (argument) {
      case "--mode": {
        const value = takeValue(args, index, argument);
        if (value !== "always" && value !== "if-active") {
          throw new Error("--mode must be 'always' or 'if-active'");
        }
        options.mode = value;
        index += 1;
        break;
      }
      case "--active-within": {
        const value = takeValue(args, index, argument);
        if (!/^\d+$/u.test(value)) {
          throw new Error("--active-within must be a non-negative integer");
        }
        options.activeWithin = Number(value);
        if (!Number.isSafeInteger(options.activeWithin)) {
          throw new Error("--active-within is too large");
        }
        index += 1;
        break;
      }
      case "--reason":
        options.reason = boundedLabel(
          takeValue(args, index, argument),
          DEFAULTS.reason,
        );
        index += 1;
        break;
      case "--agent":
        options.agent = boundedLabel(
          takeValue(args, index, argument),
          DEFAULTS.agent,
        );
        index += 1;
        break;
      case "--session-label":
        options.sessionLabel = boundedLabel(
          takeValue(args, index, argument),
          DEFAULTS.sessionLabel,
        );
        index += 1;
        break;
      case "--result-file":
        options.resultFile = path.resolve(takeValue(args, index, argument));
        index += 1;
        break;
      default:
        if (argument === undefined) {
          throw new Error("unexpected empty argument");
        }
        throw new Error(
          argument.startsWith("--")
            ? `unknown option: ${argument}`
            : `unexpected argument: ${argument}`,
        );
    }
  }

  return options;
}
