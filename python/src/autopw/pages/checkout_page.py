from __future__ import annotations

from typing import TYPE_CHECKING

from autopw.pages.base_page import BasePage

if TYPE_CHECKING:
    from playwright.sync_api import Page


class CheckoutPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)
        self.first_name = self.by_test_id("firstName")
        self.last_name = self.by_test_id("lastName")
        self.postal_code = self.by_test_id("postalCode")
        self.continue_button = self.by_test_id("continue")
        self.finish_button = self.by_test_id("finish")
        self.error = self.by_test_id("error")
        self.item_total = self.by_test_id("subtotal-label")
        self.complete_header = self.by_test_id("complete-header")

    def fill_details(self, first_name: str, last_name: str, postal_code: str) -> None:
        self.first_name.fill(first_name)
        self.last_name.fill(last_name)
        self.postal_code.fill(postal_code)

    def continue_to_overview(self) -> None:
        self.continue_button.click()

    def finish(self) -> None:
        self.finish_button.click()
