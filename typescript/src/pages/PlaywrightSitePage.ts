import type { Locator } from '@playwright/test';
import { config } from '../support/config';
import { BasePage } from './BasePage';

/** Maps the language names used in the demo feature to playwright.dev doc paths. */
export const DOCS_PATHS: Readonly<Record<string, string>> = {
  'Node.js': '/docs/intro',
  Python: '/python/docs/intro',
  Java: '/java/docs/intro',
  '.NET': '/dotnet/docs/intro',
};

export class PlaywrightSitePage extends BasePage {
  async open(): Promise<void> {
    await this.goto(config.demoUrl);
  }

  async openInstallationGuide(language: string): Promise<void> {
    const docsPath = DOCS_PATHS[language];
    if (!docsPath) {
      throw new Error(`Unknown language "${language}". Expected one of: ${Object.keys(DOCS_PATHS).join(', ')}`);
    }
    await this.goto(new URL(docsPath, config.demoUrl).toString());
  }

  async clickLink(name: string): Promise<void> {
    await this.page.getByRole('link', { name, exact: true }).first().click();
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true, level: 1 });
  }
}
