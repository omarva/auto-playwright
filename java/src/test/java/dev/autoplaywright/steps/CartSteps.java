package dev.autoplaywright.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import dev.autoplaywright.pages.CartPage;
import dev.autoplaywright.pages.HeaderComponent;
import dev.autoplaywright.pages.InventoryPage;
import dev.autoplaywright.support.Patterns;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;
import org.assertj.core.api.Assertions;

/** Steps for features/ui/cart.feature (and the cart precondition used by checkout). */
public class CartSteps {

  private final ScenarioContext ctx;

  public CartSteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  private InventoryPage inventory() {
    return new InventoryPage(ctx.page());
  }

  private HeaderComponent header() {
    return new HeaderComponent(ctx.page());
  }

  @When("I add {string} to the cart")
  public void iAddToTheCart(String product) {
    inventory().addToCart(product);
  }

  @Given("I have added {string} to the cart")
  public void iHaveAddedToTheCart(String product) {
    inventory().addToCart(product);
    assertThat(header().cartBadge()).isVisible();
  }

  @When("I add the following products to the cart:")
  public void iAddTheFollowingProductsToTheCart(List<String> products) {
    products.forEach(inventory()::addToCart);
  }

  @When("I remove {string} from the cart")
  public void iRemoveFromTheCart(String product) {
    inventory().removeFromCart(product);
  }

  @When("I open the cart")
  public void iOpenTheCart() {
    header().openCart();
    assertThat(ctx.page()).hasURL(Patterns.endingWith(CartPage.PATH));
  }

  @Then("the cart badge should show {int}")
  public void theCartBadgeShouldShow(int count) {
    assertThat(header().cartBadge()).hasText(String.valueOf(count));
  }

  @Then("the cart badge should not be visible")
  public void theCartBadgeShouldNotBeVisible() {
    assertThat(header().cartBadge()).isHidden();
  }

  @Then("the cart should contain:")
  public void theCartShouldContain(List<String> products) {
    CartPage cart = new CartPage(ctx.page());
    assertThat(cart.itemNames()).hasCount(products.size());
    Assertions.assertThat(cart.itemNames().allTextContents())
        .containsExactlyInAnyOrderElementsOf(products);
  }
}
