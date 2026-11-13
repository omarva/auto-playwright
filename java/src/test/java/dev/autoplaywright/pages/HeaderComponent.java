package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

/** The header and burger menu shown on every authenticated page. */
public class HeaderComponent extends BasePage {

  public HeaderComponent(Page page) {
    super(page);
  }

  public Locator title() {
    return byTestId("title");
  }

  public Locator cartBadge() {
    return byTestId("shopping-cart-badge");
  }

  public void openCart() {
    byTestId("shopping-cart-link").click();
  }

  public void logout() {
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Open Menu")).click();
    byTestId("logout-sidebar-link").click();
  }
}
