import type { Locator } from '@playwright/test';
import { config } from '../support/config';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly username: Locator = this.byTestId('username');
  readonly password: Locator = this.byTestId('password');
  readonly loginButton: Locator = this.byTestId('login-button');
  readonly error: Locator = this.byTestId('error');

  async open(): Promise<void> {
    await this.goto(config.baseUrl);
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }
}
