import json
from pathlib import Path

from hunch.config import load_config, resolve_store_dir


def _write_config(path: Path, store_dir: str = "logs/hunch") -> None:
    path.write_text(json.dumps({"store_dir": store_dir}, indent=2), encoding="utf-8")


def test_load_config_directory_path(tmp_path, monkeypatch):
    monkeypatch.delenv("HUNCH_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("HUNCH_CONFIG", raising=False)

    config_dir = tmp_path / "repo"
    config_dir.mkdir()
    config_path = config_dir / ".hunch.json"
    _write_config(config_path)

    result = load_config(config_path=str(config_dir))
    assert result["root_dir"] == str(config_dir)
    assert resolve_store_dir(result["config"], result["root_dir"]) == str(
        config_dir / "logs/hunch"
    )


def test_load_config_relative_path_uses_cwd(tmp_path, monkeypatch):
    monkeypatch.delenv("HUNCH_CWD", raising=False)
    monkeypatch.delenv("INIT_CWD", raising=False)
    monkeypatch.delenv("HUNCH_CONFIG", raising=False)

    base_dir = tmp_path / "root"
    config_dir = base_dir / "config"
    config_dir.mkdir(parents=True)
    config_path = config_dir / ".hunch.json"
    _write_config(config_path)

    result = load_config(cwd=str(base_dir), config_path="config/.hunch.json")
    assert result["root_dir"] == str(config_dir)
    assert resolve_store_dir(result["config"], result["root_dir"]) == str(
        config_dir / "logs/hunch"
    )
