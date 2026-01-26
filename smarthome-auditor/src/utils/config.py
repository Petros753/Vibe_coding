"""Configuration management for SmartHome Security Auditor."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field


class ScanConfig(BaseModel):
    """Network scanning configuration."""

    timeout: float = 2.0
    max_concurrent: int = 100
    port_scan_timeout: float = 1.0
    common_ports_only: bool = True
    resolve_hostnames: bool = True


class AuditConfig(BaseModel):
    """Audit configuration."""

    deep_scan: bool = False
    check_credentials: bool = True
    check_ssl: bool = True
    check_cve: bool = True
    max_concurrent: int = 5


class TelegramConfig(BaseModel):
    """Telegram notification configuration."""

    enabled: bool = False
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    notify_on: list[str] = Field(default_factory=lambda: ["critical", "high"])


class DatabaseConfig(BaseModel):
    """Database configuration."""

    path: str = "~/.smarthome-auditor/audits.db"
    save_results: bool = True


class Config(BaseModel):
    """Main configuration."""

    scan: ScanConfig = Field(default_factory=ScanConfig)
    audit: AuditConfig = Field(default_factory=AuditConfig)
    telegram: TelegramConfig = Field(default_factory=TelegramConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)

    # Output settings
    output_dir: str = "~/.smarthome-auditor/reports"
    verbose: bool = False
    quiet: bool = False
    no_color: bool = False

    def get_output_dir(self) -> Path:
        """Get expanded output directory path."""
        return Path(self.output_dir).expanduser()

    def get_database_path(self) -> Path:
        """Get expanded database path."""
        return Path(self.database.path).expanduser()


def load_config(config_path: Optional[str] = None) -> Config:
    """Load configuration from file or use defaults."""
    # Default config locations
    default_locations = [
        Path.cwd() / "config.yaml",
        Path.cwd() / "config.yml",
        Path.home() / ".smarthome-auditor" / "config.yaml",
        Path("/etc/smarthome-auditor/config.yaml"),
    ]

    config_file = None

    if config_path:
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
    else:
        for location in default_locations:
            if location.exists():
                config_file = location
                break

    if config_file and config_file.exists():
        with open(config_file, "r") as f:
            data = yaml.safe_load(f)
            if data:
                return Config(**data)

    return Config()


def save_config(config: Config, path: Optional[str] = None) -> None:
    """Save configuration to file."""
    if path is None:
        config_dir = Path.home() / ".smarthome-auditor"
        config_dir.mkdir(parents=True, exist_ok=True)
        path = config_dir / "config.yaml"

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:
        yaml.dump(config.model_dump(), f, default_flow_style=False)


def get_default_config_yaml() -> str:
    """Get default configuration as YAML string."""
    config = Config()
    return yaml.dump(config.model_dump(), default_flow_style=False)


# Environment variable overrides
def apply_env_overrides(config: Config) -> Config:
    """Apply environment variable overrides to configuration."""
    env_mappings = {
        "SMARTHOME_AUDITOR_VERBOSE": ("verbose", lambda x: x.lower() == "true"),
        "SMARTHOME_AUDITOR_QUIET": ("quiet", lambda x: x.lower() == "true"),
        "SMARTHOME_AUDITOR_TIMEOUT": ("scan.timeout", float),
        "SMARTHOME_AUDITOR_TELEGRAM_TOKEN": ("telegram.bot_token", str),
        "SMARTHOME_AUDITOR_TELEGRAM_CHAT": ("telegram.chat_id", str),
    }

    config_dict = config.model_dump()

    for env_var, (config_path, converter) in env_mappings.items():
        value = os.environ.get(env_var)
        if value is not None:
            # Navigate and set nested config
            parts = config_path.split(".")
            current = config_dict
            for part in parts[:-1]:
                current = current[part]
            current[parts[-1]] = converter(value)

    return Config(**config_dict)
