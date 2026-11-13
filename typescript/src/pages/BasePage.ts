import type { Locator, Page } from '@playwright/test';

/** Shared behaviour for every page object. */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  protected byTestId(id: string): Locator {
    return this.page.getByTestId(id);
  }
}
