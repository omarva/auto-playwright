using AutoPlaywright.Specs.Pages;
using AutoPlaywright.Specs.Support;
using AwesomeAssertions;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class CatalogueSteps(ScenarioSession session)
{
    private InventoryPage Inventory => new(session.Page);

    [Then("I should see {int} products")]
    public Task ThenIShouldSeeProducts(int count) => Inventory.ExpectProductCountAsync(count);

    [When("I sort products by {string}")]
    public Task WhenISortProductsBy(string option) => Inventory.SortByAsync(option);

    [Then("the products should be sorted by {string} in {string} order")]
    public async Task ThenTheProductsShouldBeSorted(string field, string order)
    {
        var descending = order switch
        {
            "ascending" => false,
            "descending" => true,
            _ => throw new ArgumentException($"Unknown sort order '{order}'", nameof(order)),
        };

        switch (field)
        {
            case "name":
                var names = await Inventory.ProductNamesAsync();
                var expectedNames = descending
                    ? names.OrderDescending(StringComparer.Ordinal)
                    : names.Order(StringComparer.Ordinal);
                names.Should().Equal(expectedNames, $"product names should be in {order} order");
                break;
            case "price":
                var prices = await Inventory.ProductPricesAsync();
                var expectedPrices = descending ? prices.OrderDescending() : prices.Order();
                prices.Should().Equal(expectedPrices, $"product prices should be in {order} order");
                break;
            default:
                throw new ArgumentException($"Unknown sort field '{field}'", nameof(field));
        }
    }
}
