package dev.autoplaywright.support.report;

import io.cucumber.core.plugin.HtmlFormatter;
import java.io.File;

/** Re-run-safe wrapper around Cucumber's built-in html formatter. */
public final class RerunSafeHtmlFormatter extends RerunSafeFormatter {

  public RerunSafeHtmlFormatter(File out) {
    super(out, HtmlFormatter::new);
  }
}
