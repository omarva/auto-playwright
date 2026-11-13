from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import urljoin

from autopw.config import config
from autopw.pages.base_page import BasePage

if TYPE_CHECKING:
    from playwright.sync_api import Locator

DOCS_PATHS: dict[str, str] = {
    "Node.js": "/docs/intro",
    "Python": "/python/docs/intro",
    "Java": "/java/docs/intro",
    ".NET": "/dotnet/docs/intro",
}


class PlaywrightSitePage(BasePage):
    def open(self) -> None:
        self.goto(config.demo_url)

    def open_installation_guide(self, language: str) -> None:
        if language not in DOCS_PATHS:
            raise ValueError(f"Unknown language {language!r}. Expected one of: {', '.join(DOCS_PATHS)}")
        self.goto(urljoin(config.demo_url, DOCS_PATHS[language]))

    def click_link(self, name: str) -> None:
        self.page.get_by_role("link", name=name, exact=True).first.click()

    def heading(self, name: str) -> Locator:
        return self.page.get_by_role("heading", name=name, exact=True, level=1)
