using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

public sealed partial class InventoryPage(IPage page) : BasePage(page)
{
    private ILocator Title => Page.GetByTestId("title");

    private ILocator Items => Page.GetByTestId("inventory-item");

    private ILocator ItemNames => Page.GetByTestId("inventory-item-name");

    private ILocator ItemPrices => Page.GetByTestId("inventory-item-price");

    private ILocator SortSelect => Page.GetByTestId("product-sort-container");

    private ILocator CartBadge => Page.GetByTestId("shopping-cart-badge");

    private ILocator CartLink => Page.GetByTestId("shopping-cart-link");

    private ILocator MenuButton => Page.GetByRole(AriaRole.Button, new() { Name = "Open Menu" });

    private ILocator LogoutLink => Page.GetByTestId("logout-sidebar-link");

    public async Task ExpectDisplayedAsync()
    {
        await ExpectPage().ToHaveURLAsync(InventoryUrl());
        await Expect(Items.First).ToBeVisibleAsync();
    }

    public Task ExpectTitleAsync(string title) => Expect(Title).ToHaveTextAsync(title);

    public Task ExpectProductCountAsync(int count) => Expect(Items).ToHaveCountAsync(count);

    public Task SortByAsync(string option) => SortSelect.SelectOptionAsync(new SelectOptionValue { Label = option });

    public Task<IReadOnlyList<string>> ProductNamesAsync() => ItemNames.AllInnerTextsAsync();

    public async Task<IReadOnlyList<decimal>> ProductPricesAsync()
    {
        var texts = await ItemPrices.AllInnerTextsAsync();
        return [.. texts.Select(t => decimal.Parse(t.Trim().TrimStart('$'), CultureInfo.InvariantCulture))];
    }

    public async Task AddToCartAsync(string product)
    {
        await ItemCard(product).GetByRole(AriaRole.Button, new() { Name = "Add to cart" }).ClickAsync();
        await Expect(ItemCard(product).GetByRole(AriaRole.Button, new() { Name = "Remove" })).ToBeVisibleAsync();
    }

    public async Task RemoveFromCartAsync(string product)
    {
        await ItemCard(product).GetByRole(AriaRole.Button, new() { Name = "Remove" }).ClickAsync();
        await Expect(ItemCard(product).GetByRole(AriaRole.Button, new() { Name = "Add to cart" })).ToBeVisibleAsync();
    }

    public Task ExpectCartBadgeAsync(int count) =>
        Expect(CartBadge).ToHaveTextAsync(count.ToString(CultureInfo.InvariantCulture));

    public Task ExpectCartBadgeHiddenAsync() => Expect(CartBadge).ToBeHiddenAsync();

    public Task OpenCartAsync() => CartLink.ClickAsync();

    public async Task LogoutAsync()
    {
        await MenuButton.ClickAsync();
        await LogoutLink.ClickAsync();
    }

    private ILocator ItemCard(string product) =>
        Items.Filter(new() { Has = Page.GetByTestId("inventory-item-name").GetByText(product, new() { Exact = true }) });

    [GeneratedRegex(@"/inventory\.html$")]
    private static partial Regex InventoryUrl();
}
