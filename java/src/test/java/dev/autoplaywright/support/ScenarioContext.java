package dev.autoplaywright.support;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Tracing;
import com.microsoft.playwright.options.ScreenshotType;
import dev.autoplaywright.config.Config;
import io.cucumber.java.Scenario;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;

/**
 * Per-scenario state, injected into hooks and step classes by PicoContainer.
 *
 * <p>A fresh instance is created for every scenario, which gives each scenario its own isolated
 * {@link BrowserContext}, {@link Page} and {@link APIRequestContext}. Both are created lazily.
 */
public class ScenarioContext {

  private Scenario scenario;
  private BrowserContext browserContext;
  private Page page;
  private APIRequestContext api;
  private ApiResult lastResponse;

  /** The outcome of the last HTTP call made by an API step. */
  public record ApiResult(int status, Map<String, String> headers, String body) {}

  void start(Scenario scenario) {
    this.scenario = scenario;
  }

  public Scenario scenario() {
    return scenario;
  }

  public boolean hasPage() {
    return page != null;
  }

  public Page page() {
    if (page == null) {
      Browser browser = BrowserManager.browser();
      Browser.NewContextOptions options =
          new Browser.NewContextOptions()
              .setBaseURL(Config.baseUrl())
              .setViewportSize(1280, 720)
              .setLocale("en-US");
      if (Config.video().enabled()) {
        options.setRecordVideoDir(Config.artifactsDir().resolve("videos").resolve("raw"));
        options.setRecordVideoSize(1280, 720);
      }
      browserContext = browser.newContext(options);
      browserContext.setDefaultTimeout(Config.timeout());
      browserContext.setDefaultNavigationTimeout(Config.navigationTimeout());
      if (Config.trace().enabled()) {
        browserContext
            .tracing()
            .start(
                new Tracing.StartOptions()
                    .setScreenshots(true)
                    .setSnapshots(true)
                    .setSources(true)
                    .setTitle(scenario.getName()));
      }
      page = browserContext.newPage();
    }
    return page;
  }

  BrowserContext browserContext() {
    return browserContext;
  }

  public APIRequestContext api() {
    if (api == null) {
      api =
          BrowserManager.playwright()
              .request()
              .newContext(
                  new APIRequest.NewContextOptions()
                      .setBaseURL(Config.apiBaseUrl())
                      .setTimeout(Config.navigationTimeout())
                      .setExtraHTTPHeaders(Map.of("Accept", "application/json")));
    }
    return api;
  }

  boolean hasApi() {
    return api != null;
  }

  public ApiResult lastResponse() {
    if (lastResponse == null) {
      throw new IllegalStateException("No API request has been sent in this scenario yet");
    }
    return lastResponse;
  }

  public void lastResponse(ApiResult result) {
    this.lastResponse = result;
  }

  /** Attaches a PNG screenshot of the current page to every report. */
  public void attachScreenshot(String name) {
    byte[] png =
        page()
            .screenshot(new Page.ScreenshotOptions().setFullPage(true).setType(ScreenshotType.PNG));
    scenario.attach(png, "image/png", name);
  }

  public void attachText(String name, String mediaType, String content) {
    scenario.attach(content.getBytes(StandardCharsets.UTF_8), mediaType, name);
  }

  /** A filesystem-safe, unique-per-scenario file name stem. */
  public String artifactName() {
    String base = scenario.getName().replaceAll("[^A-Za-z0-9]+", "-").replaceAll("(^-|-$)", "");
    return base + "-L" + scenario.getLine() + "-" + Config.browser();
  }

  Path artifactPath(String folder, String extension) {
    return Config.artifactsDir().resolve(folder).resolve(artifactName() + extension);
  }

  void clear() {
    page = null;
    browserContext = null;
    api = null;
  }
}
