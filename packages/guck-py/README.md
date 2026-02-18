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
from guck import install_auto_capture

emit({"message": "hello from python"})

# Optional: capture stdout/stderr automatically
handle = install_auto_capture()
print("hello from stdout")
handle.stop()
```

## Config

The SDK reads `.guck.json` in your repo root. If present, `.guck.local.json` is
merged on top for per-dev overrides. It honors the same environment variables
as the JS SDK:

- `GUCK_CONFIG_PATH` (or `GUCK_CONFIG`)
- `GUCK_DIR`
- `GUCK_ENABLED`
- `GUCK_SERVICE`
- `GUCK_SESSION_ID`
- `GUCK_RUN_ID`

Auto-capture can be configured via `.guck.json`:

```json
{
  "sdk": {
    "enabled": true,
    "capture_stdout": true,
    "capture_stderr": true
  }
}
```
