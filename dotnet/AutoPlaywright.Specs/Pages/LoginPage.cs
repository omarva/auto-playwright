using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

public sealed partial class LoginPage(IPage page) : BasePage(page)
{
    private ILocator Username => Page.GetByTestId("username");

    private ILocator Password => Page.GetByTestId("password");

    private ILocator LoginButton => Page.GetByTestId("login-button");

    private ILocator Error => Page.GetByTestId("error");

    public async Task OpenAsync()
    {
        await Page.GotoAsync("/");
        await Expect(LoginButton).ToBeVisibleAsync();
    }

    public async Task LoginAsync(string username, string password)
    {
        await Username.FillAsync(username);
        await Password.FillAsync(password);
        await LoginButton.ClickAsync();
    }

    public Task ExpectErrorAsync(string message) => Expect(Error).ToHaveTextAsync(message);

    public async Task ExpectDisplayedAsync()
    {
        await ExpectPage().ToHaveURLAsync(RootUrl());
        await Expect(LoginButton).ToBeVisibleAsync();
    }

    [GeneratedRegex(@"^https?://[^/]+/?$")]
    private static partial Regex RootUrl();
}
