import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type ArtifactMode = 'on' | 'off' | 'retain-on-failure' | 'only-on-failure';

const BROWSERS: readonly BrowserName[] = ['chromium', 'firefox', 'webkit'];

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function int(name: string, fallback: number): number {
  const raw = str(name, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative integer, got "${raw}"`);
  }
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  return ['1', 'true', 'yes', 'on'].includes(str(name, String(fallback)).toLowerCase());
}

function browser(): BrowserName {
  const value = str('BROWSER', 'chromium').toLowerCase() as BrowserName;
  if (!BROWSERS.includes(value)) {
    throw new Error(`BROWSER must be one of ${BROWSERS.join(', ')}, got "${value}"`);
  }
  return value;
}

function mode(name: string, fallback: ArtifactMode): ArtifactMode {
  return str(name, fallback).toLowerCase() as ArtifactMode;
}

/** Root folder for every report and artifact produced by a run. */
export const REPORTS_DIR = path.resolve(__dirname, '../../reports');

/** Strongly typed, validated view of the environment. Read once per worker. */
export const config = Object.freeze({
  browser: browser(),
  channel: str('BROWSER_CHANNEL', '') || undefined,
  headless: bool('HEADLESS', true),
  slowMo: int('SLOW_MO', 0),
  timeout: int('TIMEOUT', 15_000),
  navigationTimeout: int('NAV_TIMEOUT', 30_000),
  baseUrl: str('BASE_URL', 'https://www.saucedemo.com'),
  apiBaseUrl: str('API_BASE_URL', 'https://jsonplaceholder.typicode.com'),
  demoUrl: str('DEMO_URL', 'https://playwright.dev'),
  userPassword: str('USER_PASSWORD', 'secret_sauce'),
  tags: str('TAGS', 'not @wip'),
  parallel: int('PARALLEL', 2),
  retries: int('RETRIES', 0),
  trace: mode('TRACE', 'retain-on-failure'),
  video: mode('VIDEO', 'off'),
  screenshot: mode('SCREENSHOT', 'only-on-failure'),
  viewport: { width: 1280, height: 720 },
  testIdAttribute: 'data-test',
  dirs: {
    reports: REPORTS_DIR,
    traces: path.join(REPORTS_DIR, 'artifacts', 'traces'),
    videos: path.join(REPORTS_DIR, 'artifacts', 'videos'),
    screenshots: path.join(REPORTS_DIR, 'artifacts', 'screenshots'),
  },
});

export type Config = typeof config;
