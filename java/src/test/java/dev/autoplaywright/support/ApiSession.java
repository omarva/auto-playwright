package dev.autoplaywright.support;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.RequestOptions;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import dev.autoplaywright.config.Config;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Per-scenario state of the generic API step library (docs/CONVENTIONS.md section 7): the selected
 * service, the bearer token, scenario variables and the last response.
 *
 * <p>Created by PicoContainer once per scenario, so parallel scenarios never share state.
 */
public class ApiSession {

  /** Pretty printer for report attachments. */
  public static final ObjectMapper JSON =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

  private static final ObjectMapper PARSER = new ObjectMapper();
  private static final Pattern VARIABLE = Pattern.compile("\\$\\{([A-Za-z0-9_]+)}");
  private static final SchemaRegistry SCHEMAS =
      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_7);
  private static final Map<String, Schema> SCHEMA_CACHE = new ConcurrentHashMap<>();

  /** The outcome of one HTTP call. */
  public record Response(
      String method,
      String url,
      int status,
      String statusText,
      Map<String, String> headers,
      String text,
      long durationMs) {

    /** The body parsed as JSON; fails the step with a readable message if it is not JSON. */
    public JsonNode json() {
      try {
        return PARSER.readTree(text.isEmpty() ? "null" : text);
      } catch (JsonProcessingException e) {
        throw new AssertionError("Response body is not valid JSON:\n" + text, e);
      }
    }
  }

  private final ScenarioContext ctx;
  private final Map<String, String> variables = new HashMap<>();
  private String baseUrl = Config.apiBaseUrl();
  private String token;
  private Response last;

  public ApiSession(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  public String baseUrl() {
    return baseUrl;
  }

  /**
   * Switches to a named service.
   *
   * @return {@code false} when the service has a health check and it is unreachable
   */
  public boolean useService(String service) {
    switch (service.toLowerCase(Locale.ROOT)) {
      case "jsonplaceholder" -> {
        baseUrl = Config.apiBaseUrl();
        return true;
      }
      case "todo" -> {
        baseUrl = Config.backendUrl();
        return healthy();
      }
      default ->
          throw new IllegalArgumentException(
              "Unknown API service \"" + service + "\" - expected \"jsonplaceholder\" or \"todo\"");
    }
  }

  private boolean healthy() {
    try {
      APIResponse response =
          ctx.api().get(baseUrl + "/health", RequestOptions.create().setTimeout(3_000));
      try {
        return response.ok();
      } finally {
        response.dispose();
      }
    } catch (PlaywrightException e) {
      return false;
    }
  }

  public void token(String token) {
    this.token = token;
  }

  public void store(String name, String value) {
    variables.put(name, value);
  }

  /** Replaces {@code ${name}} with scenario variables; unknown names are an error. */
  public String interpolate(String text) {
    Matcher matcher = VARIABLE.matcher(text);
    StringBuilder out = new StringBuilder();
    while (matcher.find()) {
      String name = matcher.group(1);
      String value = variables.get(name);
      if (value == null) {
        throw new IllegalStateException(
            "Unknown scenario variable \"${" + name + "}\" - store it first");
      }
      matcher.appendReplacement(out, Matcher.quoteReplacement(value));
    }
    matcher.appendTail(out);
    return out.toString();
  }

  /** Sends a request (path and body are interpolated) and attaches it to the report. */
  public Response send(String method, String path, String body) {
    String resolvedPath = interpolate(path);
    String resolvedBody = body == null ? null : interpolate(body);
    String url = baseUrl + resolvedPath;

    RequestOptions options = RequestOptions.create().setMethod(method);
    if (token != null) {
      options.setHeader("Authorization", "Bearer " + token);
    }
    if (resolvedBody != null) {
      options.setHeader("Content-Type", "application/json").setData(resolvedBody);
    }

    long started = System.nanoTime();
    APIResponse response = ctx.api().fetch(url, options);
    try {
      String text = response.text();
      long durationMs = (System.nanoTime() - started) / 1_000_000;
      last =
          new Response(
              method,
              url,
              response.status(),
              response.statusText(),
              Map.copyOf(response.headers()),
              text == null ? "" : text,
              durationMs);
    } finally {
      response.dispose();
    }
    attach(resolvedBody);
    return last;
  }

  public Response last() {
    if (last == null) {
      throw new IllegalStateException("No API request has been sent in this scenario yet");
    }
    return last;
  }

  private void attach(String requestBody) {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("method", last.method());
    request.put("url", last.url());
    request.put("authenticated", token != null);
    if (requestBody != null) {
      request.put("body", parseOrRaw(requestBody));
    }
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("status", last.status());
    response.put("statusText", last.statusText());
    response.put("durationMs", last.durationMs());
    response.put("headers", last.headers());
    response.put("body", parseOrRaw(last.text()));
    Map<String, Object> exchange = new LinkedHashMap<>();
    exchange.put("request", request);
    exchange.put("response", response);
    try {
      ctx.attachText(
          last.method() + " " + last.url() + " -> " + last.status(),
          "application/json",
          JSON.writeValueAsString(exchange));
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  // ------------------------------------------------------------------ JSON helpers

  /**
   * The shared rendering rule: a JSON string renders as its raw text, every other value as compact
   * JSON ({@code 1}, {@code 1.5}, {@code true}, {@code null}).
   */
  public static String render(JsonNode node) {
    return node.isTextual() ? node.asText() : node.toString();
  }

  /** Resolves a dot path ({@code address.geo.lat}, {@code 0.email}) or fails the step. */
  public static JsonNode resolve(JsonNode root, String path) {
    JsonNode current = root;
    for (String segment : path.split("\\.")) {
      JsonNode next = null;
      if (current != null && current.isArray() && segment.matches("\\d+")) {
        next = current.get(Integer.parseInt(segment));
      } else if (current != null && current.isObject()) {
        next = current.get(segment);
      }
      if (next == null || next.isMissingNode()) {
        throw new AssertionError(
            "Response has no field \"" + path + "\" (failed at \"" + segment + "\"):\n" + root);
      }
      current = next;
    }
    return current;
  }

  /** Returns {@code null} instead of failing when the path does not exist. */
  public static JsonNode resolveOrNull(JsonNode root, String path) {
    try {
      return resolve(root, path);
    } catch (AssertionError e) {
      return null;
    }
  }

  /** Validates against {@code features/schemas/<name>.schema.json} (draft-07). */
  public static List<String> schemaViolations(String name, JsonNode body) {
    Schema schema = SCHEMA_CACHE.computeIfAbsent(name, ApiSession::loadSchema);
    List<Error> errors = schema.validate(body);
    return errors.stream().map(Error::toString).toList();
  }

  private static Schema loadSchema(String name) {
    String resource = "schemas/" + name + ".schema.json";
    try (InputStream in = ApiSession.class.getClassLoader().getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalArgumentException(
            "Schema \"" + name + "\" not found - expected features/" + resource);
      }
      return SCHEMAS.getSchema(in);
    } catch (IOException e) {
      throw new IllegalStateException("Cannot read schema " + resource, e);
    }
  }

  private static Object parseOrRaw(String text) {
    if (text == null || text.isEmpty()) {
      return text;
    }
    try {
      return PARSER.readTree(text);
    } catch (JsonProcessingException e) {
      return text;
    }
  }
}
