import path from "node:path";
import {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen,
  session,
} from "electron";
import { parseArgs, type Options } from "./args";
import {
  persistResult,
  responseDecision,
  shouldDisplayPrompt,
  type Decision,
} from "./policy";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PROMPT_SIZE = Object.freeze({ width: 460, height: 264 });

let options: Options;
let idleSeconds: number | null = null;
let settled = false;
let promptWindow: BrowserWindow | null = null;
let overlayWindows: BrowserWindow[] = [];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function argumentList(): string[] {
  return process.argv.slice(app.isPackaged ? 1 : 2);
}

function writeArgumentError(message: string): never {
  process.stdout.write(`${JSON.stringify({ decision: "error", message })}\n`);
  process.exit(3);
}

try {
  options = parseArgs(argumentList());
} catch (error) {
  writeArgumentError(errorMessage(error));
}

function secureWindow(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
}

function alwaysOnTop(
  window: BrowserWindow,
  level: "floating" | "screen-saver" = "floating",
): void {
  window.setAlwaysOnTop(true, level);
  if (process.platform === "darwin") {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
}

function createOverlayWindows(): void {
  overlayWindows = screen.getAllDisplays().map((display, index) => {
    const window = new BrowserWindow({
      ...display.bounds,
      title: `Computer control boundary ${index + 1}`,
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      enableLargerThanScreen: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    secureWindow(window);
    alwaysOnTop(window, "screen-saver");
    window.setIgnoreMouseEvents(true);
    void window.loadFile(path.join(PROJECT_ROOT, "ui", "overlay.html"));
    window.once("ready-to-show", () => window.showInactive());
    return window;
  });
}

function promptPosition(): { x: number; y: number } {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  return {
    x: Math.round(x + (width - PROMPT_SIZE.width) / 2),
    y: Math.round(y + (height - PROMPT_SIZE.height) / 2),
  };
}

function createPromptWindow(): void {
  promptWindow = new BrowserWindow({
    ...PROMPT_SIZE,
    ...promptPosition(),
    title: "Computer Control Permission",
    icon: path.join(PROJECT_ROOT, "icons", "icon.png"),
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  secureWindow(promptWindow);
  alwaysOnTop(promptWindow, "screen-saver");
  promptWindow.on("close", (event) => {
    if (!settled) event.preventDefault();
  });
  void promptWindow.loadFile(path.join(PROJECT_ROOT, "ui", "prompt.html"));
  promptWindow.once("ready-to-show", () => {
    promptWindow?.show();
    promptWindow?.focus();
  });
}

function closeWindows(): void {
  for (const overlay of overlayWindows) {
    if (!overlay.isDestroyed()) overlay.destroy();
  }
  overlayWindows = [];
  if (promptWindow && !promptWindow.isDestroyed()) promptWindow.destroy();
  promptWindow = null;
}

function exitWithResult(decision: Decision, exitCode: number): void {
  settled = true;
  try {
    const json = persistResult(options, decision, idleSeconds);
    process.stdout.write(`${json}\n`);
    closeWindows();
    app.exit(exitCode);
  } catch (error) {
    process.stderr.write(`permission result error: ${errorMessage(error)}\n`);
    closeWindows();
    app.exit(3);
  }
}

ipcMain.handle("permission:get-context", () => ({
  agent: options.agent,
  reason: options.reason,
  sessionLabel: options.sessionLabel,
  recentActivity:
    idleSeconds !== null && idleSeconds <= options.activeWithin,
}));

ipcMain.handle("permission:respond", (_event, value: unknown) => {
  const response = responseDecision(value);
  if (!response || settled) return false;
  exitWithResult(response.decision, response.exitCode);
  return true;
});

app.on("before-quit", (event) => {
  if (!settled) event.preventDefault();
});

void app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch {
    idleSeconds = null;
  }

  if (!shouldDisplayPrompt(options.mode, idleSeconds, options.activeWithin)) {
    exitWithResult("not-required", 0);
    return;
  }

  createOverlayWindows();
  createPromptWindow();
});
