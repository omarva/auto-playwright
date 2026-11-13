package dev.autoplaywright.support;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import dev.autoplaywright.config.Config;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Owns one {@link Playwright} driver and (lazily) one {@link Browser} per worker thread.
 *
 * <p>Playwright for Java is not thread-safe, so every Cucumber worker thread gets its own instances
 * via {@link ThreadLocal}. Browsers are only launched when a scenario actually asks for a page, so
 * {@code @api} scenarios never start one.
 */
public final class BrowserManager {

  private static final Logger LOG = LoggerFactory.getLogger(BrowserManager.class);

  private static final ThreadLocal<Playwright> PLAYWRIGHT = new ThreadLocal<>();
  private static final ThreadLocal<Browser> BROWSER = new ThreadLocal<>();
  private static final Queue<AutoCloseable> OPENED = new ConcurrentLinkedQueue<>();
  private static volatile String browserVersion = "not launched";

  private BrowserManager() {}

  public static Playwright playwright() {
    Playwright playwright = PLAYWRIGHT.get();
    if (playwright == null) {
      playwright = Playwright.create();
      playwright.selectors().setTestIdAttribute("data-test");
      PLAYWRIGHT.set(playwright);
      OPENED.add(playwright);
    }
    return playwright;
  }

  public static Browser browser() {
    Browser browser = BROWSER.get();
    if (browser == null || !browser.isConnected()) {
      browser = launch(playwright());
      browserVersion = browser.version();
      BROWSER.set(browser);
    }
    return browser;
  }

  private static Browser launch(Playwright playwright) {
    String name = Config.browser();
    BrowserType type =
        switch (name) {
          case "chromium" -> playwright.chromium();
          case "firefox" -> playwright.firefox();
          case "webkit" -> playwright.webkit();
          default ->
              throw new IllegalArgumentException(
                  "Unsupported BROWSER '" + name + "'. Use chromium, firefox or webkit.");
        };
    BrowserType.LaunchOptions options =
        new BrowserType.LaunchOptions().setHeadless(Config.headless()).setSlowMo(Config.slowMo());
    Config.browserChannel().ifPresent(options::setChannel);
    LOG.info(
        "Launching {} (headless={}, channel={})",
        name,
        Config.headless(),
        Config.browserChannel().orElse("default"));
    return type.launch(options);
  }

  /** Version of the browser launched during this run (or "not launched" for API-only runs). */
  public static String browserVersion() {
    return browserVersion;
  }

  /** Closes every driver opened by any thread. Called once after all scenarios. */
  public static void closeAll() {
    AutoCloseable closeable;
    while ((closeable = OPENED.poll()) != null) {
      try {
        closeable.close();
      } catch (Exception e) {
        LOG.debug("Ignoring error while closing Playwright", e);
      }
    }
  }
}
