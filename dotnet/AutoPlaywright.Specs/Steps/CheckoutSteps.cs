using AutoPlaywright.Specs.Pages;
using AutoPlaywright.Specs.Support;
using Reqnroll;

namespace AutoPlaywright.Specs.Steps;

[Binding]
public sealed class CheckoutSteps(ScenarioSession session)
{
    private CartPage Cart => new(session.Page);

    private InventoryPage Inventory => new(session.Page);

    private CheckoutPage Checkout => new(session.Page);

    [When("I proceed to checkout")]
    public async Task WhenIProceedToCheckout()
    {
        await Inventory.OpenCartAsync();
        await Cart.CheckoutAsync();
    }

    [When("I enter first name {string}, last name {string} and postal code {string}")]
    public Task WhenIEnterCustomerDetails(string firstName, string lastName, string postalCode) =>
        Checkout.FillCustomerAsync(firstName, lastName, postalCode);

    [When("I continue to the order overview")]
    public Task WhenIContinueToTheOrderOverview() => Checkout.ContinueAsync();

    [When("I finish the checkout")]
    public Task WhenIFinishTheCheckout() => Checkout.FinishAsync();

    [Then("the order item total should be {string}")]
    public Task ThenTheOrderItemTotalShouldBe(string amount) => Checkout.ExpectItemTotalAsync(amount);

    [Then("I should see the order confirmation {string}")]
    public Task ThenIShouldSeeTheOrderConfirmation(string message) => Checkout.ExpectConfirmationAsync(message);

    [Then("I should see the checkout error {string}")]
    public Task ThenIShouldSeeTheCheckoutError(string message) => Checkout.ExpectErrorAsync(message);
}
