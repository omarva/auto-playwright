package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Common behaviour shared by every page object. */
public abstract class BasePage {

  protected final Page page;

  protected BasePage(Page page) {
    this.page = page;
  }

  /** Shorthand for {@code page.getByTestId(...)} (test-id attribute is {@code data-test}). */
  protected Locator byTestId(String testId) {
    return page.getByTestId(testId);
  }

  public Page page() {
    return page;
  }
}
