# Guck (JS SDK)

Guck is a tiny, MCP-first telemetry store for AI debugging. This package
includes the JS SDK.

For full docs, see the repo README.

## Install

This package is intended to be used from the monorepo workspace.
For the CLI (`guck ...`), use `@guckdev/cli`.

## Quick start

```sh
guck init
guck wrap --service worker --session session-123 -- pnpm run dev
# in another terminal
guck mcp
```

## Auto-capture stdout/stderr

Enable auto-capture early in your app startup to patch `process.stdout` and
`process.stderr` and emit Guck events:

```ts
import "@guckdev/sdk/auto";
// or
import { installAutoCapture } from "@guckdev/sdk";
installAutoCapture();
```

Behavior: output is buffered by line and emitted as `stdout`/`stderr` events.

Config toggles:

```json
{ "sdk": { "enabled": true, "capture_stdout": true, "capture_stderr": true } }
```

If you're using `guck wrap`, the CLI sets `GUCK_WRAPPED=1` and the SDK
auto-capture intentionally skips to avoid double logging. Call the import or
`installAutoCapture()` early so it wraps writes during startup.
