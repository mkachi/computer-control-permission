import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

interface ReleaseConfig {
  repository: string;
  tag: string;
}

interface PlatformTarget {
  assetName: string;
  executable: string;
  platformDirectory: string;
  archive: "file" | "tar-gz";
}

const skillDirectory = path.resolve(__dirname, "..");
const releaseConfigPath = path.join(
  skillDirectory,
  "assets",
  "release.json",
);

function readReleaseConfig(): ReleaseConfig {
  const value = JSON.parse(
    fs.readFileSync(releaseConfigPath, "utf8"),
  ) as Partial<ReleaseConfig>;
  if (
    !value.repository ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository)
  ) {
    throw new Error("release.json has an invalid repository");
  }
  if (!value.tag || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.tag)) {
    throw new Error("release.json has an invalid tag");
  }
  return { repository: value.repository, tag: value.tag };
}

function platformTarget(): PlatformTarget {
  const architecture =
    process.arch === "x64"
      ? "x86_64"
      : process.arch === "arm64"
        ? "aarch64"
        : null;
  if (!architecture) throw new Error(`unsupported architecture: ${process.arch}`);

  if (process.platform === "win32") {
    return {
      assetName: `ccp-windows-${architecture}.exe`,
      executable: "computer-control-permission.exe",
      platformDirectory: `windows-${architecture}`,
      archive: "file",
    };
  }
  if (process.platform === "linux") {
    return {
      assetName: `ccp-linux-${architecture}.AppImage`,
      executable: "computer-control-permission.AppImage",
      platformDirectory: `linux-${architecture}`,
      archive: "file",
    };
  }
  if (process.platform === "darwin") {
    return {
      assetName: `ccp-macos-${architecture}.tar.gz`,
      executable: path.join(
        "Computer Control Permission.app",
        "Contents",
        "MacOS",
        "Computer Control Permission",
      ),
      platformDirectory: `macos-${architecture}`,
      archive: "tar-gz",
    };
  }
  throw new Error(`unsupported platform: ${process.platform}`);
}

function releaseUrl(config: ReleaseConfig, fileName: string): string {
  return `https://github.com/${config.repository}/releases/download/${encodeURIComponent(config.tag)}/${encodeURIComponent(fileName)}`;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": "ccp-bootstrap" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`download failed (${response.status}): ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function expectedChecksum(contents: string, assetName: string): string {
  for (const line of contents.split(/\r?\n/u)) {
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/u.exec(line.trim());
    const checksum = match?.[1];
    if (checksum && match[2] === assetName) return checksum.toLowerCase();
  }
  throw new Error(`checksum is missing for ${assetName}`);
}

function verifyChecksum(
  contents: Buffer,
  expected: string,
  assetName: string,
): void {
  const actual = createHash("sha256").update(contents).digest("hex");
  if (actual !== expected) {
    throw new Error(`checksum verification failed for ${assetName}`);
  }
}

function installFile(
  contents: Buffer,
  target: PlatformTarget,
  temporaryDirectory: string,
): string {
  const destinationDirectory = path.join(
    skillDirectory,
    "bin",
    target.platformDirectory,
  );
  const destination = path.join(destinationDirectory, target.executable);
  fs.mkdirSync(destinationDirectory, { recursive: true });

  const temporaryFile = path.join(temporaryDirectory, target.assetName);
  fs.writeFileSync(temporaryFile, contents, { flag: "wx" });
  if (process.platform === "linux") fs.chmodSync(temporaryFile, 0o755);
  fs.renameSync(temporaryFile, destination);
  return destination;
}

function installMacApp(
  contents: Buffer,
  target: PlatformTarget,
  temporaryDirectory: string,
): string {
  const archive = path.join(temporaryDirectory, target.assetName);
  const extracted = path.join(temporaryDirectory, "extracted");
  fs.writeFileSync(archive, contents, { flag: "wx" });
  fs.mkdirSync(extracted);

  const result = spawnSync("tar", ["-xzf", archive, "-C", extracted], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || "tar failed");
  }

  const sourceApp = path.join(extracted, "Computer Control Permission.app");
  const sourceExecutable = path.join(sourceApp, "Contents", "MacOS", "Computer Control Permission");
  if (!fs.existsSync(sourceExecutable)) {
    throw new Error("downloaded macOS app bundle is incomplete");
  }

  const destinationDirectory = path.join(
    skillDirectory,
    "bin",
    target.platformDirectory,
  );
  const destinationApp = path.join(
    destinationDirectory,
    "Computer Control Permission.app",
  );
  fs.mkdirSync(destinationDirectory, { recursive: true });
  fs.renameSync(sourceApp, destinationApp);
  return path.join(destinationDirectory, target.executable);
}

async function run(): Promise<void> {
  const config = readReleaseConfig();
  const target = platformTarget();
  const existing = path.join(
    skillDirectory,
    "bin",
    target.platformDirectory,
    target.executable,
  );
  if (fs.existsSync(existing)) {
    process.stdout.write(`${existing}\n`);
    return;
  }

  const checksumContents = await download(
    releaseUrl(config, "SHA256SUMS.txt"),
  );
  const expected = expectedChecksum(
    checksumContents.toString("utf8"),
    target.assetName,
  );
  const asset = await download(releaseUrl(config, target.assetName));
  verifyChecksum(asset, expected, target.assetName);

  const binDirectory = path.join(skillDirectory, "bin");
  fs.mkdirSync(binDirectory, { recursive: true });
  const temporaryDirectory = path.join(
    binDirectory,
    `.bootstrap-${randomUUID()}`,
  );
  fs.mkdirSync(temporaryDirectory);
  try {
    const installed =
      target.archive === "tar-gz"
        ? installMacApp(asset, target, temporaryDirectory)
        : installFile(asset, target, temporaryDirectory);
    process.stdout.write(`${installed}\n`);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ccp bootstrap: ${message}\n`);
  process.exitCode = 1;
});
