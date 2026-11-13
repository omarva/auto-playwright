using System.Text.RegularExpressions;
using Microsoft.Playwright;

namespace AutoPlaywright.Specs.Pages;

public sealed class CheckoutPage(IPage page) : BasePage(page)
{
    private ILocator FirstName => Page.GetByTestId("firstName");

    private ILocator LastName => Page.GetByTestId("lastName");

    private ILocator PostalCode => Page.GetByTestId("postalCode");

    private ILocator ContinueButton => Page.GetByTestId("continue");

    private ILocator FinishButton => Page.GetByTestId("finish");

    private ILocator Error => Page.GetByTestId("error");

    private ILocator ItemTotal => Page.GetByTestId("subtotal-label");

    private ILocator CompleteHeader => Page.GetByTestId("complete-header");

    public async Task FillCustomerAsync(string firstName, string lastName, string postalCode)
    {
        await FirstName.FillAsync(firstName);
        await LastName.FillAsync(lastName);
        await PostalCode.FillAsync(postalCode);
    }

    public Task ContinueAsync() => ContinueButton.ClickAsync();

    public Task FinishAsync() => FinishButton.ClickAsync();

    public Task ExpectErrorAsync(string message) => Expect(Error).ToHaveTextAsync(message);

    /// <summary>The label reads "Item total: $29.99"; the expected amount must end the label.</summary>
    public Task ExpectItemTotalAsync(string amount) =>
        Expect(ItemTotal).ToHaveTextAsync(new Regex(Regex.Escape(amount) + "$"));

    public Task ExpectConfirmationAsync(string message) => Expect(CompleteHeader).ToHaveTextAsync(message);
}
