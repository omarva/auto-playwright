using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

/// <summary>Common base for page objects: owns the page and exposes web-first assertions.</summary>
public abstract class BasePage(IPage page)
{
    protected IPage Page { get; } = page;

    protected static ILocatorAssertions Expect(ILocator locator) => Assertions.Expect(locator);

    protected IPageAssertions ExpectPage() => Assertions.Expect(Page);
}
