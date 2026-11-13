package dev.autoplaywright.steps;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.options.RequestOptions;
import dev.autoplaywright.config.Config;
import dev.autoplaywright.support.ScenarioContext;
import dev.autoplaywright.support.ScenarioContext.ApiResult;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.LinkedHashMap;
import java.util.Map;
import org.assertj.core.api.Assertions;

/** Steps for features/api/posts.feature – HTTP via Playwright's APIRequestContext. */
public class ApiSteps {

  private static final ObjectMapper JSON =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

  private final ScenarioContext ctx;

  public ApiSteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  @When("I send a GET request to {string}")
  public void iSendAGetRequestTo(String path) {
    attachRequest("GET", path, null);
    record(ctx.api().get(path));
  }

  @When("I send a POST request to {string} with body:")
  public void iSendAPostRequestToWithBody(String path, String body) {
    attachRequest("POST", path, body);
    record(
        ctx.api()
            .post(
                path,
                RequestOptions.create()
                    .setHeader("Content-Type", "application/json")
                    .setData(body)));
  }

  @Then("the response status should be {int}")
  public void theResponseStatusShouldBe(int status) {
    Assertions.assertThat(ctx.lastResponse().status())
        .as("HTTP status – body was:%n%s", ctx.lastResponse().body())
        .isEqualTo(status);
  }

  @Then("the response header {string} should contain {string}")
  public void theResponseHeaderShouldContain(String header, String expected) {
    Map<String, String> headers = ctx.lastResponse().headers();
    Assertions.assertThat(headers).containsKey(header.toLowerCase());
    Assertions.assertThat(headers.get(header.toLowerCase())).contains(expected);
  }

  @Then("the response field {string} should be {string}")
  public void theResponseFieldShouldBe(String field, String expected) {
    JsonNode node = json().at("/" + field.replace('.', '/'));
    Assertions.assertThat(node.isMissingNode()).as("field '%s' is present", field).isFalse();
    String actual = node.isValueNode() ? node.asText() : node.toString();
    Assertions.assertThat(actual).as("value of field '%s'", field).isEqualTo(expected);
  }

  @Then("the response should be a list of {int} items")
  public void theResponseShouldBeAListOfItems(int count) {
    JsonNode node = json();
    Assertions.assertThat(node.isArray()).as("response body is a JSON array").isTrue();
    Assertions.assertThat(node.size()).isEqualTo(count);
  }

  private JsonNode json() {
    try {
      return JSON.readTree(ctx.lastResponse().body());
    } catch (JsonProcessingException e) {
      throw new AssertionError("Response body is not valid JSON:\n" + ctx.lastResponse().body(), e);
    }
  }

  private void record(APIResponse response) {
    try {
      ApiResult result =
          new ApiResult(response.status(), Map.copyOf(response.headers()), response.text());
      ctx.lastResponse(result);
      Map<String, Object> report = new LinkedHashMap<>();
      report.put("status", result.status());
      report.put("statusText", response.statusText());
      report.put("url", response.url());
      report.put("headers", result.headers());
      report.put("body", parseOrRaw(result.body()));
      ctx.attachText(
          "Response " + result.status(), "application/json", JSON.writeValueAsString(report));
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    } finally {
      response.dispose();
    }
  }

  private void attachRequest(String method, String path, String body) {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("method", method);
    request.put("url", Config.apiBaseUrl() + path);
    if (body != null) {
      request.put("body", parseOrRaw(body));
    }
    try {
      ctx.attachText(
          "Request " + method + " " + path, "application/json", JSON.writeValueAsString(request));
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private static Object parseOrRaw(String text) {
    try {
      return JSON.readTree(text);
    } catch (JsonProcessingException e) {
      return text;
    }
  }
}
