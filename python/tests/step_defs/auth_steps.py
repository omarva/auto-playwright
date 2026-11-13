from __future__ import annotations

import re
from typing import TYPE_CHECKING

from playwright.sync_api import Page, expect
from pytest_bdd import given, then, when

from autopw.config import config
from tests.step_defs._patterns import q, step

if TYPE_CHECKING:
    from tests.conftest import Pages


@given("I am on the login page")
def on_login_page(pages: Pages) -> None:
    pages.login.open()


@given(step(f"I am logged in as {q('username')}"))
def logged_in_as(pages: Pages, page: Page, username: str) -> None:
    pages.login.open()
    pages.login.login(username, config.user_password)
    expect(page).to_have_url(re.compile(r"inventory\.html"))


@when(step(f"I log in as {q('username')}"))
def log_in_as(pages: Pages, username: str) -> None:
    pages.login.login(username, config.user_password)


@when(step(f"I log in with username {q('username')} and password {q('password')}"))
def log_in_with(pages: Pages, username: str, password: str) -> None:
    pages.login.login(username, password)


@when("I log out")
def log_out(pages: Pages) -> None:
    pages.inventory.logout()


@then("I should see the products page")
def products_page(pages: Pages, page: Page) -> None:
    expect(page).to_have_url(re.compile(r"inventory\.html"))
    expect(pages.inventory.items.first).to_be_visible()


@then(step(f"the header title should be {q('title')}"))
def header_title(pages: Pages, title: str) -> None:
    expect(pages.inventory.title).to_have_text(title)


@then(step(f"I should see the login error {q('message')}"))
def login_error(pages: Pages, message: str) -> None:
    expect(pages.login.error).to_have_text(message)


@then("I should be on the login page")
def on_login_page_now(pages: Pages, page: Page) -> None:
    expect(pages.login.login_button).to_be_visible()
    expect(page).to_have_url(config.base_url.rstrip("/") + "/")
