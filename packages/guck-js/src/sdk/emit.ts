import { randomUUID } from "node:crypto";
import {
  appendEvent,
  GuckEvent,
  GuckLevel,
  loadConfig,
  redactEvent,
  resolveStoreDir,
} from "@guckdev/core";

let cached:
  | {
      storeDir: string;
      config: ReturnType<typeof loadConfig>["config"];
    }
  | undefined;

let writeDisabled = false;
let warned = false;

const isWriteError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
};

const warnOnce = (message: string): void => {
  if (warned) {
    return;
  }
  warned = true;
  process.stderr.write(`${message}\n`);
};

const defaultRunId = process.env.GUCK_RUN_ID ?? randomUUID();
const defaultSessionId = process.env.GUCK_SESSION_ID;

const normalizeLevel = (level?: string): GuckLevel => {
  if (!level) {
    return "info";
  }
  const lower = level.toLowerCase();
  if (
    lower === "trace" ||
    lower === "debug" ||
    lower === "info" ||
    lower === "warn" ||
    lower === "error" ||
    lower === "fatal"
  ) {
    return lower;
  }
  return "info";
};

const toEvent = (
  input: Partial<GuckEvent>,
  defaults: { service: string },
): GuckEvent => {
  return {
    id: input.id ?? randomUUID(),
    ts: input.ts ?? new Date().toISOString(),
    level: normalizeLevel(input.level),
    type: input.type ?? "log",
    service: input.service ?? defaults.service,
    run_id: input.run_id ?? defaultRunId,
    session_id: input.session_id ?? defaultSessionId,
    message: input.message,
    data: input.data,
    tags: input.tags,
    trace_id: input.trace_id,
    span_id: input.span_id,
    source: input.source ?? { kind: "sdk" },
  };
};

const getCached = () => {
  if (cached) {
    return cached;
  }
  const loaded = loadConfig();
  const storeDir = resolveStoreDir(loaded.config, loaded.rootDir);
  cached = { storeDir, config: loaded.config };
  return cached;
};

export const emit = async (input: Partial<GuckEvent>): Promise<void> => {
  if (writeDisabled) {
    return;
  }
  const { storeDir, config } = getCached();
  if (!config.enabled) {
    return;
  }
  const event = toEvent(input, { service: config.default_service });
  const redacted = redactEvent(config, event);
  try {
    await appendEvent(storeDir, redacted);
  } catch (error) {
    if (process.env.GUCK_STRICT_WRITE_ERRORS === "1") {
      throw error;
    }
    if (isWriteError(error)) {
      writeDisabled = true;
      warnOnce(
        "[guck] write disabled (permission error); set GUCK_STRICT_WRITE_ERRORS=1 to fail hard",
      );
      return;
    }
    throw error;
  }
};
