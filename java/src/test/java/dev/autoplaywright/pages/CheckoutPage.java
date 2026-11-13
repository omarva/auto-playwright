package dev.autoplaywright.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Checkout steps one (information), two (overview) and complete. */
public class CheckoutPage extends BasePage {

  public CheckoutPage(Page page) {
    super(page);
  }

  public void enterInformation(String firstName, String lastName, String postalCode) {
    byTestId("firstName").fill(firstName);
    byTestId("lastName").fill(lastName);
    byTestId("postalCode").fill(postalCode);
  }

  public void continueToOverview() {
    byTestId("continue").click();
  }

  public void finish() {
    byTestId("finish").click();
  }

  public Locator itemTotal() {
    return byTestId("subtotal-label");
  }

  public Locator error() {
    return byTestId("error");
  }

  public Locator confirmationHeader() {
    return byTestId("complete-header");
  }
}
