from __future__ import annotations

from typing import TYPE_CHECKING

from playwright.sync_api import expect
from pytest_bdd import given, then, when

from tests.step_defs._patterns import n, q, step

if TYPE_CHECKING:
    from tests.conftest import Pages


def _assert_sorted(values: list[str] | list[float], order: str) -> None:
    if order not in ("ascending", "descending"):
        raise ValueError(f"Unknown order {order!r}")
    expected = sorted(values, reverse=order == "descending")
    assert values == expected, f"values should be in {order} order: {values}"


# ---- Catalogue -------------------------------------------------------------


@then(step(f"I should see {n('count')} products"), converters={"count": int})
def product_count(pages: Pages, count: int) -> None:
    expect(pages.inventory.items).to_have_count(count)


@when(step(f"I sort products by {q('option')}"))
def sort_products(pages: Pages, option: str) -> None:
    pages.inventory.sort_by(option)


@then(step(f"the products should be sorted by {q('field')} in {q('order')} order"))
def products_sorted(pages: Pages, field: str, order: str) -> None:
    if field == "name":
        _assert_sorted(pages.inventory.names(), order)
    elif field == "price":
        _assert_sorted(pages.inventory.prices(), order)
    else:
        raise ValueError(f"Unknown sort field {field!r}")


# ---- Cart ------------------------------------------------------------------


@given(step(f"I have added {q('product')} to the cart"))
def have_added(pages: Pages, product: str) -> None:
    pages.inventory.add_to_cart(product)


@when(step(f"I add {q('product')} to the cart"))
def add_product(pages: Pages, product: str) -> None:
    pages.inventory.add_to_cart(product)


@when("I add the following products to the cart:")
def add_products(pages: Pages, datatable: list[list[str]]) -> None:
    for (product,) in datatable:
        pages.inventory.add_to_cart(product)


@when(step(f"I remove {q('product')} from the cart"))
def remove_product(pages: Pages, product: str) -> None:
    pages.inventory.remove_from_cart(product)


@when("I open the cart")
def open_cart(pages: Pages) -> None:
    pages.inventory.open_cart()


@then(step(f"the cart badge should show {n('count')}"), converters={"count": int})
def cart_badge(pages: Pages, count: int) -> None:
    expect(pages.inventory.cart_badge).to_have_text(str(count))


@then("the cart badge should not be visible")
def cart_badge_hidden(pages: Pages) -> None:
    expect(pages.inventory.cart_badge).to_be_hidden()


@then("the cart should contain:")
def cart_contains(pages: Pages, datatable: list[list[str]]) -> None:
    expect(pages.cart.item_names).to_have_text([row[0] for row in datatable])


# ---- Checkout --------------------------------------------------------------


@when("I proceed to checkout")
def proceed_to_checkout(pages: Pages) -> None:
    pages.inventory.open_cart()
    pages.cart.checkout()


@when(step(f"I enter first name {q('first')}, last name {q('last')} and postal code {q('zip_code')}"))
def enter_details(pages: Pages, first: str, last: str, zip_code: str) -> None:
    pages.checkout.fill_details(first, last, zip_code)


@when("I continue to the order overview")
def continue_to_overview(pages: Pages) -> None:
    pages.checkout.continue_to_overview()


@when("I finish the checkout")
def finish_checkout(pages: Pages) -> None:
    pages.checkout.finish()


@then(step(f"the order item total should be {q('total')}"))
def item_total(pages: Pages, total: str) -> None:
    expect(pages.checkout.item_total).to_have_text(f"Item total: {total}")


@then(step(f"I should see the checkout error {q('message')}"))
def checkout_error(pages: Pages, message: str) -> None:
    expect(pages.checkout.error).to_have_text(message)


@then(step(f"I should see the order confirmation {q('message')}"))
def order_confirmation(pages: Pages, message: str) -> None:
    expect(pages.checkout.complete_header).to_have_text(message)
