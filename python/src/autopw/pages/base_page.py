from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import Locator, Page


class BasePage:
    """Shared behaviour for every page object."""

    def __init__(self, page: Page) -> None:
        self.page = page

    def goto(self, url: str) -> None:
        self.page.goto(url, wait_until="domcontentloaded")

    def by_test_id(self, test_id: str) -> Locator:
        return self.page.get_by_test_id(test_id)
