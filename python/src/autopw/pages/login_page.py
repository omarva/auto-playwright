from __future__ import annotations

from typing import TYPE_CHECKING

from autopw.config import config
from autopw.pages.base_page import BasePage

if TYPE_CHECKING:
    from playwright.sync_api import Page


class LoginPage(BasePage):
    def __init__(self, page: Page) -> None:
        super().__init__(page)
        self.username = self.by_test_id("username")
        self.password = self.by_test_id("password")
        self.login_button = self.by_test_id("login-button")
        self.error = self.by_test_id("error")

    def open(self) -> None:
        self.goto(config.base_url)

    def login(self, username: str, password: str) -> None:
        self.username.fill(username)
        self.password.fill(password)
        self.login_button.click()
