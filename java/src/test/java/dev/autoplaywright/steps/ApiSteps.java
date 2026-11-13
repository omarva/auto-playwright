package dev.autoplaywright.steps;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import dev.autoplaywright.config.Config;
import dev.autoplaywright.support.ApiSession;
import dev.autoplaywright.support.ApiSession.Response;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.opentest4j.TestAbortedException;

/**
 * The generic API step library shared by every language (docs/CONVENTIONS.md section 7).
 *
 * <p>Cucumber-JVM matches steps regardless of the Given/When/Then keyword, so every step here can
 * be used after any keyword.
 */
public class ApiSteps {

  private static final String Q = "\"([^\"]*)\"";
  private static final String METHOD = "(GET|POST|PUT|PATCH|DELETE)";

  private final ApiSession api;

  public ApiSteps(ApiSession api) {
    this.api = api;
  }

  // ------------------------------------------------------------------ services & auth

  @Given("^I use the " + Q + " API$")
  public void iUseTheApi(String service) {
    if (api.useService(service)) {
      return;
    }
    String message =
        "Todo API is not running at "
            + api.baseUrl()
            + " - start it with `node backend/server.mjs`";
    if (Config.backendRequired()) {
      throw new AssertionError(message + " (BACKEND_REQUIRED=true)");
    }
    throw new TestAbortedException(message);
  }

  @When("^I log in to the API as " + Q + " with password " + Q + "$")
  public void iLogInToTheApiAs(String username, String password) {
    login(username, password);
  }

  @Given("^I am authenticated as " + Q + " with password " + Q + "$")
  public void iAmAuthenticatedAs(String username, String password) {
    api.token(null);
    Response response = login(username, password);
    assertThat(response.status())
        .as("login as %s should succeed - body was:%n%s", username, response.text())
        .isEqualTo(200);
    api.token(ApiSession.render(ApiSession.resolve(response.json(), "token")));
  }

  @Given("^I am not authenticated$")
  public void iAmNotAuthenticated() {
    api.token(null);
  }

  @Given("^I use the bearer token " + Q + "$")
  public void iUseTheBearerToken(String token) {
    api.token(token);
  }

  private Response login(String username, String password) {
    String body;
    try {
      body = ApiSession.JSON.writeValueAsString(Map.of("username", username, "password", password));
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
    return api.send("POST", "/api/auth/login", body);
  }

  // ------------------------------------------------------------------ requests

  @When("^I send a " + METHOD + " request to " + Q + "$")
  public void iSendARequestTo(String method, String path) {
    api.send(method, path, null);
  }

  @When("^I send a " + METHOD + " request to " + Q + " with body:$")
  public void iSendARequestToWithBody(String method, String path, String body) {
    api.send(method, path, body);
  }

  @When("^I store the response field " + Q + " as " + Q + "$")
  public void iStoreTheResponseFieldAs(String path, String name) {
    api.store(name, ApiSession.render(ApiSession.resolve(api.last().json(), path)));
  }

  // ------------------------------------------------------------------ assertions

  @Then("^the response status should be (\\d+)$")
  public void theResponseStatusShouldBe(int status) {
    Response r = api.last();
    assertThat(r.status())
        .as("HTTP status of %s %s - body was:%n%s", r.method(), r.url(), r.text())
        .isEqualTo(status);
  }

  @Then("^the response header " + Q + " should contain " + Q + "$")
  public void theResponseHeaderShouldContain(String header, String expected) {
    String value = api.last().headers().get(header.toLowerCase());
    assertThat(value).as("header \"%s\"", header).isNotNull();
    assertThat(value).as("header \"%s\"", header).contains(api.interpolate(expected));
  }

  @Then("^the response field " + Q + " should be " + Q + "$")
  public void theResponseFieldShouldBe(String path, String expected) {
    String actual = ApiSession.render(ApiSession.resolve(api.last().json(), path));
    assertThat(actual).as("field \"%s\"", path).isEqualTo(api.interpolate(expected));
  }

  @Then("^the response field " + Q + " should not be empty$")
  public void theResponseFieldShouldNotBeEmpty(String path) {
    JsonNode node = ApiSession.resolve(api.last().json(), path);
    assertThat(node.isNull()).as("field \"%s\" is null", path).isFalse();
    assertThat(ApiSession.render(node)).as("field \"%s\"", path).isNotEmpty();
  }

  @Then("^the response field " + Q + " should contain " + Q + "$")
  public void theResponseFieldShouldContain(String path, String expected) {
    JsonNode node = ApiSession.resolve(api.last().json(), path);
    String text = api.interpolate(expected);
    if (node.isArray()) {
      List<String> rendered =
          StreamSupport.stream(node.spliterator(), false).map(ApiSession::render).toList();
      assertThat(rendered).as("field \"%s\"", path).contains(text);
    } else {
      assertThat(ApiSession.render(node)).as("field \"%s\"", path).contains(text);
    }
  }

  @Then("^the response should be a list of (\\d+) items$")
  public void theResponseShouldBeAListOfItems(int count) {
    assertThat(items()).hasSize(count);
  }

  @Then("^every item in the response should have field " + Q + " equal to " + Q + "$")
  public void everyItemShouldHaveFieldEqualTo(String path, String expected) {
    String value = api.interpolate(expected);
    List<JsonNode> items = items();
    assertThat(items).as("response list").isNotEmpty();
    List<JsonNode> offenders = new ArrayList<>();
    for (JsonNode item : items) {
      if (!matches(item, path, value)) {
        offenders.add(item);
      }
    }
    assertThat(offenders).as("items whose \"%s\" is not \"%s\"", path, value).isEmpty();
  }

  @Then("^the response should contain an item with field " + Q + " equal to " + Q + "$")
  public void theResponseShouldContainAnItemWith(String path, String expected) {
    String value = api.interpolate(expected);
    assertThat(items().stream().anyMatch(item -> matches(item, path, value)))
        .as("an item with \"%s\" = \"%s\" in:%n%s", path, value, api.last().text())
        .isTrue();
  }

  @Then("^the response should not contain an item with field " + Q + " equal to " + Q + "$")
  public void theResponseShouldNotContainAnItemWith(String path, String expected) {
    String value = api.interpolate(expected);
    assertThat(items().stream().anyMatch(item -> matches(item, path, value)))
        .as("no item with \"%s\" = \"%s\"", path, value)
        .isFalse();
  }

  @Then("^the response should match the " + Q + " schema$")
  public void theResponseShouldMatchTheSchema(String name) {
    List<String> violations = ApiSession.schemaViolations(name, api.last().json());
    assertThat(violations)
        .as("schema \"%s\" violations:%n%s", name, String.join("\n", violations))
        .isEmpty();
  }

  @Then("^the response time should be below (\\d+) ms$")
  public void theResponseTimeShouldBeBelow(long limitMs) {
    assertThat(api.last().durationMs()).as("response time in ms").isLessThan(limitMs);
  }

  @Then("^the response body should be empty$")
  public void theResponseBodyShouldBeEmpty() {
    assertThat(api.last().text()).as("response body").isEmpty();
  }

  // ------------------------------------------------------------------ helpers

  private List<JsonNode> items() {
    JsonNode body = api.last().json();
    assertThat(body.isArray()).as("response body is a JSON array:%n%s", body).isTrue();
    return StreamSupport.stream(body.spliterator(), false).toList();
  }

  private static boolean matches(JsonNode item, String path, String expected) {
    JsonNode node = ApiSession.resolveOrNull(item, path);
    return node != null && ApiSession.render(node).equals(expected);
  }
}
