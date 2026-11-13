import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world';

type Order = 'ascending' | 'descending';

function expectSorted<T extends string | number>(actual: T[], order: Order): void {
  const expected = [...actual].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (order === 'descending') expected.reverse();
  expect(actual, `values should be in ${order} order`).toEqual(expected);
}

// ---- Catalogue -------------------------------------------------------------

Then('I should see {int} products', async function (this: CustomWorld, count: number) {
  await expect(this.pages.inventory.items).toHaveCount(count);
});

When('I sort products by {string}', async function (this: CustomWorld, option: string) {
  await this.pages.inventory.sortBy(option);
});

Then(
  'the products should be sorted by {string} in {string} order',
  async function (this: CustomWorld, field: string, order: string) {
    if (order !== 'ascending' && order !== 'descending') throw new Error(`Unknown order "${order}"`);
    if (field === 'name') expectSorted(await this.pages.inventory.names(), order);
    else if (field === 'price') expectSorted(await this.pages.inventory.prices(), order);
    else throw new Error(`Unknown sort field "${field}"`);
  },
);

// ---- Cart ------------------------------------------------------------------

Given('I have added {string} to the cart', async function (this: CustomWorld, product: string) {
  await this.pages.inventory.addToCart(product);
});

When('I add {string} to the cart', async function (this: CustomWorld, product: string) {
  await this.pages.inventory.addToCart(product);
});

When('I add the following products to the cart:', async function (this: CustomWorld, table: DataTable) {
  for (const product of table.raw().flat()) {
    await this.pages.inventory.addToCart(product);
  }
});

When('I remove {string} from the cart', async function (this: CustomWorld, product: string) {
  await this.pages.inventory.removeFromCart(product);
});

When('I open the cart', async function (this: CustomWorld) {
  await this.pages.inventory.openCart();
});

Then('the cart badge should show {int}', async function (this: CustomWorld, count: number) {
  await expect(this.pages.inventory.cartBadge).toHaveText(String(count));
});

Then('the cart badge should not be visible', async function (this: CustomWorld) {
  await expect(this.pages.inventory.cartBadge).toBeHidden();
});

Then('the cart should contain:', async function (this: CustomWorld, table: DataTable) {
  const expected = table.raw().flat();
  await expect(this.pages.cart.itemNames).toHaveText(expected);
});

// ---- Checkout --------------------------------------------------------------

When('I proceed to checkout', async function (this: CustomWorld) {
  await this.pages.inventory.openCart();
  await this.pages.cart.checkout();
});

When(
  'I enter first name {string}, last name {string} and postal code {string}',
  async function (this: CustomWorld, firstName: string, lastName: string, postalCode: string) {
    await this.pages.checkout.fillDetails({ firstName, lastName, postalCode });
  },
);

When('I continue to the order overview', async function (this: CustomWorld) {
  await this.pages.checkout.continue();
});

When('I finish the checkout', async function (this: CustomWorld) {
  await this.pages.checkout.finish();
});

Then('the order item total should be {string}', async function (this: CustomWorld, total: string) {
  await expect(this.pages.checkout.itemTotal).toHaveText(`Item total: ${total}`);
});

Then('I should see the checkout error {string}', async function (this: CustomWorld, message: string) {
  await expect(this.pages.checkout.error).toHaveText(message);
});

Then('I should see the order confirmation {string}', async function (this: CustomWorld, message: string) {
  await expect(this.pages.checkout.completeHeader).toHaveText(message);
});
