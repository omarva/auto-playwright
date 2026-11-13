package dev.autoplaywright.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import dev.autoplaywright.pages.PlaywrightSitePage;
import dev.autoplaywright.support.Patterns;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Steps for features/demo/playwright_site.feature, plus generic page steps. */
public class DemoSteps {

  private final ScenarioContext ctx;

  public DemoSteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  private PlaywrightSitePage site() {
    return new PlaywrightSitePage(ctx.page());
  }

  @Given("I open the Playwright website")
  public void iOpenThePlaywrightWebsite() {
    site().openHome();
  }

  @When("I click the {string} link")
  public void iClickTheLink(String name) {
    site().clickLink(name);
  }

  @When("I open the {string} installation guide")
  public void iOpenTheInstallationGuide(String language) {
    site().openInstallationGuide(language);
  }

  @Then("the page title should contain {string}")
  public void thePageTitleShouldContain(String text) {
    assertThat(ctx.page()).hasTitle(Patterns.containing(text));
  }

  @Then("the URL should contain {string}")
  public void theUrlShouldContain(String fragment) {
    assertThat(ctx.page()).hasURL(Patterns.containing(fragment));
  }

  @Then("I should see the heading {string}")
  public void iShouldSeeTheHeading(String name) {
    assertThat(site().heading(name)).isVisible();
  }

  @Then("I capture a screenshot named {string}")
  public void iCaptureAScreenshotNamed(String name) {
    ctx.attachScreenshot(name);
  }
}
