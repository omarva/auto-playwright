import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class InventoryPage extends BasePage {
  readonly title: Locator = this.byTestId('title');
  readonly items: Locator = this.byTestId('inventory-item');
  readonly itemNames: Locator = this.byTestId('inventory-item-name');
  readonly itemPrices: Locator = this.byTestId('inventory-item-price');
  readonly sortSelect: Locator = this.byTestId('product-sort-container');
  readonly cartBadge: Locator = this.byTestId('shopping-cart-badge');
  readonly cartLink: Locator = this.byTestId('shopping-cart-link');
  readonly menuButton: Locator = this.page.getByRole('button', { name: 'Open Menu' });
  readonly logoutLink: Locator = this.byTestId('logout-sidebar-link');

  item(name: string): Locator {
    return this.items.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  async addToCart(name: string): Promise<void> {
    await this.item(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeFromCart(name: string): Promise<void> {
    await this.item(name).getByRole('button', { name: 'Remove' }).click();
  }

  async sortBy(label: string): Promise<void> {
    await this.sortSelect.selectOption({ label });
  }

  async names(): Promise<string[]> {
    return this.itemNames.allTextContents();
  }

  async prices(): Promise<number[]> {
    const texts = await this.itemPrices.allTextContents();
    return texts.map((t) => Number.parseFloat(t.replace('$', '')));
  }

  async logout(): Promise<void> {
    await this.menuButton.click();
    await this.logoutLink.click();
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
