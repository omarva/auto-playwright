"""Typed, validated view of the environment (see ../docs/CONVENTIONS.md)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, cast

from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parents[2]
REPORTS_DIR = PROJECT_DIR / "reports"

load_dotenv(PROJECT_DIR / ".env")

BrowserName = Literal["chromium", "firefox", "webkit"]
_BROWSERS: tuple[str, ...] = ("chromium", "firefox", "webkit")


def _str(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


def _int(name: str, default: int) -> int:
    raw = _str(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer, got {raw!r}") from exc
    if value < 0:
        raise ValueError(f"Environment variable {name} must be >= 0, got {value}")
    return value


def _bool(name: str, default: bool) -> bool:
    return _str(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _browser() -> BrowserName:
    value = _str("BROWSER", "chromium").lower()
    if value not in _BROWSERS:
        raise ValueError(f"BROWSER must be one of {', '.join(_BROWSERS)}, got {value!r}")
    return cast("BrowserName", value)


@dataclass(frozen=True)
class Dirs:
    reports: Path = REPORTS_DIR
    allure: Path = REPORTS_DIR / "allure-results"
    junit: Path = REPORTS_DIR / "junit"
    cucumber: Path = REPORTS_DIR / "cucumber"
    html: Path = REPORTS_DIR / "html"
    screenshots: Path = REPORTS_DIR / "artifacts" / "screenshots"
    traces: Path = REPORTS_DIR / "artifacts" / "traces"
    videos: Path = REPORTS_DIR / "artifacts" / "videos"


@dataclass(frozen=True)
class Config:
    browser: BrowserName = field(default_factory=_browser)
    channel: str | None = field(default_factory=lambda: _str("BROWSER_CHANNEL", "") or None)
    headless: bool = field(default_factory=lambda: _bool("HEADLESS", True))
    slow_mo: int = field(default_factory=lambda: _int("SLOW_MO", 0))
    timeout: int = field(default_factory=lambda: _int("TIMEOUT", 15_000))
    navigation_timeout: int = field(default_factory=lambda: _int("NAV_TIMEOUT", 30_000))
    base_url: str = field(default_factory=lambda: _str("BASE_URL", "https://www.saucedemo.com"))
    api_base_url: str = field(default_factory=lambda: _str("API_BASE_URL", "https://jsonplaceholder.typicode.com"))
    backend_url: str = field(default_factory=lambda: _str("BACKEND_URL", "http://localhost:3000"))
    backend_required: bool = field(default_factory=lambda: _bool("BACKEND_REQUIRED", False))
    demo_url: str = field(default_factory=lambda: _str("DEMO_URL", "https://playwright.dev"))
    user_password: str = field(default_factory=lambda: _str("USER_PASSWORD", "secret_sauce"))
    tags: str = field(default_factory=lambda: _str("TAGS", "not @wip"))
    parallel: int = field(default_factory=lambda: _int("PARALLEL", 2))
    retries: int = field(default_factory=lambda: _int("RETRIES", 0))
    trace: str = field(default_factory=lambda: _str("TRACE", "retain-on-failure").lower())
    video: str = field(default_factory=lambda: _str("VIDEO", "off").lower())
    screenshot: str = field(default_factory=lambda: _str("SCREENSHOT", "only-on-failure").lower())
    viewport_width: int = 1280
    viewport_height: int = 720
    test_id_attribute: str = "data-test"
    dirs: Dirs = field(default_factory=Dirs)


def tags_to_markexpr(tags: str) -> str:
    """Translate a Cucumber tag expression (``@smoke and not @wip``) to pytest ``-m`` syntax."""
    return " ".join(token.lstrip("@") for token in tags.replace("(", " ( ").replace(")", " ) ").split())


config = Config()
