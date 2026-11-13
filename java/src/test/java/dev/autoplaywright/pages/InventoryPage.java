package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.SelectOption;
import java.util.List;

/** The product catalogue (inventory) page. */
public class InventoryPage extends BasePage {

  public static final String PATH = "/inventory.html";

  public InventoryPage(Page page) {
    super(page);
  }

  public Locator items() {
    return byTestId("inventory-item");
  }

  public Locator item(String productName) {
    return items().filter(new Locator.FilterOptions().setHasText(productName));
  }

  public void addToCart(String productName) {
    item(productName)
        .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add to cart"))
        .click();
  }

  public void removeFromCart(String productName) {
    item(productName)
        .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Remove"))
        .click();
  }

  public void sortBy(String optionLabel) {
    byTestId("product-sort-container").selectOption(new SelectOption().setLabel(optionLabel));
  }

  public List<String> productNames() {
    return byTestId("inventory-item-name").allTextContents();
  }

  public List<Double> productPrices() {
    return byTestId("inventory-item-price").allTextContents().stream()
        .map(price -> Double.parseDouble(price.replace("$", "").trim()))
        .toList();
  }
}
