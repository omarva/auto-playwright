package dev.autoplaywright.support.report;

import io.cucumber.core.plugin.MessageFormatter;
import java.io.File;

/** Re-run-safe wrapper around Cucumber's built-in message (ndjson) formatter. */
public final class RerunSafeMessageFormatter extends RerunSafeFormatter {

  public RerunSafeMessageFormatter(File out) {
    super(out, MessageFormatter::new);
  }
}
