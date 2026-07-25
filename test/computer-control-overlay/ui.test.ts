import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const project = path.resolve(__dirname, "..", "..", "computer-control-overlay");

test("prompt exposes session, task, and explicit decisions", () => {
  const html = fs.readFileSync(path.join(project, "ui", "prompt.html"), "utf8");
  const renderer = fs.readFileSync(
    path.join(project, "ui", "renderer.ts"),
    "utf8",
  );
  assert.match(html, /class="session-info"/u);
  assert.match(html, /id="session-label"/u);
  assert.doesNotMatch(html, /session-link/u);
  assert.doesNotMatch(renderer, /focusSession/u);
  assert.match(html, /id="request-reason"/u);
  assert.match(html, />No</u);
  assert.match(html, />Yes</u);
});

test("edge and glow are thin, seamless, synchronized, and click-through", () => {
  const css = fs.readFileSync(path.join(project, "ui", "styles.css"), "utf8");
  const main = fs.readFileSync(path.join(project, "src", "main.ts"), "utf8");
  assert.match(css, /height: 3px/u);
  assert.match(css, /width: 3px/u);
  assert.match(css, /width: 200%/u);
  assert.match(css, /height: 200%/u);
  assert.match(css, /edge-flow-horizontal 4s linear infinite/u);
  assert.match(css, /translate3d\(-50%, 0, 0\)/u);
  assert.match(css, /\.edge-top::after/u);
  assert.match(css, /\.edge-left::after/u);
  assert.match(css, /filter: blur\(17px\)/u);
  assert.match(css, /\.edge-bottom::after[\s\S]*animation-direction: reverse/u);
  assert.match(css, /\.edge-right::after[\s\S]*animation-direction: reverse/u);
  assert.match(main, /setIgnoreMouseEvents\(true\)/u);
});
