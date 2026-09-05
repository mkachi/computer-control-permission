"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPermission = requestPermission;
const node_child_process_1 = require("node:child_process");
const node_events_1 = require("node:events");
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
function validateResult(value, exitCode) {
    if (!value || typeof value !== "object") {
        throw new Error("permission result is not an object");
    }
    const result = value;
    const { decision, mode, idleSeconds, activeWithin } = result;
    if ((mode !== "always" && mode !== "if-active") ||
        typeof activeWithin !== "number" ||
        !Number.isSafeInteger(activeWithin) || activeWithin < 0 ||
        (idleSeconds !== null &&
            (typeof idleSeconds !== "number" ||
                !Number.isSafeInteger(idleSeconds) || idleSeconds < 0))) {
        throw new Error("permission result has invalid activity data");
    }
    if ((decision === "granted" && exitCode === 0) ||
        (decision === "denied" && exitCode === 2) ||
        (decision === "not-required" && exitCode === 0 &&
            mode === "if-active" && idleSeconds !== null &&
            idleSeconds > activeWithin)) {
        return { decision, mode, idleSeconds, activeWithin };
    }
    throw new Error("permission decision does not match the exit code or activity");
}
async function requestPermission(executable, args) {
    if (args.some((argument) => argument.split("=", 1)[0] === "--result-file")) {
        throw new Error("request.js manages --result-file internally");
    }
    const directory = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), "ccp-request-"));
    const resultFile = node_path_1.default.join(directory, "result.json");
    try {
        const child = (0, node_child_process_1.spawn)(executable, [...args, "--result-file", resultFile], {
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "ignore", "inherit"],
        });
        // Keep one foreground request alive until the native process actually closes.
        // A tool yielding a session ID is not an exit and must not cause a new prompt.
        const [exitCode, signal] = await (0, node_events_1.once)(child, "close");
        if (signal || (exitCode !== 0 && exitCode !== 2)) {
            throw new Error(`permission app failed (${signal || exitCode})`);
        }
        const result = validateResult(JSON.parse(node_fs_1.default.readFileSync(resultFile, "utf8")), exitCode);
        return { result, exitCode };
    }
    finally {
        node_fs_1.default.rmSync(resultFile, { force: true });
        node_fs_1.default.rmdirSync(directory);
    }
}
async function main() {
    const [executable, ...args] = process.argv.slice(2);
    if (!executable)
        throw new Error("usage: node request.js <app-path> [app-options]");
    const { result, exitCode } = await requestPermission(node_path_1.default.resolve(executable), [
        // Explicit defaults also work with the already published v0.4.0 native app.
        "--mode", "if-active", "--active-within", "30", ...args,
    ]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = exitCode;
}
if (require.main === module) {
    void main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(`${JSON.stringify({ decision: "error", message })}\n`);
        process.exitCode = 3;
    });
}
