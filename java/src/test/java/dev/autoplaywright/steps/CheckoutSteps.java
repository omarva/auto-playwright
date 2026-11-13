package dev.autoplaywright.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import dev.autoplaywright.pages.CartPage;
import dev.autoplaywright.pages.CheckoutPage;
import dev.autoplaywright.pages.HeaderComponent;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Steps for features/ui/checkout.feature. */
public class CheckoutSteps {

  private final ScenarioContext ctx;

  public CheckoutSteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  private CheckoutPage checkout() {
    return new CheckoutPage(ctx.page());
  }

  @When("I proceed to checkout")
  public void iProceedToCheckout() {
    new HeaderComponent(ctx.page()).openCart();
    new CartPage(ctx.page()).checkout();
  }

  @When("I enter first name {string}, last name {string} and postal code {string}")
  public void iEnterCustomerInformation(String firstName, String lastName, String postalCode) {
    checkout().enterInformation(firstName, lastName, postalCode);
  }

  @When("I continue to the order overview")
  public void iContinueToTheOrderOverview() {
    checkout().continueToOverview();
  }

  @When("I finish the checkout")
  public void iFinishTheCheckout() {
    checkout().finish();
  }

  @Then("the order item total should be {string}")
  public void theOrderItemTotalShouldBe(String amount) {
    assertThat(checkout().itemTotal()).hasText("Item total: " + amount);
  }

  @Then("I should see the order confirmation {string}")
  public void iShouldSeeTheOrderConfirmation(String message) {
    assertThat(checkout().confirmationHeader()).hasText(message);
  }

  @Then("I should see the checkout error {string}")
  public void iShouldSeeTheCheckoutError(String message) {
    assertThat(checkout().error()).hasText(message);
  }
}
