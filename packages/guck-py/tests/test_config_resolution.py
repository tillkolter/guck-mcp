import json
from pathlib import Path

from guck.config import load_config, resolve_store_dir


def _write_config(path: Path) -> None:
    path.write_text(json.dumps({}, indent=2), encoding="utf-8")


def test_load_config_directory_path(tmp_path, monkeypatch):
    monkeypatch.delenv("GUCK_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("GUCK_CONFIG", raising=False)

    config_dir = tmp_path / "repo"
    config_dir.mkdir()
    config_path = config_dir / ".guck.json"
    _write_config(config_path)

    result = load_config(config_path=str(config_dir))
    assert result["root_dir"] == str(config_dir)
    assert resolve_store_dir(result["config"], result["root_dir"]) == str(
        Path.home() / ".guck" / "logs"
    )


def test_load_config_relative_path_uses_cwd(tmp_path, monkeypatch):
    monkeypatch.delenv("GUCK_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("GUCK_CONFIG", raising=False)

    base_dir = tmp_path / "root"
    config_dir = base_dir / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / ".guck.json"
    _write_config(config_path)

    result = load_config(cwd=str(base_dir), config_path="config/.guck.json")
    assert result["root_dir"] == str(config_dir)
    assert resolve_store_dir(result["config"], result["root_dir"]) == str(
        Path.home() / ".guck" / "logs"
    )


def test_load_config_merges_local_override(tmp_path, monkeypatch):
    monkeypatch.delenv("GUCK_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("GUCK_CONFIG", raising=False)

    config_dir = tmp_path / "repo"
    config_dir.mkdir()
    config_path = config_dir / ".guck.json"
    local_config_path = config_dir / ".guck.local.json"
    config_path.write_text(
        json.dumps({"default_service": "base"}, indent=2), encoding="utf-8"
    )
    local_config_path.write_text(
        json.dumps({"default_service": "local"}, indent=2), encoding="utf-8"
    )

    result = load_config(config_path=str(config_dir))
    assert result["config"]["default_service"] == "local"
    assert result["local_config_path"] == str(local_config_path)


def test_env_overrides_win_over_local_override(tmp_path, monkeypatch):
    monkeypatch.delenv("GUCK_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("GUCK_CONFIG", raising=False)

    config_dir = tmp_path / "repo"
    config_dir.mkdir()
    config_path = config_dir / ".guck.json"
    local_config_path = config_dir / ".guck.local.json"
    config_path.write_text(json.dumps({}, indent=2), encoding="utf-8")
    local_config_path.write_text(
        json.dumps({"enabled": True}, indent=2), encoding="utf-8"
    )

    monkeypatch.setenv("GUCK_ENABLED", "false")
    result = load_config(config_path=str(config_dir))
    assert result["config"]["enabled"] is False
