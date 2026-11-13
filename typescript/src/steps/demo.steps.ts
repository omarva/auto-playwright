import { Given, Then, When } from '@cucumber/cucumber';
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { CustomWorld } from '../support/world';

// ---- playwright.dev demo ---------------------------------------------------

Given('I open the Playwright website', async function (this: CustomWorld) {
  await this.pages.playwrightSite.open();
});

When('I click the {string} link', async function (this: CustomWorld, name: string) {
  await this.pages.playwrightSite.clickLink(name);
});

When('I open the {string} installation guide', async function (this: CustomWorld, language: string) {
  await this.pages.playwrightSite.openInstallationGuide(language);
});

Then('the page title should contain {string}', async function (this: CustomWorld, text: string) {
  await expect(this.page).toHaveTitle(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

Then('the URL should contain {string}', async function (this: CustomWorld, fragment: string) {
  await expect.poll(() => this.page.url()).toContain(fragment);
});

Then('I should see the heading {string}', async function (this: CustomWorld, name: string) {
  await expect(this.pages.playwrightSite.heading(name)).toBeVisible();
});

Then('I capture a screenshot named {string}', async function (this: CustomWorld, name: string) {
  await this.attachScreenshot(name);
});

// ---- Accessibility ---------------------------------------------------------

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

Then('the page should have no serious accessibility violations', async function (this: CustomWorld) {
  const results = await new AxeBuilder({ page: this.page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await this.attachJson('axe-violations', results.violations);
  const blocking = results.violations
    .filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''))
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element(s)) - ${v.helpUrl}`);
  expect(blocking, `Accessibility violations:\n${blocking.join('\n')}`).toEqual([]);
});
