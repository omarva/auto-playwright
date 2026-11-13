from __future__ import annotations

from typing import TYPE_CHECKING

from autopw.pages.base_page import BasePage

if TYPE_CHECKING:
    from playwright.sync_api import Page


class CartPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)
        self.item_names = self.by_test_id("inventory-item-name")
        self.checkout_button = self.by_test_id("checkout")

    def checkout(self) -> None:
        self.checkout_button.click()
