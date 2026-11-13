/**
 * Builds the "pretty" native HTML report (reports/html/index.html) from the
 * cucumber JSON output using multiple-cucumber-html-reporter.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generate } from 'multiple-cucumber-html-reporter';

const root = path.resolve(import.meta.dirname, '..');
const jsonDir = path.join(root, 'reports', 'cucumber');
const reportPath = path.join(root, 'reports', 'html');

if (!fs.existsSync(path.join(jsonDir, 'cucumber.json'))) {
  console.error(`No cucumber.json found in ${jsonDir} - run the tests first.`);
  process.exit(1);
}

const browser = process.env.BROWSER ?? 'chromium';
const platform = { win32: 'windows', darwin: 'osx', linux: 'linux' }[os.platform() as string] ?? 'linux';

void Promise.resolve(
  generate({
    jsonDir,
    reportPath,
    reportName: 'Playwright + Cucumber · TypeScript',
    pageTitle: 'TypeScript Test Report',
    displayDuration: true,
    displayReportTime: true,
    openReportInBrowser: false,
    saveCollectedJSON: false,
    disableLog: true,
    metadata: {
      browser: { name: browser === 'webkit' ? 'safari' : browser, version: 'latest' },
      device: process.env.CI ? 'CI runner' : os.hostname(),
      platform: { name: platform, version: os.release() },
    },
    customData: {
      title: 'Run info',
      data: [
        { label: 'Project', value: 'auto-playwright' },
        { label: 'Language', value: 'TypeScript' },
        { label: 'Base URL', value: process.env.BASE_URL ?? 'https://www.saucedemo.com' },
        { label: 'Tags', value: process.env.TAGS ?? 'not @wip' },
        { label: 'Commit', value: process.env.GITHUB_SHA?.slice(0, 7) ?? 'local' },
        { label: 'Generated', value: new Date().toISOString() },
      ],
    },
  }),
).then(() => console.log(`HTML report written to ${path.join(reportPath, 'index.html')}`));
