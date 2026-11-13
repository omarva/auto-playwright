using AutoPlaywright.Specs.Pages;
using AutoPlaywright.Specs.Support;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class CartSteps(ScenarioSession session)
{
    private InventoryPage Inventory => new(session.Page);

    private CartPage Cart => new(session.Page);

    [Given("I have added {string} to the cart")]
    [When("I add {string} to the cart")]
    public Task AddToCart(string product) => Inventory.AddToCartAsync(product);

    [When("I add the following products to the cart:")]
    public async Task WhenIAddTheFollowingProducts(DataTable products)
    {
        foreach (var product in SingleColumn(products))
        {
            await Inventory.AddToCartAsync(product);
        }
    }

    [When("I remove {string} from the cart")]
    public Task WhenIRemoveFromTheCart(string product) => Inventory.RemoveFromCartAsync(product);

    [When("I open the cart")]
    public Task WhenIOpenTheCart() => Inventory.OpenCartAsync();

    [Then("the cart badge should show {int}")]
    public Task ThenTheCartBadgeShouldShow(int count) => Inventory.ExpectCartBadgeAsync(count);

    [Then("the cart badge should not be visible")]
    public Task ThenTheCartBadgeShouldNotBeVisible() => Inventory.ExpectCartBadgeHiddenAsync();

    [Then("the cart should contain:")]
    public Task ThenTheCartShouldContain(DataTable products) => Cart.ExpectProductsAsync(SingleColumn(products));

    /// <summary>
    /// The features use header-less, single-column tables. Reqnroll treats the first row as a
    /// header, so it is folded back into the list of values.
    /// </summary>
    private static List<string> SingleColumn(DataTable table) =>
        [table.Header.Single(), .. table.Rows.Select(row => row[0])];
}
