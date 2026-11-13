using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

public sealed partial class CartPage(IPage page) : BasePage(page)
{
    private ILocator ItemNames => Page.GetByTestId("inventory-item-name");

    private ILocator CheckoutButton => Page.GetByTestId("checkout");

    public async Task ExpectProductsAsync(IEnumerable<string> products)
    {
        await ExpectPage().ToHaveURLAsync(CartUrl());
        await Expect(ItemNames).ToHaveTextAsync([.. products]);
    }

    public Task CheckoutAsync() => CheckoutButton.ClickAsync();

    [GeneratedRegex(@"/cart\.html$")]
    private static partial Regex CartUrl();
}
