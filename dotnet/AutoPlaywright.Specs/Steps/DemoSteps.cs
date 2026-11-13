using AutoPlaywright.Specs.Pages;
using AutoPlaywright.Specs.Support;
using Microsoft.Playwright;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class DemoSteps(ScenarioSession session, ReportAttachments attach)
{
    private PlaywrightSitePage Site => new(session.Page, session.Settings.DemoUrl);

    [Given("I open the Playwright website")]
    public Task GivenIOpenThePlaywrightWebsite() => Site.OpenAsync();

    [Then("the page title should contain {string}")]
    public Task ThenThePageTitleShouldContain(string text) => Site.ExpectTitleContainsAsync(text);

    [When("I click the {string} link")]
    public Task WhenIClickTheLink(string name) => Site.ClickLinkAsync(name);

    [Then("the URL should contain {string}")]
    public Task ThenTheUrlShouldContain(string fragment) => Site.ExpectUrlContainsAsync(fragment);

    [Then("I should see the heading {string}")]
    public Task ThenIShouldSeeTheHeading(string heading) => Site.ExpectHeadingAsync(heading);

    [When("I open the {string} installation guide")]
    public Task WhenIOpenTheInstallationGuide(string language) => Site.OpenInstallationGuideAsync(language);

    /// <summary>Generic step, usable from any @ui feature.</summary>
    [Then("I capture a screenshot named {string}")]
    public async Task ThenICaptureAScreenshotNamed(string name)
    {
        var path = Path.Combine(Paths.Screenshots, $"{Paths.SafeFileName(name)}-{Guid.NewGuid():N}.png");
        var png = await session.Page.ScreenshotAsync(new PageScreenshotOptions { Path = path, FullPage = true });
        attach.Png(name, png, path);
    }
}
