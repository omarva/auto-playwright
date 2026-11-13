from __future__ import annotations

import re
from typing import TYPE_CHECKING

from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect
from pytest_bdd import given, then, when

from tests.step_defs._patterns import q, step

if TYPE_CHECKING:
    from tests.conftest import Pages, Reporter

# ---- playwright.dev demo ---------------------------------------------------


@given("I open the Playwright website")
def open_playwright_site(pages: Pages) -> None:
    pages.playwright_site.open()


@when(step(f"I click the {q('name')} link"))
def click_link(pages: Pages, name: str) -> None:
    pages.playwright_site.click_link(name)


@when(step(f"I open the {q('language')} installation guide"))
def open_installation_guide(pages: Pages, language: str) -> None:
    pages.playwright_site.open_installation_guide(language)


@then(step(f"the page title should contain {q('text')}"))
def title_contains(page: Page, text: str) -> None:
    expect(page).to_have_title(re.compile(re.escape(text)))


@then(step(f"the URL should contain {q('fragment')}"))
def url_contains(page: Page, fragment: str) -> None:
    expect(page).to_have_url(re.compile(re.escape(fragment)))


@then(step(f"I should see the heading {q('name')}"))
def heading_visible(pages: Pages, name: str) -> None:
    expect(pages.playwright_site.heading(name)).to_be_visible()


@then(step(f"I capture a screenshot named {q('name')}"))
def capture_screenshot(page: Page, reporter: Reporter, name: str) -> None:
    reporter.screenshot(page, name)


# ---- Accessibility ---------------------------------------------------------

WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
BLOCKING_IMPACTS = {"serious", "critical"}


@then("the page should have no serious accessibility violations")
def no_serious_a11y_violations(page: Page, reporter: Reporter) -> None:
    results = Axe().run(page, options={"runOnly": {"type": "tag", "values": WCAG_TAGS}})
    violations = results.response.get("violations", [])
    reporter.json("axe-violations", violations)
    blocking = [
        f"[{v['impact']}] {v['id']}: {v['help']} ({len(v['nodes'])} element(s)) - {v['helpUrl']}"
        for v in violations
        if v.get("impact") in BLOCKING_IMPACTS
    ]
    assert not blocking, "Accessibility violations:\n" + "\n".join(blocking)
