# guck
*German “guck!” — “take a peek”.* 👀

Guck is a tiny, MCP-first telemetry store for agentic debugging. It captures
JSONL telemetry events, stores them locally, and exposes a minimal MCP toolset
(`guck.stats`, `guck.search`, etc.) for fast, filtered queries instead of noisy
tailing. The goal is to make LLM/agent debugging token-efficient, repeatable,
and low-noise across languages and runtimes.

Guck is designed to be:
- **Language-agnostic**: emit JSONL from any runtime
- **Filter-first**: no default tailing; MCP tools focus on targeted queries
- **Low-friction**: small optional SDK, simple `wrap` CLI for stdout/stderr

## Install

```sh
pnpm add -g @guckdev/cli
# or
npm install -g @guckdev/cli
# or
npx @guckdev/cli
```

Note: the `guck` command is provided by `@guckdev/cli`. If you already have the
unrelated npm `guck` installed globally, uninstall it first.
If you previously installed `guck-cli`, switch to `@guckdev/cli`.

## Quick start

1) Configure MCP (Codex/Claude/Copilot):

```json
{
  "mcpServers": {
    "guck": {
      "command": "guck",
      "args": ["mcp"],
      "env": {
        "GUCK_CONFIG_PATH": "/path/to/.guck.json"
      }
    }
  }
}
```

2) Drop‑in log capture (JS) — use auto‑capture, emit(), or both:

```ts
import "@guckdev/sdk/auto";
import { emit } from "@guckdev/sdk";

emit({ message: "hello from app" });
```

3) Run your app; the MCP client will spawn `guck mcp` and logs are queryable via
`guck.stats` / `guck.search`.

## Vite drop-in (dev)

Add the Vite plugin to proxy `/guck/emit` during development:

```ts
import { defineConfig } from "vite";
import { guckVitePlugin } from "@guckdev/vite";

export default defineConfig({
  plugins: [guckVitePlugin()],
});
```

Then point the browser SDK at `/guck/emit`.

## Monorepo layout

- `packages/guck-cli` — CLI (wrap/emit/checkpoint/mcp)
- `packages/guck-core` — shared config/types/store/redaction
- `packages/guck-js` — JS SDK
- `packages/guck-mcp` — MCP server
- `packages/guck-py` — Python SDK
- `packages/guck-vite` — Vite dev server plugin
- `specs` — shared contract fixtures for parity tests

## Python SDK (preview)

PyPI install:

```sh
pip install guck-sdk
```

Local dev install:

```sh
uv pip install -e packages/guck-py
```

Usage:

```py
from guck import emit

emit({"message": "hello from python"})
```

## Best practice (copy-paste)

1) Add shared config (commit to repo):

`.guck.json`
```json
{
  "version": 1,
  "enabled": true,
  "default_service": "api"
}
```

Optional: add `.guck.local.json` for per-dev overrides (ignored by git).
You can run `guck init` to scaffold `.guck.json`.

2) Add one line to AGENTS.md:

```
When debugging, use Guck telemetry first (guck.stats → guck.search; tail only if asked).
```

3) Run:

```sh
guck wrap --service api --session session-001 -- <your command>
guck mcp
```

## Session vs trace

Guck supports both `session_id` and `trace_id`, but they serve different purposes:

- `trace_id` is **request-scope** correlation (a single transaction across services).
- `session_id` is **run-scope** correlation (a dev run, test run, or local experiment).

`session_id` is useful even when you already have traces because many events are
not tied to a trace (startup, background jobs, cron tasks, etc.). It also gives
you a simple way to filter a whole dev run without wiring trace propagation.

Example:

```sh
export GUCK_SESSION_ID=session-001
guck wrap --service api --session session-001 -- pnpm run dev
```

## Config

Guck reads `.guck.json` from your repo root. If present, `.guck.local.json` is
merged on top for per-dev overrides.

Guck is **enabled by default** using built-in defaults. Add a `.guck.json` (and
optional `.guck.local.json`) or set `GUCK_CONFIG_PATH` (or `GUCK_CONFIG`) to
point at a config file or repo directory. You can also set `"enabled": false`
inside the config to turn it off explicitly.

For MCP usage across multiple repos, each tool accepts an optional
`config_path` parameter to point at a specific `.guck.json`.

### Multi-service or multi-repo tracing (shared store)

To trace across local microservices (or multiple repos), point every service
at the same **absolute** log directory via `GUCK_DIR`. This creates a single
shared log store that `guck.search` can query across. Use a shared `GUCK_SESSION_ID` to
correlate events and distinct `service` names to separate sources.

Example shared env:

```sh
export GUCK_DIR=/path/to/guck/logs
export GUCK_SESSION_ID=session-001
# optional: share a single config across repos
export GUCK_CONFIG_PATH=/path/to/shared/.guck.json
```

Example shared config:

```json
{
  "version": 1,
  "enabled": true,
  "default_service": "api",
  "redaction": {
    "enabled": true,
    "keys": ["authorization","api_key","token","secret","password"],
    "patterns": ["sk-[A-Za-z0-9]{20,}","Bearer\\s+[A-Za-z0-9._-]+"]
  },
  "mcp": { "max_results": 200, "max_output_chars": 20000, "default_lookback_ms": 300000 }
}
```

Remote backends (CloudWatch/K8s) require optional SDK installs; install only if you use them.

### JS SDK auto-capture (stdout/stderr)

The JS SDK can patch `process.stdout` and `process.stderr` to emit Guck events.
Enable it early in your app startup:

```ts
import "@guckdev/sdk/auto";
// or
import { installAutoCapture } from "@guckdev/sdk";
installAutoCapture();
```

Config toggles:

```json
{ "sdk": { "enabled": true, "capture_stdout": true, "capture_stderr": true } }
```

If you're using `guck wrap`, the CLI sets `GUCK_WRAPPED=1` and the SDK
auto-capture intentionally skips to avoid double logging.

### Browser SDK (console + errors)

Use a dev server endpoint that accepts `/guck/emit` and writes events to the
local store. In Vite, the `@guckdev/vite` plugin provides this endpoint. For
other stacks, add a small endpoint that forwards payloads to your server-side
`emit()`.

Emit browser events:

```ts
import { createBrowserClient } from "@guckdev/browser";

const client = createBrowserClient({
  endpoint: "/guck/emit",
  service: "web",
  sessionId: "session-001",
});

await client.emit({ message: "hello from the browser" });
```

Auto-capture console output + unhandled errors:

```ts
const { stop } = client.installAutoCapture();

console.error("boom");

// call stop() to restore console and listeners (useful in component unmounts/tests)
stop();
```

Notes:
- `installAutoCapture()` should usually be called once at app startup; repeated calls will wrap console multiple times.
- If you install it inside a component or test, call `stop()` on cleanup to avoid duplicate logging.
- For SPAs, it's fine to call `installAutoCapture()` once in your app entry (e.g. `index.ts`) and never call `stop()`.
- There is no prebuilt UMD/IIFE bundle yet; for vanilla JS you should use a bundler or a native ESM import.

### Environment overrides
- `GUCK_CONFIG_PATH` — explicit config path (file or repo dir)
- `GUCK_CONFIG` — alias of `GUCK_CONFIG_PATH`
- `GUCK_DIR` — store dir override (default: `~/.guck/logs`)
- `GUCK_ENABLED` — true/false
- `GUCK_SERVICE` — service name
- `GUCK_SESSION_ID` — session override
- `GUCK_RUN_ID` — run id override

### Checkpoint

`guck checkpoint` writes a `.guck-checkpoint` file in the root of your
store dir (`GUCK_DIR` or `~/.guck/logs`) containing an epoch millisecond timestamp. When
MCP tools are called without `since`, Guck uses the checkpoint timestamp as
the default time window. You
can also pass `since: "checkpoint"` to explicitly anchor a query to the
checkpoint.

## Event schema (JSONL)

Each line in the log is a single JSON event:

```json
{
  "id": "uuid",
  "ts": "2026-02-08T18:40:00.123Z",
  "level": "info",
  "type": "log",
  "service": "worker",
  "run_id": "uuid",
  "session_id": "session-123",
  "message": "speaker started",
  "data": { "turnId": 3 },
  "tags": { "env": "local" },
  "trace_id": "...",
  "span_id": "...",
  "source": { "kind": "sdk" }
}
```

## Store layout

By default, Guck writes per-run JSONL files under `~/.guck/logs`:

```
~/.guck/logs/<service>/<YYYY-MM-DD>/<run_id>.jsonl
```

Set `GUCK_DIR` to override the root.

## Minimal CLI

Guck’s CLI is intentionally minimal. It exists to **capture** and **serve**
telemetry; filtering is MCP-first.

- `guck init` — create `.guck.json`
- `guck checkpoint` — write `.guck-checkpoint` epoch timestamp
- `guck wrap --service <name> --session <id> -- <cmd...>` — capture stdout/stderr
- `guck emit --service <name> --session <id>` — append JSON events from stdin
- `guck mcp` — start MCP server
- `guck upgrade [--manager <npm|pnpm|yarn|bun>]` — update the CLI install

## MCP tools

Guck exposes these MCP tools (filter-first):

- `guck.search`
- `guck.search_batch`
- `guck.stats`
- `guck.sessions`
- `guck.tail` (available, but not default in docs)

## Search and tail parameters

`guck.search` and `guck.tail` support additional output and query controls:

- `query` — boolean search over **message only** (case-insensitive). Supports `AND`, `OR`, `NOT`, parentheses, and quoted phrases.
- `contains` — substring search across message/type/session_id/data (unchanged).
- `format` — `json` (default) or `text`.
- `fields` — when `format: "json"`, project events to these fields. Dotted paths like `data.rawPeak` are supported.
- `flatten` — when `format: "json"`, emit dotted field paths as top-level keys (e.g. `"data.rawPeak": 43`).
- `template` — when `format: "text"`, format each line using tokens like `{ts}|{service}|{message}`. Dotted tokens like `{data.rawPeak}` are supported. Missing tokens become empty strings.
- `force` — bypass output-size guard and return the full payload.
- `max_message_chars` — per-message cap; trims the `message` field only.

Output is capped by `mcp.max_output_chars`. If a response would exceed the cap,
the tool returns a warning instead of events/lines unless `force=true`.
Warnings include `avg_message_chars` and `max_message_chars` computed from full, untrimmed messages.

Examples:

```json
{ "query": "error AND (db OR timeout)" }
{ "format": "text", "template": "{ts}|{service}|{message}" }
{ "format": "json", "fields": ["ts", "level", "message"] }
{ "format": "json", "fields": ["ts", "data.rawPeak"], "flatten": true }
```

Batch search:

```json
{
  "searches": [
    { "id": "errors", "query": "error", "limit": 50 },
    { "id": "warnings", "levels": ["warn"], "limit": 50, "max_message_chars": 200 }
  ]
}
```

Recommended minimal output for agents:

```json
{ "format": "text", "template": "{ts}|{service}|{message}" }
```

## AI usage guidance

Start with **stats**, then **search**, and only **tail** if needed:

1) `guck.stats` with a narrow time window
2) `guck.search` for relevant types/levels/messages
3) `guck.tail` only when live-streaming is required

This keeps prompts short and avoids flooding the model with irrelevant logs.

## Debugging strategy (recommended)

Use Guck as a tight loop to avoid log spam and wasted tokens:

1) **Scope** with `guck.stats` (short time window, service/session).
2) **Inspect** with `guck.search` for errors/warns or a specific boundary.
3) **Hypothesize** the failing stage or component.
4) **Instrument** only the boundary (entry/exit, inputs/outputs).
5) **Re-run** and re-query the same narrow window.

This keeps investigations focused while still enabling deep, iterative debugging.

## Redaction

Guck applies redaction on **write** and on **read** using configured key names
and regex patterns.

## Compatibility

Any language can emit Guck events by writing JSONL lines to the store.
The optional SDK simply adds conveniences like `run_id` and redaction.

## MCP server config example

```json
{
  "mcpServers": {
    "guck": {
      "command": "guck",
      "args": ["mcp"],
      "env": {
        "GUCK_CONFIG_PATH": "/path/to/.guck.json"
      }
    }
  }
}
```

## License

MIT
# guck
