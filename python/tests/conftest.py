"""Fixtures and hooks: lifecycle, configuration mapping and failure artifacts.

* ``browser``  - one per xdist worker (session scope), launched lazily.
* ``page``     - fresh context + page per scenario; only created when a step asks for it,
                 so ``@api`` scenarios never start a browser.
* ``api``      - Playwright ``APIRequestContext`` per scenario.
"""

from __future__ import annotations

import base64
import json
import os
import platform
import re
import shutil
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import TYPE_CHECKING, Any

import allure
import pytest
from playwright.sync_api import (
    APIRequestContext,
    APIResponse,
    Browser,
    BrowserContext,
    Page,
    Playwright,
    expect,
    sync_playwright,
)

import autopw.config as cfg
from autopw.config import Config, tags_to_markexpr
from autopw.pages import CartPage, CheckoutPage, InventoryPage, LoginPage, PlaywrightSitePage

if TYPE_CHECKING:
    from collections.abc import Generator, Iterator

pytest_plugins = [
    "tests.step_defs.auth_steps",
    "tests.step_defs.shop_steps",
    "tests.step_defs.api_steps",
    "tests.step_defs.demo_steps",
]


def _patch_allure_title_path() -> None:
    """allure-pytest-bdd assumes feature files live under pytest's rootdir.

    Ours are shared from ``../features``; compute the title path relative to the
    repository root instead of raising ``ValueError`` from ``Path.relative_to``.
    """
    import allure_pytest_bdd.pytest_bdd_listener as listener

    repo_root = cfg.PROJECT_DIR.parent

    def get_title_path(request: pytest.FixtureRequest, feature: Any) -> list[str]:
        parts = Path(os.path.relpath(feature.filename, repo_root)).parts
        return [*parts[:-1], feature.name or parts[-1]]

    listener.get_title_path = get_title_path


_patch_allure_title_path()

MARKERS = ("ui", "api", "smoke", "regression", "negative", "demo", "e2e", "wip", "a11y")
FEATURE_MARKERS = ("login", "inventory", "cart", "checkout")
HTML_EXTRAS = pytest.StashKey[list[Any]]()


# --------------------------------------------------------------------------- CLI / config


def settings() -> Config:
    """Current configuration (``--demo`` may replace it at start-up)."""
    return cfg.config


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("auto-playwright")
    group.addoption(
        "--demo",
        action="store_true",
        default=False,
        help="Run the @demo feature headed and slowed down so you can watch it.",
    )


def _is_controller(config_: pytest.Config) -> bool:
    return not hasattr(config_, "workerinput")


@pytest.hookimpl(tryfirst=True)
def pytest_cmdline_main(config: pytest.Config) -> None:
    """Map PARALLEL / RETRIES / TAGS env vars onto pytest options unless given on the CLI."""
    if not _is_controller(config):
        return  # xdist workers re-run this hook; their options come from the controller
    opts = config.option
    if opts.demo:
        cfg.config = replace(cfg.config, headless=False, slow_mo=max(cfg.config.slow_mo, 400))
        opts.markexpr = "demo"
        opts.numprocesses = 0
    if getattr(opts, "numprocesses", None) is None and settings().parallel > 1:
        opts.numprocesses = settings().parallel
    if not getattr(opts, "reruns", None) and settings().retries:
        opts.reruns = settings().retries
    if not opts.markexpr:
        opts.markexpr = tags_to_markexpr(settings().tags)


def pytest_configure(config: pytest.Config) -> None:
    for marker in (*MARKERS, *FEATURE_MARKERS):
        config.addinivalue_line("markers", f"{marker}: scenarios tagged @{marker}")
    if _is_controller(config):
        dirs = settings().dirs
        for path in (dirs.junit, dirs.cucumber, dirs.html, dirs.screenshots.parent):
            shutil.rmtree(path, ignore_errors=True)
        for path in (dirs.junit, dirs.cucumber, dirs.html, dirs.screenshots, dirs.traces, dirs.videos):
            path.mkdir(parents=True, exist_ok=True)


def pytest_sessionfinish(session: pytest.Session) -> None:
    if not _is_controller(session.config):
        return
    allure_dir = settings().dirs.allure
    allure_dir.mkdir(parents=True, exist_ok=True)
    env = {
        "Language": "Python",
        "Runner": "pytest-bdd",
        "Browser": settings().browser,
        "Headless": str(settings().headless).lower(),
        "Base URL": settings().base_url,
        "API URL": settings().api_base_url,
        "Python": platform.python_version(),
        "OS": f"{platform.system()} {platform.release()}",
    }
    lines = [key.replace(" ", "\\ ") + "=" + value for key, value in env.items()]
    (allure_dir / "environment.properties").write_text("\n".join(lines) + "\n", encoding="utf-8")


def pytest_html_report_title(report: Any) -> None:
    report.title = "Playwright + pytest-bdd · Python"


# --------------------------------------------------------------------------- reporting helpers


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")[:120]


@dataclass
class Reporter:
    """Attaches evidence to Allure *and* the pytest-html report at the same time."""

    node: pytest.Item

    def screenshot(self, page: Page, name: str) -> None:
        image = page.screenshot(full_page=True)
        allure.attach(image, name=name, attachment_type=allure.attachment_type.PNG)
        self.node.stash.setdefault(HTML_EXTRAS, []).append(
            html_extras().png(base64.b64encode(image).decode(), name=name)
        )

    def json(self, name: str, data: Any) -> None:
        text = json.dumps(data, indent=2, default=str)
        allure.attach(text, name=name, attachment_type=allure.attachment_type.JSON)
        self.node.stash.setdefault(HTML_EXTRAS, []).append(html_extras().json(data, name=name))


def html_extras() -> Any:
    from pytest_html import extras

    return extras


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[None]) -> Generator[None, Any, Any]:
    report = yield
    if report.when == "call":
        item.stash[_PHASE_FAILED] = report.failed
    # Evidence collected during this phase (steps, or fixture teardown) goes into pytest-html.
    extras = item.stash.get(HTML_EXTRAS, [])
    if extras:
        report.extras = [*getattr(report, "extras", []), *extras]
        item.stash[HTML_EXTRAS] = []
    return report


_PHASE_FAILED = pytest.StashKey[bool]()


# --------------------------------------------------------------------------- fixtures


@pytest.fixture(scope="session")
def playwright_instance() -> Iterator[Playwright]:
    with sync_playwright() as pw:
        pw.selectors.set_test_id_attribute(settings().test_id_attribute)
        expect.set_options(timeout=settings().timeout)
        yield pw


@pytest.fixture(scope="session")
def browser(playwright_instance: Playwright) -> Iterator[Browser]:
    launcher = getattr(playwright_instance, settings().browser)
    browser = launcher.launch(
        headless=settings().headless,
        slow_mo=settings().slow_mo,
        channel=settings().channel if settings().browser == "chromium" else None,
    )
    yield browser
    browser.close()


@pytest.fixture
def reporter(request: pytest.FixtureRequest) -> Reporter:
    return Reporter(request.node)


@pytest.fixture
def context(browser: Browser, request: pytest.FixtureRequest) -> Iterator[BrowserContext]:
    record_video = settings().video != "off"
    ctx = browser.new_context(
        viewport={"width": settings().viewport_width, "height": settings().viewport_height},
        ignore_https_errors=True,
        record_video_dir=str(settings().dirs.videos) if record_video else None,
    )
    ctx.set_default_timeout(settings().timeout)
    ctx.set_default_navigation_timeout(settings().navigation_timeout)
    if settings().trace != "off":
        ctx.tracing.start(screenshots=True, snapshots=True, sources=True, title=request.node.name)
    yield ctx

    failed = request.node.stash.get(_PHASE_FAILED, False)
    name = _safe_name(request.node.name)
    if settings().screenshot == "on" or (failed and settings().screenshot != "off"):
        for index, open_page in enumerate(ctx.pages):
            path = settings().dirs.screenshots / f"{name}-{index}.png"
            try:
                image = open_page.screenshot(path=str(path), full_page=True)
            except Exception as exc:  # noqa: BLE001 - evidence capture must never mask the real failure
                request.node.stash.setdefault(HTML_EXTRAS, []).append(html_extras().text(str(exc)))
                continue
            label = "failure-screenshot" if failed else "final-screenshot"
            allure.attach(image, name=label, attachment_type=allure.attachment_type.PNG)
            request.node.stash.setdefault(HTML_EXTRAS, []).append(
                html_extras().png(base64.b64encode(image).decode(), name=label)
            )
    if settings().trace != "off":
        if settings().trace == "on" or failed:
            trace_path = settings().dirs.traces / f"{name}.zip"
            ctx.tracing.stop(path=str(trace_path))
            allure.attach.file(str(trace_path), name="playwright-trace", extension="zip")
        else:
            ctx.tracing.stop()
    videos = [p.video for p in ctx.pages if p.video]
    ctx.close()
    keep_video = settings().video == "on" or (settings().video == "retain-on-failure" and failed)
    for video in videos:
        video_path = Path(video.path())
        if keep_video:
            allure.attach.file(str(video_path), name="recording", attachment_type=allure.attachment_type.WEBM)
        else:
            video_path.unlink(missing_ok=True)


@pytest.fixture
def page(context: BrowserContext) -> Page:
    return context.new_page()


@pytest.fixture
def api(playwright_instance: Playwright) -> Iterator[APIRequestContext]:
    ctx = playwright_instance.request.new_context(
        base_url=settings().api_base_url,
        timeout=settings().navigation_timeout,
        extra_http_headers={"Accept": "application/json"},
    )
    yield ctx
    ctx.dispose()


@dataclass
class ApiState:
    response: APIResponse | None = None
    body: Any = None
    extra: dict[str, Any] = field(default_factory=dict)


@pytest.fixture
def api_state() -> ApiState:
    return ApiState()


@dataclass
class Pages:
    login: LoginPage
    inventory: InventoryPage
    cart: CartPage
    checkout: CheckoutPage
    playwright_site: PlaywrightSitePage


@pytest.fixture
def pages(page: Page) -> Pages:
    return Pages(
        login=LoginPage(page),
        inventory=InventoryPage(page),
        cart=CartPage(page),
        checkout=CheckoutPage(page),
        playwright_site=PlaywrightSitePage(page),
    )
