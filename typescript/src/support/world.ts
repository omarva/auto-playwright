import { World, setWorldConstructor, type IWorldOptions } from '@cucumber/cucumber';
import type { APIRequestContext, APIResponse, Browser, BrowserContext, Page } from '@playwright/test';
import { request } from '@playwright/test';
import { config } from './config';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { InventoryPage } from '../pages/InventoryPage';
import { LoginPage } from '../pages/LoginPage';
import { PlaywrightSitePage } from '../pages/PlaywrightSitePage';

/** Lazily-built page objects bound to the scenario's page. */
export interface Pages {
  login: LoginPage;
  inventory: InventoryPage;
  cart: CartPage;
  checkout: CheckoutPage;
  playwrightSite: PlaywrightSitePage;
}

/**
 * Per-scenario state. A browser context/page is only created when a step first
 * touches `this.page`, so `@api` scenarios never pay for a browser.
 */
export class CustomWorld extends World {
  /** Set by hooks: a function returning the worker's shared browser. */
  browserProvider?: () => Promise<Browser>;
  context?: BrowserContext;
  scenarioName = 'scenario';
  lastResponse?: APIResponse;
  lastResponseBody?: unknown;

  private _page?: Page;
  private _pages?: Pages;
  private _api?: APIRequestContext;

  constructor(options: IWorldOptions) {
    super(options);
  }

  get hasPage(): boolean {
    return this._page !== undefined;
  }

  get page(): Page {
    if (!this._page) {
      throw new Error('No page yet - call `await this.openPage()` first (done automatically for @ui scenarios).');
    }
    return this._page;
  }

  async openPage(): Promise<Page> {
    if (this._page) return this._page;
    if (!this.browserProvider) throw new Error('Browser provider was not initialised by hooks');
    const browser = await this.browserProvider();
    this.context = await browser.newContext({
      viewport: config.viewport,
      ignoreHTTPSErrors: true,
      recordVideo: config.video === 'off' ? undefined : { dir: config.dirs.videos, size: config.viewport },
    });
    this.context.setDefaultTimeout(config.timeout);
    this.context.setDefaultNavigationTimeout(config.navigationTimeout);
    if (config.trace !== 'off') {
      await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true, title: this.scenarioName });
    }
    this._page = await this.context.newPage();
    return this._page;
  }

  get pages(): Pages {
    this._pages ??= {
      login: new LoginPage(this.page),
      inventory: new InventoryPage(this.page),
      cart: new CartPage(this.page),
      checkout: new CheckoutPage(this.page),
      playwrightSite: new PlaywrightSitePage(this.page),
    };
    return this._pages;
  }

  async api(): Promise<APIRequestContext> {
    this._api ??= await request.newContext({
      baseURL: config.apiBaseUrl,
      timeout: config.navigationTimeout,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    return this._api;
  }

  async attachJson(name: string, data: unknown): Promise<void> {
    await Promise.resolve(
      this.attach(JSON.stringify(data, null, 2), { mediaType: 'application/json', fileName: `${name}.json` }),
    );
  }

  async attachScreenshot(name: string): Promise<void> {
    const image = await this.page.screenshot({ fullPage: true });
    this.attach(image, { mediaType: 'image/png', fileName: `${name}.png` });
  }

  async dispose(): Promise<void> {
    await this._api?.dispose();
    await this.context?.close();
  }
}

setWorldConstructor(CustomWorld);
