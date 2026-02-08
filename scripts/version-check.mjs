import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "hunch-js", "package.json"), "utf8"),
);

if (pkg.version !== version) {
  throw new Error(
    `Version mismatch: VERSION=${version} packages/hunch-js/package.json=${pkg.version}`,
  );
}

const cliPkg = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "hunch-cli", "package.json"), "utf8"),
);

if (cliPkg.version !== version) {
  throw new Error(
    `Version mismatch: VERSION=${version} packages/hunch-cli/package.json=${cliPkg.version}`,
  );
}

const corePkg = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "hunch-core", "package.json"), "utf8"),
);

if (corePkg.version !== version) {
  throw new Error(
    `Version mismatch: VERSION=${version} packages/hunch-core/package.json=${corePkg.version}`,
  );
}

const mcpPkg = JSON.parse(
  fs.readFileSync(path.join(root, "packages", "hunch-mcp", "package.json"), "utf8"),
);

if (mcpPkg.version !== version) {
  throw new Error(
    `Version mismatch: VERSION=${version} packages/hunch-mcp/package.json=${mcpPkg.version}`,
  );
}

const pyproject = fs.readFileSync(
  path.join(root, "packages", "hunch-py", "pyproject.toml"),
  "utf8",
);
if (!/dynamic\s*=\s*\[\s*"version"\s*\]/.test(pyproject)) {
  throw new Error("pyproject.toml must declare dynamic version");
}
if (!/tool\.hatch\.version[\s\S]*VERSION/.test(pyproject)) {
  throw new Error("pyproject.toml must reference VERSION for hatch versioning");
}
