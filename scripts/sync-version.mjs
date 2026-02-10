import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const versionPath = path.join(root, "VERSION");
const version = fs.readFileSync(versionPath, "utf8").trim();

const internalPackages = new Set([
  "@guckdev/sdk",
  "@guckdev/core",
  "@guckdev/mcp",
  "@guckdev/cli",
  "@guckdev/browser",
]);

const updateJsonVersion = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  let changed = false;
  if (data.version !== version) {
    data.version = version;
    changed = true;
  }

  const updateDeps = (key) => {
    if (!data[key]) {
      return;
    }
    for (const name of Object.keys(data[key])) {
      if (internalPackages.has(name) && data[key][name] !== version) {
        data[key][name] = version;
        changed = true;
      }
    }
  };

  updateDeps("dependencies");
  updateDeps("devDependencies");
  updateDeps("optionalDependencies");
  updateDeps("peerDependencies");

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
};

updateJsonVersion(path.join(root, "package.json"));
updateJsonVersion(path.join(root, "packages", "guck-js", "package.json"));
updateJsonVersion(path.join(root, "packages", "guck-cli", "package.json"));
updateJsonVersion(path.join(root, "packages", "guck-core", "package.json"));
updateJsonVersion(path.join(root, "packages", "guck-mcp", "package.json"));
updateJsonVersion(path.join(root, "packages", "guck-browser", "package.json"));
