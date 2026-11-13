import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export class CheckoutPage extends BasePage {
  readonly firstName: Locator = this.byTestId('firstName');
  readonly lastName: Locator = this.byTestId('lastName');
  readonly postalCode: Locator = this.byTestId('postalCode');
  readonly continueButton: Locator = this.byTestId('continue');
  readonly finishButton: Locator = this.byTestId('finish');
  readonly error: Locator = this.byTestId('error');
  readonly itemTotal: Locator = this.byTestId('subtotal-label');
  readonly completeHeader: Locator = this.byTestId('complete-header');

  async fillDetails({ firstName, lastName, postalCode }: CustomerDetails): Promise<void> {
    await this.firstName.fill(firstName);
    await this.lastName.fill(lastName);
    await this.postalCode.fill(postalCode);
  }

  async continue(): Promise<void> {
    await this.continueButton.click();
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }
}
