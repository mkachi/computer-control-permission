---
name: ccp
description: Require an explicit on-screen Yes/No handoff before Codex, computer-use, UI automation, E2E tests, or any tool can physically move the host pointer, click, type, or send system keyboard input. Use before every native GUI-control block, especially when the user asks to be warned first, may be using the computer, mentions computer use/compute use, or a test uses real mouse or keyboard events. Do not use for headless or virtual input that cannot affect the user's desktop.
---

# Computer Control Permission

Protect the live desktop from surprise pointer or keyboard control. Never treat a
chat message as a substitute for the on-screen handoff.

## Decide whether the gate applies

Run the gate immediately before a bounded block that can move the physical
pointer, click native UI, send system-wide keystrokes, or invoke
`computer-use`/`computer use`/`compute use`.

Require it for native desktop controllers, real-pointer E2E tests, PyAutoGUI,
RobotJS, AppleScript UI events, `xdotool`, and visible automation that sends host
input. Skip it for headless Playwright, DOM event simulation, isolated virtual
displays, read-only screenshots, shell, file, API, and connector work.

Treat uncertain desktop effects as physical input and run the gate.

## Request the handoff

1. Describe the next control block in one short sentence without secrets or user
   data. Choose a session label that identifies the current task.
2. Select the app matching the current operating system and architecture:

   - Windows: `bin/windows-<arch>/computer-control-permission.exe`
   - Linux: `bin/linux-<arch>/computer-control-permission.AppImage`
   - macOS: `bin/macos-<arch>/Computer Control Permission.app/Contents/MacOS/Computer Control Permission`

   Use `x86_64` for x64 and `aarch64` for ARM64.
3. If the selected app is absent, run `node scripts/bootstrap.js` from this skill
   directory once. It downloads only the pinned GitHub Release asset for the
   current platform and verifies its SHA-256 checksum. Do not install npm
   packages. If bootstrap fails or Node.js is unavailable, fail closed.
4. Create a unique result path inside the operating system's temporary
   directory. Start the selected app with the following arguments and wait for
   that exact process without a timeout:

   ```text
   --mode always --agent "Codex" --session-label "<session>" --reason "<bounded action>" --result-file "<temporary-result-path>"
   ```

   Use the current environment's process API to wait. On Windows, explicitly
   wait for the GUI process instead of relying on an interactive shell's default
   GUI-launch behavior.
5. After the process exits, require the result file to exist, read its JSON once,
   and remove it. A missing or unreadable result fails closed.
6. While waiting, do not move the pointer, type, focus windows, or call another
   GUI-control tool.
7. Interpret both the JSON and exit code:

   - exit `0` with `"decision":"granted"`: perform only the displayed block;
   - exit `0` with `"decision":"not-required"`: allow only under the explicit
     `if-active` policy below;
   - exit `2` with `"decision":"denied"`: stop the GUI-control portion;
   - any other exit, missing result, crash, or interruption: send no GUI input.

Never run protected GUI control concurrently with the permission process.

The centered prompt shows the session and requested action. The prompt can be
dragged without deciding.

## Activity-sensitive mode

Default to `--mode always`.

Use `--mode if-active --active-within 30` only when the user or project policy
explicitly permits skipping the prompt while the machine is idle. Recent input
opens the same indefinite prompt. Idle-detection failure opens the prompt.
Activity is never consent.

## Scope and renewal

A Yes grants one bounded, uninterrupted control block matching the displayed
reason. Request permission again when control returns to the user, the app or
purpose changes, automation finishes or fails, or more than five minutes pass
before the first protected input.

Do not cache Yes across turns, tasks, agents, or sessions.

## Missing executable

Do not install Node packages or replace the prompt with a chat question. If the
matching app is absent after bootstrap or fails, leave native GUI control
unperformed and report the blocker. Maintainers build release assets in the
separate `computer-control-overlay` project with `pnpm build:skill`.
