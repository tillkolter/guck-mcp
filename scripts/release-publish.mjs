import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pyDir = path.join(root, "packages", "guck-py");
const jsPackages = [
  { name: "@guckdev/core", dir: path.join(root, "packages", "guck-core") },
  { name: "@guckdev/sdk", dir: path.join(root, "packages", "guck-js") },
  { name: "@guckdev/mcp", dir: path.join(root, "packages", "guck-mcp") },
  { name: "@guckdev/cli", dir: path.join(root, "packages", "guck-cli") },
];

const run = (cmd, args, cwd = root) => {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run("pnpm", ["-r", "build"]);

for (const pkg of jsPackages) {
  run("npm", ["publish", "--access", "public"], pkg.dir);
}

run("python", ["-m", "build"], pyDir);
