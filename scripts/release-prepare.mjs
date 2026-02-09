import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version =
  process.argv[2] || process.env.NEXT_RELEASE_VERSION || process.env.RELEASE_VERSION;

if (!version) {
  console.error("release-prepare: missing release version");
  process.exit(1);
}

fs.writeFileSync(path.join(root, "VERSION"), `${version}\n`, "utf8");

const result = spawnSync(process.execPath, [
  path.join(root, "scripts", "sync-version.mjs"),
], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
