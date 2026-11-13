package dev.autoplaywright.support.report;

import io.cucumber.core.plugin.JUnitFormatter;
import java.io.File;

/** Re-run-safe wrapper around Cucumber's built-in junit XML formatter. */
public final class RerunSafeJUnitFormatter extends RerunSafeFormatter {

  public RerunSafeJUnitFormatter(File out) {
    super(out, JUnitFormatter::new);
  }
}
