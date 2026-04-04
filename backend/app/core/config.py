import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)


def _parse_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)

    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int_env(name: str, default: int) -> int:
    value = os.getenv(name)

    if value is None:
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    db_host: str | None
    db_user: str | None
    db_password: str | None
    db_name: str | None
    default_admin_username: str | None
    default_admin_password: str | None
    email_host: str | None
    email_port: int
    email_secure: bool
    email_user: str | None
    email_pass: str | None
    email_from: str | None
    app_url: str | None


@lru_cache
def get_settings() -> Settings:
    return Settings(
        db_host=os.getenv("DB_HOST"),
        db_user=os.getenv("DB_USER"),
        db_password=os.getenv("DB_PASSWORD"),
        db_name=os.getenv("DB_NAME"),
        default_admin_username=os.getenv("DEFAULT_ADMIN_USERNAME"),
        default_admin_password=os.getenv("DEFAULT_ADMIN_PASSWORD"),
        email_host=os.getenv("EMAIL_HOST"),
        email_port=_parse_int_env("EMAIL_PORT", 587),
        email_secure=_parse_bool_env("EMAIL_SECURE", False),
        email_user=os.getenv("EMAIL_USER"),
        email_pass=os.getenv("EMAIL_PASS"),
        email_from=os.getenv("EMAIL_FROM"),
        app_url=os.getenv("APP_URL"),
    )
