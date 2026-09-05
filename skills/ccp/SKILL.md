---
name: ccp
description: Prevent computer-use automation from colliding with the user's mouse and keyboard on the shared desktop. Check recent activity once before a bounded block of host pointer, native UI, or system keyboard control; show a Yes/No handoff only when activity is recent (if-active by default). Skip browser DOM/CDP/Playwright actions, in-app or virtual browser input, screenshots, APIs, and shell work that do not affect the host pointer, keyboard, or focus. A visible browser or the words computer use/compute use alone do not require this skill.
---

# Computer Control Permission

Prevent overlapping human and agent input on the shared desktop. This is an
activity-sensitive handoff, not a confirmation step for every tool call.

## Decide whether the gate applies

Classify the actual operation by its effect, not the tool name or whether its
window is visible. Consult the tool's documented input behavior when needed.

| Operation | Gate? |
| --- | --- |
| Host pointer movement/clicks, system keystrokes, native window focus, real-pointer E2E tests, PyAutoGUI, RobotJS, AppleScript UI events, `xdotool` | Yes |
| Browser DOM/CDP/Playwright actions, including a visible browser, with no host input or focus changes | No |
| In-app browser or browser `cua` actions documented as virtual input isolated from the host desktop | No |
| Native browser toolbar, OS file picker, or browser actions implemented with host input/focus | Yes |
| Read-only screenshots, page inspection, headless tests, isolated virtual displays, shell, file, API, connector work | No |

For a mixed workflow, run the gate only when transitioning into host control.
If the host effects remain unknown after checking the tool documentation, treat
that operation as host control. Merely mentioning computer use or compute use
does not trigger a prompt.

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
4. Set the skill directory as the working directory and run the bundled wrapper
   as one foreground command:

   ```text
   node scripts/request.js "<selected-app-path>" --agent "Codex" --session-label "<session>" --reason "<bounded action>"
   ```

   In a PowerShell command-execution tool, preserve the native exit code in that
   same command block (otherwise denial/error may both become shell exit `1`):

   ```powershell
   node scripts/request.js "<selected-app-path>" --agent "Codex" --session-label "<session>" --reason "<bounded action>"
   exit $LASTEXITCODE
   ```

   The wrapper supplies `--mode if-active --active-within 30`, launches the native
   app without detaching, waits for its completion, validates the result and exit
   code, then prints one final JSON result. It manages its own temporary result
   file and cleanup. Do not pass `--result-file` or separately inspect/poll files,
   PIDs, or process lists. Do not build another launcher around the wrapper.
5. If the command tool returns a running session/cell ID, keep waiting on that
   same invocation with the tool's wait/resume operation until it finishes. A
   tool yield, empty output, or a slow response is not a failure. Do not start a
   second request, impose a timeout, or ask for approval again while it is pending.
6. While waiting, do not move the pointer, type, focus windows, or call another
   GUI-control tool.
7. Interpret both the JSON and exit code:

   - exit `0` with `"decision":"granted"`: perform only the displayed block;
   - exit `0` with `"decision":"not-required"`: perform the bounded block without
     another prompt; the activity check found the desktop idle;
   - exit `2` with `"decision":"denied"`: stop the GUI-control portion;
   - any other exit, missing result, crash, or interruption: send no GUI input.

Never run protected GUI control concurrently with the permission process. Treat
errors or denial as a stop, not a reason to automatically relaunch the prompt.

The centered prompt shows the session and requested action. The prompt can be
dragged without deciding.

## Activity-sensitive mode

Use the wrapper's `if-active` default without asking the user to opt in. Input
within the last 30 seconds opens the Yes/No prompt; more than 30 seconds idle
returns `not-required` without showing UI. This is an OS idle-time estimate, not
continuous human-presence detection. Idle-detection failure opens the prompt
because the native app cannot establish that the desktop is idle.

Use `--mode always` only if the user explicitly requests a prompt even while idle.
Do not add it because an operation uses computer-use, because a browser is
visible, or just to be extra cautious. Chat approval does not replace a Yes when
the activity-sensitive gate displays a prompt.

## Scope and renewal

A `granted` or `not-required` result covers one bounded, uninterrupted control
block matching the reason. That block can contain multiple tool calls and app
switches needed for the same action. Do not rerun the gate for each click,
screenshot, tool yield, or step; the agent's own input is not evidence that the
user resumed control.

Run a fresh activity check when the user resumes the desktop, the task changes,
the block finishes or fails, or more than five minutes pass before the first
protected input. If the user resumes during a block, stop sending host input
before requesting the next handoff. There is no continuous input monitor in CCP.

Do not reuse a completed block's result across turns, tasks, agents, or sessions.

## Missing executable

Do not install Node packages or replace the prompt with a chat question. If the
matching app is absent after bootstrap or fails, leave native GUI control
unperformed and report the blocker. Maintainers build release assets in the
separate `computer-control-overlay` project with `pnpm build:skill`.
