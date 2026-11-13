using System.Text.Json;
using AutoPlaywright.Specs.Support;
using AwesomeAssertions;
using Deque.AxeCore.Commons;
using Deque.AxeCore.Playwright;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class AccessibilitySteps(ScenarioSession session, ReportAttachments attach)
{
    private static readonly string[] WcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
    private static readonly HashSet<string> BlockingImpacts = new(StringComparer.OrdinalIgnoreCase) { "serious", "critical" };
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };

    [Then("the page should have no serious accessibility violations")]
    public async Task ThenThePageShouldHaveNoSeriousAccessibilityViolations()
    {
        var result = await session.Page.RunAxe(new AxeRunOptions
        {
            RunOnly = new RunOnlyOptions { Type = "tag", Values = [.. WcagTags] },
        });

        var violations = result.Violations.Select(v => new
        {
            v.Id,
            v.Impact,
            v.Description,
            v.Help,
            v.HelpUrl,
            Nodes = v.Nodes.Select(n => n.Target?.ToString()).ToList(),
        }).ToList();

        attach.Json(
            $"axe-core violations ({violations.Count})",
            JsonSerializer.Serialize(new { url = result.Url, tags = WcagTags, violations }, Pretty));

        var blocking = violations.Where(v => v.Impact is not null && BlockingImpacts.Contains(v.Impact)).ToList();
        blocking.Should().BeEmpty(
            "serious/critical WCAG violations were found: {0}",
            string.Join("; ", blocking.Select(v => $"{v.Id} ({v.Impact}): {v.Help}")));
    }
}
