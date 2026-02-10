import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pyDir = path.join(root, "packages", "guck-py");
const jsPackages = [
  { name: "@guckdev/core", dir: path.join(root, "packages", "guck-core") },
  { name: "@guckdev/sdk", dir: path.join(root, "packages", "guck-js") },
  { name: "@guckdev/mcp", dir: path.join(root, "packages", "guck-mcp") },
  { name: "@guckdev/browser", dir: path.join(root, "packages", "guck-browser") },
  { name: "@guckdev/cli", dir: path.join(root, "packages", "guck-cli") },
  { name: "@guckdev/vite", dir: path.join(root, "packages", "guck-vite") },
];

const formatCommand = (cmd, args) => [cmd, ...args].join(" ");

const spawnCommand = (cmd, args, cwd = root) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" });
  const promise = new Promise((resolve, reject) => {
    child.on("error", (err) => reject(err));
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = code !== null ? `exit ${code}` : `signal ${signal}`;
      reject(new Error(`${formatCommand(cmd, args)} failed (${reason})`));
    });
  });
  return { child, promise, cmd, args };
};

const runCommand = async (cmd, args, cwd = root) => {
  const { promise } = spawnCommand(cmd, args, cwd);
  await promise;
};

const runBatch = async (commands) => {
  const spawned = commands.map((command) =>
    spawnCommand(command.cmd, command.args, command.cwd),
  );
  let aborted = false;
  const guarded = spawned.map((spawnedCommand) =>
    spawnedCommand.promise.catch((err) => {
      if (!aborted) {
        aborted = true;
        for (const other of spawned) {
          if (other !== spawnedCommand && other.child.exitCode === null) {
            other.child.kill("SIGTERM");
          }
        }
      }
      throw err;
    }),
  );

  try {
    await Promise.all(guarded);
  } catch (err) {
    await Promise.allSettled(guarded);
    throw err;
  }
};

const main = async () => {
  await runCommand("pnpm", ["-r", "build"]);

  await runBatch([
    {
      cmd: "npm",
      args: ["publish", "--access", "public", "--provenance"],
      cwd: jsPackages[0].dir,
    },
  ]);

  await runBatch([
    {
      cmd: "npm",
      args: ["publish", "--access", "public", "--provenance"],
      cwd: jsPackages[1].dir,
    },
    {
      cmd: "npm",
      args: ["publish", "--access", "public", "--provenance"],
      cwd: jsPackages[2].dir,
    },
  ]);

  await runBatch([
    {
      cmd: "npm",
      args: ["publish", "--access", "public", "--provenance"],
      cwd: jsPackages[3].dir,
    },
  ]);

  await runCommand("python", ["-m", "build"], pyDir);
};

main().catch((err) => {
  console.error(err?.stack ?? err);
  process.exitCode = 1;
});
