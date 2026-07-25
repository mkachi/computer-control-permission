import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const project = path.resolve(__dirname, "..");
const skill = path.resolve(project, "..", "skills", "ccp");
const output = path.join(project, "dist");

function platformDirectory(): string {
  const architecture =
    process.arch === "x64"
      ? "x86_64"
      : process.arch === "arm64"
        ? "aarch64"
        : null;
  if (!architecture) throw new Error(`unsupported architecture: ${process.arch}`);
  const platform =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "macos"
        : process.platform === "linux"
          ? "linux"
          : null;
  if (!platform) throw new Error(`unsupported platform: ${process.platform}`);
  return `${platform}-${architecture}`;
}

function builderArguments(): string[] {
  const architecture = process.arch === "arm64" ? "--arm64" : "--x64";
  if (process.platform === "win32") {
    return ["--win", "portable", architecture];
  }
  if (process.platform === "linux") {
    return ["--linux", "AppImage", architecture];
  }
  return ["--mac", "--dir", architecture];
}

function findSingleFile(extension: string): string {
  const files = fs
    .readdirSync(output, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension));
  if (files.length !== 1) {
    throw new Error(
      `expected one ${extension} artifact, found ${files.map((file) => file.name).join(", ") || "none"}`,
    );
  }
  const artifact = files[0];
  if (!artifact) throw new Error(`missing ${extension} artifact`);
  return path.join(output, artifact.name);
}

function findMacApp(directory: string): string | null {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) return candidate;
    if (entry.isDirectory()) {
      const nested = findMacApp(candidate);
      if (nested) return nested;
    }
  }
  return null;
}

function build(): void {
  fs.rmSync(output, { recursive: true, force: true });
  const builderCli = path.join(
    project,
    "node_modules",
    "electron-builder",
    "cli.js",
  );
  const result = spawnSync(process.execPath, [builderCli, ...builderArguments()], {
    cwd: project,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      result.error?.message ||
        `electron-builder failed with exit code ${result.status}`,
    );
  }

  const destinationDirectory = path.join(
    skill,
    "bin",
    platformDirectory(),
  );
  fs.mkdirSync(destinationDirectory, { recursive: true });

  let destination: string;
  if (process.platform === "win32") {
    const source = findSingleFile(".exe");
    destination = path.join(
      destinationDirectory,
      "computer-control-permission.exe",
    );
    fs.copyFileSync(source, destination);
  } else if (process.platform === "linux") {
    const source = findSingleFile(".AppImage");
    destination = path.join(
      destinationDirectory,
      "computer-control-permission.AppImage",
    );
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o755);
  } else {
    const source = findMacApp(output);
    if (!source) throw new Error("macOS .app bundle was not produced");
    destination = path.join(
      destinationDirectory,
      "Computer Control Permission.app",
    );
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true });
  }

  fs.rmSync(output, { recursive: true, force: true });
  process.stdout.write(`${destination}\n`);
}

try {
  build();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`build-skill: ${message}\n`);
  process.exitCode = 1;
}
