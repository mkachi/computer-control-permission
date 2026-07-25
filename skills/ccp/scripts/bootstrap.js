"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_process_1 = __importDefault(require("node:process"));
const skillDirectory = node_path_1.default.resolve(__dirname, "..");
const releaseConfigPath = node_path_1.default.join(skillDirectory, "assets", "release.json");
function readReleaseConfig() {
    const value = JSON.parse(node_fs_1.default.readFileSync(releaseConfigPath, "utf8"));
    if (!value.repository ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository)) {
        throw new Error("release.json has an invalid repository");
    }
    if (!value.tag || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.tag)) {
        throw new Error("release.json has an invalid tag");
    }
    return { repository: value.repository, tag: value.tag };
}
function platformTarget() {
    const architecture = node_process_1.default.arch === "x64"
        ? "x86_64"
        : node_process_1.default.arch === "arm64"
            ? "aarch64"
            : null;
    if (!architecture)
        throw new Error(`unsupported architecture: ${node_process_1.default.arch}`);
    if (node_process_1.default.platform === "win32") {
        return {
            assetName: `ccp-windows-${architecture}.exe`,
            executable: "computer-control-permission.exe",
            platformDirectory: `windows-${architecture}`,
            archive: "file",
        };
    }
    if (node_process_1.default.platform === "linux") {
        return {
            assetName: `ccp-linux-${architecture}.AppImage`,
            executable: "computer-control-permission.AppImage",
            platformDirectory: `linux-${architecture}`,
            archive: "file",
        };
    }
    if (node_process_1.default.platform === "darwin") {
        return {
            assetName: `ccp-macos-${architecture}.tar.gz`,
            executable: node_path_1.default.join("Computer Control Permission.app", "Contents", "MacOS", "Computer Control Permission"),
            platformDirectory: `macos-${architecture}`,
            archive: "tar-gz",
        };
    }
    throw new Error(`unsupported platform: ${node_process_1.default.platform}`);
}
function releaseUrl(config, fileName) {
    return `https://github.com/${config.repository}/releases/download/${encodeURIComponent(config.tag)}/${encodeURIComponent(fileName)}`;
}
async function download(url) {
    const response = await fetch(url, {
        headers: { "user-agent": "ccp-bootstrap" },
        redirect: "follow",
    });
    if (!response.ok) {
        throw new Error(`download failed (${response.status}): ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
}
function expectedChecksum(contents, assetName) {
    for (const line of contents.split(/\r?\n/u)) {
        const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/u.exec(line.trim());
        const checksum = match?.[1];
        if (checksum && match[2] === assetName)
            return checksum.toLowerCase();
    }
    throw new Error(`checksum is missing for ${assetName}`);
}
function verifyChecksum(contents, expected, assetName) {
    const actual = (0, node_crypto_1.createHash)("sha256").update(contents).digest("hex");
    if (actual !== expected) {
        throw new Error(`checksum verification failed for ${assetName}`);
    }
}
function installFile(contents, target, temporaryDirectory) {
    const destinationDirectory = node_path_1.default.join(skillDirectory, "bin", target.platformDirectory);
    const destination = node_path_1.default.join(destinationDirectory, target.executable);
    node_fs_1.default.mkdirSync(destinationDirectory, { recursive: true });
    const temporaryFile = node_path_1.default.join(temporaryDirectory, target.assetName);
    node_fs_1.default.writeFileSync(temporaryFile, contents, { flag: "wx" });
    if (node_process_1.default.platform === "linux")
        node_fs_1.default.chmodSync(temporaryFile, 0o755);
    node_fs_1.default.renameSync(temporaryFile, destination);
    return destination;
}
function installMacApp(contents, target, temporaryDirectory) {
    const archive = node_path_1.default.join(temporaryDirectory, target.assetName);
    const extracted = node_path_1.default.join(temporaryDirectory, "extracted");
    node_fs_1.default.writeFileSync(archive, contents, { flag: "wx" });
    node_fs_1.default.mkdirSync(extracted);
    const result = (0, node_child_process_1.spawnSync)("tar", ["-xzf", archive, "-C", extracted], {
        encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
        throw new Error(result.error?.message || result.stderr || "tar failed");
    }
    const sourceApp = node_path_1.default.join(extracted, "Computer Control Permission.app");
    const sourceExecutable = node_path_1.default.join(sourceApp, "Contents", "MacOS", "Computer Control Permission");
    if (!node_fs_1.default.existsSync(sourceExecutable)) {
        throw new Error("downloaded macOS app bundle is incomplete");
    }
    const destinationDirectory = node_path_1.default.join(skillDirectory, "bin", target.platformDirectory);
    const destinationApp = node_path_1.default.join(destinationDirectory, "Computer Control Permission.app");
    node_fs_1.default.mkdirSync(destinationDirectory, { recursive: true });
    node_fs_1.default.renameSync(sourceApp, destinationApp);
    return node_path_1.default.join(destinationDirectory, target.executable);
}
async function run() {
    const config = readReleaseConfig();
    const target = platformTarget();
    const existing = node_path_1.default.join(skillDirectory, "bin", target.platformDirectory, target.executable);
    if (node_fs_1.default.existsSync(existing)) {
        node_process_1.default.stdout.write(`${existing}\n`);
        return;
    }
    const checksumContents = await download(releaseUrl(config, "SHA256SUMS.txt"));
    const expected = expectedChecksum(checksumContents.toString("utf8"), target.assetName);
    const asset = await download(releaseUrl(config, target.assetName));
    verifyChecksum(asset, expected, target.assetName);
    const binDirectory = node_path_1.default.join(skillDirectory, "bin");
    node_fs_1.default.mkdirSync(binDirectory, { recursive: true });
    const temporaryDirectory = node_path_1.default.join(binDirectory, `.bootstrap-${(0, node_crypto_1.randomUUID)()}`);
    node_fs_1.default.mkdirSync(temporaryDirectory);
    try {
        const installed = target.archive === "tar-gz"
            ? installMacApp(asset, target, temporaryDirectory)
            : installFile(asset, target, temporaryDirectory);
        node_process_1.default.stdout.write(`${installed}\n`);
    }
    finally {
        node_fs_1.default.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}
void run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    node_process_1.default.stderr.write(`ccp bootstrap: ${message}\n`);
    node_process_1.default.exitCode = 1;
});
