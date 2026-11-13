package dev.autoplaywright.support;

import java.util.regex.Pattern;

/**
 * Regex helpers for Playwright assertions.
 *
 * <p>Playwright evaluates {@link Pattern}s as JavaScript regular expressions inside the browser, so
 * {@link Pattern#quote(String)} (which emits Java-only {@code \Q...\E}) must not be used.
 */
public final class Patterns {

  private Patterns() {}

  /** Escapes every character that is special in a JavaScript regular expression. */
  public static String escape(String literal) {
    return literal.replaceAll("[.*+?^${}()|\\[\\]\\\\/-]", "\\\\$0");
  }

  /** Matches any string that contains {@code literal}. */
  public static Pattern containing(String literal) {
    return Pattern.compile(".*" + escape(literal) + ".*");
  }

  /** Matches any string that ends with {@code literal}. */
  public static Pattern endingWith(String literal) {
    return Pattern.compile(".*" + escape(literal) + "$");
  }
}
