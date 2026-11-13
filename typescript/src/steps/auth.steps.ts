import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { config } from '../support/config';
import type { CustomWorld } from '../support/world';

Given('I am on the login page', async function (this: CustomWorld) {
  await this.pages.login.open();
});

Given('I am logged in as {string}', async function (this: CustomWorld, username: string) {
  await this.pages.login.open();
  await this.pages.login.login(username, config.userPassword);
  await expect(this.page).toHaveURL(/inventory\.html/);
});

When('I log in as {string}', async function (this: CustomWorld, username: string) {
  await this.pages.login.login(username, config.userPassword);
});

When(
  'I log in with username {string} and password {string}',
  async function (this: CustomWorld, username: string, password: string) {
    await this.pages.login.login(username, password);
  },
);

When('I log out', async function (this: CustomWorld) {
  await this.pages.inventory.logout();
});

Then('I should see the products page', async function (this: CustomWorld) {
  await expect(this.page).toHaveURL(/inventory\.html/);
  await expect(this.pages.inventory.items.first()).toBeVisible();
});

Then('the header title should be {string}', async function (this: CustomWorld, title: string) {
  await expect(this.pages.inventory.title).toHaveText(title);
});

Then('I should see the login error {string}', async function (this: CustomWorld, message: string) {
  await expect(this.pages.login.error).toHaveText(message);
});

Then('I should be on the login page', async function (this: CustomWorld) {
  await expect(this.pages.login.loginButton).toBeVisible();
  await expect(this.page).toHaveURL(new URL('/', config.baseUrl).toString());
});
