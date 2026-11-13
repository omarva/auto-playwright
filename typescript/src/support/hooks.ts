import fs from 'node:fs';
import path from 'node:path';
import { After, AfterAll, Before, BeforeAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium, expect, firefox, selectors, webkit, type Browser } from '@playwright/test';
import { config } from './config';
import type { CustomWorld } from './world';

// Cucumber's own step timeout must exceed Playwright's so Playwright errors (with
// helpful messages) surface first.
setDefaultTimeout(config.navigationTimeout + config.timeout);
expect.configure({ timeout: config.timeout });

const launchers = { chromium, firefox, webkit } as const;
let browserPromise: Promise<Browser> | undefined;

/** One browser per worker process, started on first use. */
function sharedBrowser(): Promise<Browser> {
  browserPromise ??= launchers[config.browser].launch({
    headless: config.headless,
    slowMo: config.slowMo,
    channel: config.browser === 'chromium' ? config.channel : undefined,
  });
  return browserPromise;
}

function safeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

BeforeAll(function () {
  selectors.setTestIdAttribute(config.testIdAttribute);
  for (const dir of Object.values(config.dirs)) fs.mkdirSync(dir, { recursive: true });
});

Before(async function (this: CustomWorld, { pickle }) {
  this.scenarioName = pickle.name;
  this.browserProvider = sharedBrowser;
  if (pickle.tags.some((tag) => tag.name === '@ui')) {
    await this.openPage();
  }
});

After(async function (this: CustomWorld, { pickle, result, testCaseStartedId }) {
  const failed = result?.status === Status.FAILED;
  const base = `${safeFileName(pickle.name)}-${testCaseStartedId.slice(0, 8)}`;

  try {
    if (this.hasPage) {
      if (config.screenshot === 'on' || (failed && config.screenshot !== 'off')) {
        const file = path.join(config.dirs.screenshots, `${base}.png`);
        const image = await this.page.screenshot({ path: file, fullPage: true });
        this.attach(image, { mediaType: 'image/png', fileName: 'failure-screenshot.png' });
      }

      if (config.trace !== 'off' && this.context) {
        const keep = config.trace === 'on' || failed;
        const tracePath = keep ? path.join(config.dirs.traces, `${base}.zip`) : undefined;
        await this.context.tracing.stop(tracePath ? { path: tracePath } : undefined);
        if (tracePath) {
          this.attach(
            `Trace saved to ${path.relative(process.cwd(), tracePath)}\nOpen it with: npx playwright show-trace "${tracePath}"`,
            { mediaType: 'text/plain', fileName: 'trace.txt' },
          );
        }
      }

      const video = this.page.video();
      await this.context?.close();
      if (video) {
        const videoPath = await video.path();
        const keepVideo = config.video === 'on' || (config.video === 'retain-on-failure' && failed);
        if (keepVideo) {
          this.attach(fs.readFileSync(videoPath), { mediaType: 'video/webm', fileName: 'recording.webm' });
        } else {
          fs.rmSync(videoPath, { force: true });
        }
      }
    }
  } finally {
    await this.dispose();
  }
});

AfterAll(async function () {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
});
