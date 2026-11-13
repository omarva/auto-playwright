package dev.autoplaywright.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import dev.autoplaywright.config.Config;
import dev.autoplaywright.pages.InventoryPage;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Supplier;
import org.assertj.core.api.Assertions;

/** Steps for features/ui/inventory.feature. */
public class InventorySteps {

  private final ScenarioContext ctx;

  public InventorySteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  private InventoryPage inventory() {
    return new InventoryPage(ctx.page());
  }

  @Then("I should see {int} products")
  public void iShouldSeeProducts(int count) {
    assertThat(inventory().items()).hasCount(count);
  }

  @When("I sort products by {string}")
  public void iSortProductsBy(String option) {
    inventory().sortBy(option);
  }

  @Then("the products should be sorted by {string} in {string} order")
  public void theProductsShouldBeSortedBy(String field, String order) {
    boolean descending =
        switch (order) {
          case "ascending" -> false;
          case "descending" -> true;
          default -> throw new IllegalArgumentException("Unknown sort order: " + order);
        };
    switch (field) {
      case "name" ->
          assertSorted(inventory()::productNames, Comparator.<String>naturalOrder(), descending);
      case "price" ->
          assertSorted(inventory()::productPrices, Comparator.<Double>naturalOrder(), descending);
      default -> throw new IllegalArgumentException("Unknown sort field: " + field);
    }
  }

  /** Polls until the list is sorted (the UI re-renders asynchronously), then asserts it. */
  private static <T> void assertSorted(
      Supplier<List<T>> values, Comparator<T> comparator, boolean descending) {
    Comparator<T> expectedOrder = descending ? comparator.reversed() : comparator;
    long deadline = System.currentTimeMillis() + (long) Config.timeout();
    List<T> actual = values.get();
    while (!isSorted(actual, expectedOrder) && System.currentTimeMillis() < deadline) {
      pause();
      actual = values.get();
    }
    List<T> expected = new ArrayList<>(actual);
    expected.sort(expectedOrder);
    Assertions.assertThat(actual).isNotEmpty().containsExactlyElementsOf(expected);
  }

  private static <T> boolean isSorted(List<T> list, Comparator<T> order) {
    for (int i = 1; i < list.size(); i++) {
      if (order.compare(list.get(i - 1), list.get(i)) > 0) {
        return false;
      }
    }
    return !list.isEmpty();
  }

  private static void pause() {
    try {
      Thread.sleep(100);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
