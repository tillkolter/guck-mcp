import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dep = { name: "@guckdev/core", entry: "dist/index.js" };

const npmExecPath = process.env.npm_execpath;
const run = (cwd, args) => {
  const cmd = npmExecPath ? process.execPath : "pnpm";
  const cmdArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const depDir = path.join(process.cwd(), "node_modules", dep.name);
if (existsSync(depDir)) {
  const entryPath = path.join(depDir, dep.entry);
  if (!existsSync(entryPath)) {
    run(depDir, ["run", "build"]);
  }
}
