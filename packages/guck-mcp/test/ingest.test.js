import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { test } from "node:test";
import { startHttpIngest } from "../dist/index.js";
import { getDefaultConfig } from "@guckdev/core";

const collectJsonlFiles = (dir) => {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        results.push(fullPath);
      }
    }
  }
  return results;
};

const getFreePort = async () => {
  return await new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
};

test("http ingest writes redacted events", async (t) => {
  const port = await getFreePort();
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-ingest-"));
  const config = getDefaultConfig();
  config.enabled = true;
  config.default_service = "web-ui";

  const handle = await startHttpIngest({
    port,
    host: "127.0.0.1",
    path: "/guck/emit",
    maxBodyBytes: 512000,
    config,
    storeDir,
  });
  t.after(async () => {
    await handle.close();
  });

  const response = await fetch(`http://127.0.0.1:${port}/guck/emit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "token=abc sk-12345678901234567890",
      data: { token: "abc" },
    }),
  });

  assert.equal(response.status, 200);

  const files = collectJsonlFiles(storeDir);
  assert.equal(files.length, 1);
  const content = fs.readFileSync(files[0], "utf8").trim();
  const line = content.split(/\r?\n/).filter(Boolean)[0];
  const event = JSON.parse(line);

  assert.ok(event.message.includes("[REDACTED]"));
  assert.equal(event.data.token, "[REDACTED]");
});

test("http ingest enforces max body bytes", async (t) => {
  const port = await getFreePort();
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-ingest-"));
  const config = getDefaultConfig();
  config.enabled = true;

  const handle = await startHttpIngest({
    port,
    host: "127.0.0.1",
    path: "/guck/emit",
    maxBodyBytes: 32,
    config,
    storeDir,
  });
  t.after(async () => {
    await handle.close();
  });

  const response = await fetch(`http://127.0.0.1:${port}/guck/emit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "this payload is definitely too large" }),
  });

  assert.equal(response.status, 413);
});

test("http ingest rejects when disabled", async (t) => {
  const port = await getFreePort();
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "guck-ingest-"));
  const config = getDefaultConfig();
  config.enabled = false;

  const handle = await startHttpIngest({
    port,
    host: "127.0.0.1",
    path: "/guck/emit",
    maxBodyBytes: 512000,
    config,
    storeDir,
  });
  t.after(async () => {
    await handle.close();
  });

  const response = await fetch(`http://127.0.0.1:${port}/guck/emit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "nope" }),
  });

  assert.equal(response.status, 403);
});
