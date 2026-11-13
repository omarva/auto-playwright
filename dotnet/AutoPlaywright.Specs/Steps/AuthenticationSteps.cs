using AutoPlaywright.Specs.Pages;
using AutoPlaywright.Specs.Support;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class AuthenticationSteps(ScenarioSession session)
{
    private LoginPage Login => new(session.Page);

    private InventoryPage Inventory => new(session.Page);

    [Given("I am on the login page")]
    public Task GivenIAmOnTheLoginPage() => Login.OpenAsync();

    [Given("I am logged in as {string}")]
    public async Task GivenIAmLoggedInAs(string username)
    {
        await Login.OpenAsync();
        await Login.LoginAsync(username, session.Settings.UserPassword);
        await Inventory.ExpectDisplayedAsync();
    }

    [When("I log in as {string}")]
    public Task WhenILogInAs(string username) => Login.LoginAsync(username, session.Settings.UserPassword);

    [When("I log in with username {string} and password {string}")]
    public Task WhenILogInWith(string username, string password) => Login.LoginAsync(username, password);

    [When("I log out")]
    public Task WhenILogOut() => Inventory.LogoutAsync();

    [Then("I should see the products page")]
    public Task ThenIShouldSeeTheProductsPage() => Inventory.ExpectDisplayedAsync();

    [Then("the header title should be {string}")]
    public Task ThenTheHeaderTitleShouldBe(string title) => Inventory.ExpectTitleAsync(title);

    [Then("I should see the login error {string}")]
    public Task ThenIShouldSeeTheLoginError(string message) => Login.ExpectErrorAsync(message);

    [Then("I should be on the login page")]
    public Task ThenIShouldBeOnTheLoginPage() => Login.ExpectDisplayedAsync();
}
