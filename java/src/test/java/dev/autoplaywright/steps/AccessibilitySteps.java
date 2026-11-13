package dev.autoplaywright.steps;

import com.deque.html.axecore.playwright.AxeBuilder;
import com.deque.html.axecore.results.AxeResults;
import com.deque.html.axecore.results.Rule;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import dev.autoplaywright.support.ScenarioContext;
import io.cucumber.java.en.Then;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.assertj.core.api.Assertions;

/** Steps for features/ui/accessibility.feature – axe-core WCAG 2.1 A/AA scan. */
public class AccessibilitySteps {

  private static final List<String> WCAG_TAGS = List.of("wcag2a", "wcag2aa", "wcag21a", "wcag21aa");
  private static final Set<String> BLOCKING_IMPACTS = Set.of("serious", "critical");
  private static final ObjectMapper JSON =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

  private final ScenarioContext ctx;

  public AccessibilitySteps(ScenarioContext ctx) {
    this.ctx = ctx;
  }

  @Then("the page should have no serious accessibility violations")
  public void thePageShouldHaveNoSeriousAccessibilityViolations() throws JsonProcessingException {
    AxeResults results = new AxeBuilder(ctx.page()).withTags(WCAG_TAGS).analyze();
    List<Rule> violations = results.getViolations();
    ctx.attachText(
        "Accessibility violations (" + violations.size() + ")",
        "application/json",
        JSON.writeValueAsString(violations));

    List<String> blocking =
        violations.stream()
            .filter(v -> v.getImpact() != null && BLOCKING_IMPACTS.contains(v.getImpact()))
            .map(v -> v.getId() + " [" + v.getImpact() + "]: " + v.getHelp())
            .collect(Collectors.toList());
    Assertions.assertThat(blocking)
        .as("serious/critical WCAG violations on %s", ctx.page().url())
        .isEmpty();
  }
}
