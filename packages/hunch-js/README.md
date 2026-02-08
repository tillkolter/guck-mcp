# Hunch (JS SDK)

Hunch is a tiny, MCP-first telemetry store for AI debugging. This package
includes the JS SDK.

For full docs, see the repo README.

## Install

This package is intended to be used from the monorepo workspace.
For the CLI (`hunch ...`), use `hunch-cli`.

## Quick start

```sh
hunch init
hunch wrap --service debate-room --session room-123 -- pnpm run dev
# in another terminal
hunch mcp
```
