package dev.autoplaywright.support.report;

import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/**
 * Wraps a built-in Cucumber formatter so that Maven Failsafe re-runs ({@code RETRIES}) don't
 * overwrite the first execution's output.
 *
 * <p>Failsafe re-runs failed scenarios in a new JUnit Platform execution inside the same JVM, which
 * re-creates every Cucumber plugin. The first execution writes to the configured path (e.g. {@code
 * cucumber.json}); re-run {@code n} writes next to it with a {@code .rerun-n} suffix (e.g. {@code
 * cucumber.rerun-1.json}). The masterthought report then merges them with {@code
 * mergeFeaturesWithRetest}, keeping the latest result of every scenario.
 */
abstract class RerunSafeFormatter implements ConcurrentEventListener {

  private static final Map<String, AtomicInteger> EXECUTIONS = new ConcurrentHashMap<>();

  private final ConcurrentEventListener delegate;

  RerunSafeFormatter(File configured, Function<OutputStream, ConcurrentEventListener> factory) {
    File target = targetFor(configured);
    try {
      File parent = target.getAbsoluteFile().getParentFile();
      if (parent != null) {
        Files.createDirectories(parent.toPath());
      }
      this.delegate = factory.apply(new FileOutputStream(target));
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot open report file " + target, e);
    }
  }

  static File targetFor(File configured) {
    String key = configured.getAbsolutePath();
    int execution = EXECUTIONS.computeIfAbsent(key, k -> new AtomicInteger()).getAndIncrement();
    if (execution == 0) {
      return configured;
    }
    String name = configured.getName();
    int dot = name.lastIndexOf('.');
    String renamed =
        dot < 0
            ? name + ".rerun-" + execution
            : name.substring(0, dot) + ".rerun-" + execution + name.substring(dot);
    return new File(configured.getAbsoluteFile().getParentFile(), renamed);
  }

  @Override
  public void setEventPublisher(EventPublisher publisher) {
    delegate.setEventPublisher(publisher);
  }
}
