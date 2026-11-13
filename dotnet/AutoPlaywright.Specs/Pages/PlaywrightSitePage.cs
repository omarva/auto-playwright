using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

/// <summary>Page object for the demo feature that tours playwright.dev.</summary>
public sealed class PlaywrightSitePage(IPage page, string siteUrl) : BasePage(page)
{
    private static readonly Dictionary<string, string> InstallationGuides = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Node.js"] = "/docs/intro",
        ["Python"] = "/python/docs/intro",
        ["Java"] = "/java/docs/intro",
        [".NET"] = "/dotnet/docs/intro",
    };

    public Task OpenAsync() => Page.GotoAsync(siteUrl);

    public Task ExpectTitleContainsAsync(string text) =>
        ExpectPage().ToHaveTitleAsync(new Regex(Regex.Escape(text)));

    public Task ClickLinkAsync(string name) =>
        Page.GetByRole(AriaRole.Link, new() { Name = name, Exact = true }).First.ClickAsync();

    public Task ExpectUrlContainsAsync(string fragment) =>
        ExpectPage().ToHaveURLAsync(new Regex(Regex.Escape(fragment)));

    public Task ExpectHeadingAsync(string heading) =>
        Expect(Page.GetByRole(AriaRole.Heading, new() { Name = heading, Exact = true }).First).ToBeVisibleAsync();

    public Task OpenInstallationGuideAsync(string language)
    {
        if (!InstallationGuides.TryGetValue(language, out var path))
        {
            var known = string.Join(", ", InstallationGuides.Keys);
            throw new ArgumentException($"Unknown language '{language}'. Known: {known}", nameof(language));
        }

        return Page.GotoAsync(siteUrl + path);
    }
}
