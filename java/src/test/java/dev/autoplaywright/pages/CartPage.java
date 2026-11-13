package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** The shopping cart page. */
public class CartPage extends BasePage {

  public static final String PATH = "/cart.html";

  public CartPage(Page page) {
    super(page);
  }

  public Locator itemNames() {
    return byTestId("inventory-item-name");
  }

  public void checkout() {
    byTestId("checkout").click();
  }
}
