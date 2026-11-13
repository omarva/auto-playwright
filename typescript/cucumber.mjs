// Cucumber-js configuration. Every knob is driven by the env vars documented in
// ../docs/CONVENTIONS.md so local runs, Docker and CI behave identically.
import 'dotenv/config';
import os from 'node:os';

const env = (name, fallback) => (process.env[name]?.trim() ? process.env[name].trim() : fallback);
const browser = env('BROWSER', 'chromium');

export default {
  paths: ['../features/**/*.feature'],
  requireModule: ['tsx/cjs'],
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  tags: env('TAGS', 'not @wip'),
  parallel: Number(env('PARALLEL', '2')),
  retry: Number(env('RETRIES', '0')),
  strict: true,
  format: [
    process.env.CI ? 'progress' : 'progress-bar',
    'json:reports/cucumber/cucumber.json',
    'html:reports/cucumber/cucumber.html',
    'message:reports/cucumber/messages.ndjson',
    'junit:reports/junit/cucumber-junit.xml',
    'allure-cucumberjs/reporter:reports/allure-formatter.log',
  ],
  formatOptions: {
    snippetInterface: 'async-await',
    junit: { suiteName: `TypeScript (${browser})` },
    resultsDir: 'reports/allure-results',
    labels: [
      { pattern: [/@feature:(.*)/], name: 'feature' },
      { pattern: [/@severity:(.*)/], name: 'severity' },
    ],
    links: {
      issue: { pattern: [/@issue:(.*)/], urlTemplate: 'https://github.com/omarva/auto-playwright/issues/%s' },
    },
    environmentInfo: {
      Language: 'TypeScript',
      Runner: 'cucumber-js',
      Browser: browser,
      Headless: env('HEADLESS', 'true'),
      'Base URL': env('BASE_URL', 'https://www.saucedemo.com'),
      'API URL': env('API_BASE_URL', 'https://jsonplaceholder.typicode.com'),
      Node: process.version,
      OS: `${os.type()} ${os.release()}`,
    },
  },
};
