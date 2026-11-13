package dev.autoplaywright.config;

import io.github.cdimascio.dotenv.Dotenv;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;

/**
 * Central, immutable test configuration.
 *
 * <p>Resolution order for every key: JVM system property &rarr; environment variable &rarr; {@code
 * .env} file in the java/ folder &rarr; built-in default. Keys and defaults are defined in {@code
 * docs/CONVENTIONS.md} and are identical across all language implementations.
 */
public final class Config {

  private static final Dotenv DOTENV =
      Dotenv.configure().ignoreIfMissing().ignoreIfMalformed().load();

  private Config() {}

  /** How an artifact (trace, video, screenshot) should be retained. */
  public enum Mode {
    ON,
    OFF,
    RETAIN_ON_FAILURE,
    ONLY_ON_FAILURE;

    static Mode parse(String raw) {
      return Mode.valueOf(raw.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
    }

    /** Whether to keep the artifact for a scenario with the given outcome. */
    public boolean keep(boolean failed) {
      return this == ON || (failed && (this == RETAIN_ON_FAILURE || this == ONLY_ON_FAILURE));
    }

    public boolean enabled() {
      return this != OFF;
    }
  }

  public static String browser() {
    return get("BROWSER", "chromium").toLowerCase(Locale.ROOT);
  }

  public static Optional<String> browserChannel() {
    return Optional.of(get("BROWSER_CHANNEL", "")).filter(s -> !s.isBlank());
  }

  public static boolean headless() {
    return Boolean.parseBoolean(get("HEADLESS", "true"));
  }

  public static double slowMo() {
    return Double.parseDouble(get("SLOW_MO", "0"));
  }

  public static double timeout() {
    return Double.parseDouble(get("TIMEOUT", "15000"));
  }

  public static double navigationTimeout() {
    return Double.parseDouble(get("NAV_TIMEOUT", "30000"));
  }

  public static String baseUrl() {
    return stripTrailingSlash(get("BASE_URL", "https://www.saucedemo.com"));
  }

  public static String apiBaseUrl() {
    return stripTrailingSlash(get("API_BASE_URL", "https://jsonplaceholder.typicode.com"));
  }

  public static String demoUrl() {
    return stripTrailingSlash(get("DEMO_URL", "https://playwright.dev"));
  }

  public static String userPassword() {
    return get("USER_PASSWORD", "secret_sauce");
  }

  public static Mode trace() {
    return Mode.parse(get("TRACE", "retain-on-failure"));
  }

  public static Mode video() {
    return Mode.parse(get("VIDEO", "off"));
  }

  public static Mode screenshot() {
    return Mode.parse(get("SCREENSHOT", "only-on-failure"));
  }

  public static Path reportsDir() {
    return Path.of(get("reports.dir", "reports")).toAbsolutePath();
  }

  public static Path artifactsDir() {
    return reportsDir().resolve("artifacts");
  }

  static String get(String key, String defaultValue) {
    String value = System.getProperty(key);
    if (isBlank(value)) {
      value = System.getenv(key);
    }
    if (isBlank(value)) {
      value = DOTENV.get(key, null);
    }
    return isBlank(value) ? defaultValue : value.trim();
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private static String stripTrailingSlash(String url) {
    return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
  }
}
