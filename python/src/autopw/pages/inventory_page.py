from __future__ import annotations

from typing import TYPE_CHECKING

from autopw.pages.base_page import BasePage

if TYPE_CHECKING:
    from playwright.sync_api import Locator, Page


class InventoryPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)
        self.title = self.by_test_id("title")
        self.items = self.by_test_id("inventory-item")
        self.item_names = self.by_test_id("inventory-item-name")
        self.item_prices = self.by_test_id("inventory-item-price")
        self.sort_select = self.by_test_id("product-sort-container")
        self.cart_badge = self.by_test_id("shopping-cart-badge")
        self.cart_link = self.by_test_id("shopping-cart-link")
        self.menu_button = page.get_by_role("button", name="Open Menu")
        self.logout_link = self.by_test_id("logout-sidebar-link")

    def item(self, name: str) -> Locator:
        return self.items.filter(has=self.page.get_by_text(name, exact=True))

    def add_to_cart(self, name: str) -> None:
        self.item(name).get_by_role("button", name="Add to cart").click()

    def remove_from_cart(self, name: str) -> None:
        self.item(name).get_by_role("button", name="Remove").click()

    def sort_by(self, label: str) -> None:
        self.sort_select.select_option(label=label)

    def names(self) -> list[str]:
        return self.item_names.all_text_contents()

    def prices(self) -> list[float]:
        return [float(text.replace("$", "")) for text in self.item_prices.all_text_contents()]

    def open_cart(self) -> None:
        self.cart_link.click()

    def logout(self) -> None:
        self.menu_button.click()
        self.logout_link.click()
