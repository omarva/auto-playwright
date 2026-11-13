package dev.autoplaywright.support.report;

import io.cucumber.core.plugin.JsonFormatter;
import java.io.File;

/** Re-run-safe wrapper around Cucumber's built-in json formatter. */
public final class RerunSafeJsonFormatter extends RerunSafeFormatter {

  public RerunSafeJsonFormatter(File out) {
    super(out, JsonFormatter::new);
  }
}
