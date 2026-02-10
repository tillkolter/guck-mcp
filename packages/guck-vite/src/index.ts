import type { Plugin, ViteDevServer } from "vite";
import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type GuckVitePluginOptions = {
  ingestUrl?: string;
  configPath?: string;
  path?: string;
  enabled?: boolean;
  registryDir?: string;
};

const DEFAULT_INGEST_URL = "http://127.0.0.1:7331/guck/emit";
const DEFAULT_PATH = "/guck/emit";
const DEFAULT_REGISTRY_DIR = path.join(os.homedir(), ".guck", "ingest");
const DEFAULT_PROBE_TIMEOUT_MS = 400;

type RegistryEntry = {
  root_dir: string;
  host: string;
  path: string;
  port: number;
  started_at: string;
};

const applyCors = (res: ServerResponse): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

const readBody = async (req: IncomingMessage): Promise<Buffer> => {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("aborted", () => reject(new Error("aborted")));
    req.on("error", reject);
  });
};

const readContentType = (req: IncomingMessage): string => {
  const header = req.headers["content-type"];
  if (Array.isArray(header)) {
    return header[0] ?? "application/json";
  }
  return header ?? "application/json";
};

const isDirOrFile = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
};

const findRepoRoot = (startDir: string): string => {
  let current = path.resolve(startDir);
  while (true) {
    if (isDirOrFile(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }
    current = parent;
  }
};

const resolveRegistryDir = (override?: string): string => {
  if (override) {
    return override;
  }
  if (process.env.GUCK_INGEST_REGISTRY_DIR) {
    return process.env.GUCK_INGEST_REGISTRY_DIR;
  }
  return DEFAULT_REGISTRY_DIR;
};

const parseRegistryEntry = (value: unknown): RegistryEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rootDir = typeof record.root_dir === "string" ? record.root_dir : null;
  const host = typeof record.host === "string" ? record.host : null;
  const ingestPath = typeof record.path === "string" ? record.path : null;
  const port = typeof record.port === "number" ? record.port : null;
  const startedAt = typeof record.started_at === "string" ? record.started_at : null;
  if (!rootDir || !host || !ingestPath || !port || !startedAt) {
    return null;
  }
  return { root_dir: rootDir, host, path: ingestPath, port, started_at: startedAt };
};

const loadRegistryEntries = (registryDir: string, repoRoot: string): RegistryEntry[] => {
  if (!fs.existsSync(registryDir)) {
    return [];
  }
  const entries: RegistryEntry[] = [];
  for (const entry of fs.readdirSync(registryDir)) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(registryDir, entry);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = parseRegistryEntry(JSON.parse(raw));
      if (parsed && parsed.root_dir === repoRoot) {
        entries.push(parsed);
      }
    } catch {
      // Ignore malformed registry entries.
    }
  }
  return entries;
};

const probeIngest = async (url: string, timeoutMs: number): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "OPTIONS", signal: controller.signal });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const forwardToIngest = async (
  body: Buffer,
  ingestUrl: string,
  configPath: string,
  contentType: string,
): Promise<
  | { ok: true; status: number; contentType: string | null; payload: Buffer }
  | { ok: false; error: "upstream_unreachable" }
> => {
  try {
    const response = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "x-guck-config-path": configPath,
      },
      body,
    });
    const payload = Buffer.from(await response.arrayBuffer());
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      payload,
    };
  } catch {
    return { ok: false, error: "upstream_unreachable" };
  }
};

export const guckVitePlugin = (options: GuckVitePluginOptions = {}): Plugin => {
  const configPath = options.configPath ?? process.cwd();
  const routePath = options.path ?? DEFAULT_PATH;
  const enabled = options.enabled ?? true;
  const repoRoot = findRepoRoot(configPath);
  const registryDir = resolveRegistryDir(options.registryDir);
  const explicitIngestUrl = options.ingestUrl ?? process.env.GUCK_INGEST_URL;
  let resolvedIngest: { url: string; auto: boolean } | null = null;

  const resolveAutoIngestUrl = async (): Promise<string> => {
    const entries = loadRegistryEntries(registryDir, repoRoot);
    const sorted = entries.sort((a, b) => {
      const aTs = Date.parse(a.started_at) || 0;
      const bTs = Date.parse(b.started_at) || 0;
      return bTs - aTs;
    });
    for (const entry of sorted) {
      const url = `http://${entry.host}:${entry.port}${entry.path}`;
      if (await probeIngest(url, DEFAULT_PROBE_TIMEOUT_MS)) {
        return url;
      }
    }
    return DEFAULT_INGEST_URL;
  };

  const resolveIngestUrl = async (): Promise<{ url: string; auto: boolean }> => {
    if (explicitIngestUrl) {
      return { url: explicitIngestUrl, auto: false };
    }
    if (resolvedIngest?.auto) {
      return resolvedIngest;
    }
    const url = await resolveAutoIngestUrl();
    resolvedIngest = { url, auto: true };
    return resolvedIngest;
  };

  const refreshIngestUrl = async (): Promise<{ url: string; auto: boolean }> => {
    if (!resolvedIngest?.auto) {
      return resolveIngestUrl();
    }
    resolvedIngest = null;
    return resolveIngestUrl();
  };

  return {
    name: "guck-vite",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      if (!enabled) {
        return;
      }
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        if (url.pathname !== routePath) {
          next();
          return;
        }

        if (req.method === "OPTIONS") {
          applyCors(res);
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "POST") {
          applyCors(res);
          res.statusCode = 404;
          res.end();
          return;
        }

        let body: Buffer;
        try {
          body = await readBody(req);
        } catch {
          applyCors(res);
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: "Request aborted" }));
          return;
        }

        const contentType = readContentType(req);
        const resolved = await resolveIngestUrl();
        let response = await forwardToIngest(body, resolved.url, configPath, contentType);
        if (!response.ok && resolved.auto) {
          const refreshed = await refreshIngestUrl();
          if (refreshed.url !== resolved.url) {
            response = await forwardToIngest(body, refreshed.url, configPath, contentType);
          }
        }

        if (response.ok) {
          applyCors(res);
          res.statusCode = response.status;
          if (response.contentType) {
            res.setHeader("Content-Type", response.contentType);
          }
          res.end(response.payload);
          return;
        }

        applyCors(res);
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Upstream unreachable" }));
      });
    },
  };
};
