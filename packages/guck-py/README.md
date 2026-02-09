# Guck Python SDK

Guck is a tiny, MCP-first telemetry store for AI debugging. This package is the
Python SDK that mirrors the JS `emit` behavior.

## Install

```sh
pip install guck-sdk
```

The distribution is `guck-sdk`, but the import name remains `guck`.

## Install (local dev)

```sh
uv pip install -e .
```

## Usage

```py
from guck import emit

emit({"message": "hello from python"})
```

## Config

The SDK reads `.guck.json` in your repo root and honors the same environment
variables as the JS SDK:

- `GUCK_CONFIG_PATH`
- `GUCK_DIR`
- `GUCK_ENABLED`
- `GUCK_SERVICE`
- `GUCK_SESSION_ID`
- `GUCK_RUN_ID`
