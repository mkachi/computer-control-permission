const fs = require("node:fs");

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.lastIndexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const resultFile = option("--result-file");
const scenario = option("--scenario");
const result = {
  decision: option("--decision") || "granted",
  mode: option("--mode") || "if-active",
  idleSeconds: Number(option("--idle") || 1),
  activeWithin: Number(option("--active-within") || 30),
};

if (scenario === "missing") process.exit(0);
if (scenario === "malformed") {
  fs.writeFileSync(resultFile, "{");
  process.exit(0);
}

const finish = () => {
  fs.writeFileSync(resultFile, JSON.stringify(result));
  process.exitCode = option("--exit") !== undefined
    ? Number(option("--exit"))
    : scenario === "crash" ? 3 : result.decision === "denied" ? 2 : 0;
};

if (scenario === "delayed") {
  // The file exists before the final decision; only process completion is final.
  fs.writeFileSync(resultFile, "{");
  setTimeout(finish, 150);
} else {
  finish();
}
