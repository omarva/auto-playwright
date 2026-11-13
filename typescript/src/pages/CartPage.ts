import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly itemNames: Locator = this.byTestId('inventory-item-name');
  readonly checkoutButton: Locator = this.byTestId('checkout');

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
