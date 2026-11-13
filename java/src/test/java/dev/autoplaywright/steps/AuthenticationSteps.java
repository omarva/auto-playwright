package dev.autoplaywright.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import dev.autoplaywright.config.Config;
import dev.autoplaywright.pages.HeaderComponent;
import dev.autoplaywright.pages.InventoryPage;
import dev.autoplaywright.pages.LoginPage;
import dev.autoplaywright.support.Patterns;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.regex.Pattern;

/** Steps for features/ui/login.feature, plus the shared "logged in" precondition. */
public class AuthenticationSteps {

  private final ScenarioContext ctx;

  public AuthenticationSteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  private LoginPage loginPage() {
    return new LoginPage(ctx.page());
  }

  @Given("I am on the login page")
  public void iAmOnTheLoginPage() {
    loginPage().open();
  }

  @Given("I am logged in as {string}")
  public void iAmLoggedInAs(String username) {
    loginPage().open().login(username, Config.userPassword());
    iShouldSeeTheProductsPage();
  }

  @When("I log in as {string}")
  public void iLogInAs(String username) {
    loginPage().login(username, Config.userPassword());
  }

  @When("I log in with username {string} and password {string}")
  public void iLogInWithUsernameAndPassword(String username, String password) {
    loginPage().login(username, password);
  }

  @When("I log out")
  public void iLogOut() {
    new HeaderComponent(ctx.page()).logout();
  }

  @Then("I should see the products page")
  public void iShouldSeeTheProductsPage() {
    assertThat(ctx.page()).hasURL(Patterns.endingWith(InventoryPage.PATH));
    assertThat(new InventoryPage(ctx.page()).items().first()).isVisible();
  }

  @Then("the header title should be {string}")
  public void theHeaderTitleShouldBe(String title) {
    assertThat(new HeaderComponent(ctx.page()).title()).hasText(title);
  }

  @Then("I should see the login error {string}")
  public void iShouldSeeTheLoginError(String message) {
    assertThat(loginPage().error()).hasText(message);
  }

  @Then("I should be on the login page")
  public void iShouldBeOnTheLoginPage() {
    assertThat(loginPage().loginButton()).isVisible();
    assertThat(ctx.page()).hasURL(Pattern.compile("^" + Patterns.escape(Config.baseUrl()) + "/?$"));
  }
}
