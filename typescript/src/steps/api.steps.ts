import { defineStep } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { config } from '../support/config';
import { type HttpMethod, render, resolvePath, schemaErrors } from '../support/api-session';
import type { CustomWorld } from '../support/world';

// Generic API step library - see docs/CONVENTIONS.md section 7. `defineStep` makes every
// step usable after Given, When or Then, exactly like the other three implementations.

const METHOD = '(GET|POST|PUT|PATCH|DELETE)';
const QUOTED = '"([^"]*)"';
const re = (text: string): RegExp => new RegExp(`^${text}$`);

function items(world: CustomWorld): unknown[] {
  const body = world.apiSession.response.body;
  if (!Array.isArray(body)) throw new Error(`Response body is not a JSON array: ${JSON.stringify(body)}`);
  return body;
}

function matches(item: unknown, fieldPath: string, expected: string): boolean {
  try {
    return render(resolvePath(item, fieldPath)) === expected;
  } catch {
    return false;
  }
}

async function send(world: CustomWorld, method: HttpMethod, urlPath: string, body?: string): Promise<void> {
  await world.apiSession.send(method, urlPath, body);
  await world.attachJson(`${method} ${urlPath}`, world.apiSession.describe(body));
}

// ---- Services & authentication --------------------------------------------

defineStep(re(`I use the ${QUOTED} API`), async function (this: CustomWorld, service: string) {
  const reachable = await this.apiSession.useService(service);
  if (reachable) return;
  const message = `Todo API is not running at ${this.apiSession.baseUrl} - start it with \`node backend/server.mjs\``;
  if (config.backendRequired) throw new Error(message);
  this.log(`SKIPPED: ${message}`);
  return 'skipped';
});

async function login(world: CustomWorld, username: string, password: string): Promise<void> {
  await send(world, 'POST', '/api/auth/login', JSON.stringify({ username, password }));
}

defineStep(
  re(`I log in to the API as ${QUOTED} with password ${QUOTED}`),
  async function (this: CustomWorld, username: string, password: string) {
    await login(this, username, password);
  },
);

defineStep(
  re(`I am authenticated as ${QUOTED} with password ${QUOTED}`),
  async function (this: CustomWorld, username: string, password: string) {
    this.apiSession.token = undefined;
    await login(this, username, password);
    expect(this.apiSession.response.status, `login as ${username} should succeed`).toBe(200);
    this.apiSession.token = render(resolvePath(this.apiSession.response.body, 'token'));
  },
);

defineStep('I am not authenticated', function (this: CustomWorld) {
  this.apiSession.token = undefined;
});

defineStep(re(`I use the bearer token ${QUOTED}`), function (this: CustomWorld, token: string) {
  this.apiSession.token = token;
});

// ---- Requests ----------------------------------------------------------------

defineStep(
  re(`I send a ${METHOD} request to ${QUOTED}`),
  async function (this: CustomWorld, method: HttpMethod, urlPath: string) {
    await send(this, method, urlPath);
  },
);

defineStep(
  re(`I send a ${METHOD} request to ${QUOTED} with body:`),
  async function (this: CustomWorld, method: HttpMethod, urlPath: string, body: string) {
    await send(this, method, urlPath, body);
  },
);

defineStep(
  re(`I store the response field ${QUOTED} as ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, name: string) {
    this.apiSession.variables.set(name, render(resolvePath(this.apiSession.response.body, fieldPath)));
  },
);

// ---- Assertions ----------------------------------------------------------------

defineStep(re('the response status should be (\\d+)'), function (this: CustomWorld, status: string) {
  const r = this.apiSession.response;
  expect(r.status, `${r.method} ${r.url} returned ${r.text.slice(0, 500)}`).toBe(Number(status));
});

defineStep(
  re(`the response header ${QUOTED} should contain ${QUOTED}`),
  function (this: CustomWorld, header: string, expected: string) {
    const value = this.apiSession.response.headers[header.toLowerCase()];
    expect(value, `header "${header}"`).toBeDefined();
    expect(value).toContain(this.apiSession.interpolate(expected));
  },
);

defineStep(
  re(`the response field ${QUOTED} should be ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, expected: string) {
    const actual = render(resolvePath(this.apiSession.response.body, fieldPath));
    expect(actual, `field "${fieldPath}"`).toBe(this.apiSession.interpolate(expected));
  },
);

defineStep(re(`the response field ${QUOTED} should not be empty`), function (this: CustomWorld, fieldPath: string) {
  const value = resolvePath(this.apiSession.response.body, fieldPath);
  expect(value, `field "${fieldPath}"`).not.toBeNull();
  expect(render(value), `field "${fieldPath}"`).not.toBe('');
});

defineStep(
  re(`the response field ${QUOTED} should contain ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, expected: string) {
    const value = resolvePath(this.apiSession.response.body, fieldPath);
    const text = this.apiSession.interpolate(expected);
    if (Array.isArray(value)) {
      expect(value.map(render), `field "${fieldPath}"`).toContain(text);
    } else {
      expect(render(value), `field "${fieldPath}"`).toContain(text);
    }
  },
);

defineStep(re('the response should be a list of (\\d+) items'), function (this: CustomWorld, count: string) {
  expect(items(this)).toHaveLength(Number(count));
});

defineStep(
  re(`every item in the response should have field ${QUOTED} equal to ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, expected: string) {
    const list = items(this);
    const value = this.apiSession.interpolate(expected);
    expect(list.length, 'response should not be empty').toBeGreaterThan(0);
    const offenders = list.filter((item) => !matches(item, fieldPath, value));
    expect(offenders, `items whose "${fieldPath}" is not "${value}"`).toEqual([]);
  },
);

defineStep(
  re(`the response should contain an item with field ${QUOTED} equal to ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, expected: string) {
    const value = this.apiSession.interpolate(expected);
    expect(
      items(this).some((item) => matches(item, fieldPath, value)),
      `an item with "${fieldPath}" = "${value}"`,
    ).toBe(true);
  },
);

defineStep(
  re(`the response should not contain an item with field ${QUOTED} equal to ${QUOTED}`),
  function (this: CustomWorld, fieldPath: string, expected: string) {
    const value = this.apiSession.interpolate(expected);
    expect(
      items(this).some((item) => matches(item, fieldPath, value)),
      `no item with "${fieldPath}" = "${value}"`,
    ).toBe(false);
  },
);

defineStep(re(`the response should match the ${QUOTED} schema`), function (this: CustomWorld, name: string) {
  const errors = schemaErrors(name, this.apiSession.response.body);
  expect(errors, `schema "${name}" violations`).toEqual([]);
});

defineStep(re('the response time should be below (\\d+) ms'), function (this: CustomWorld, limit: string) {
  expect(this.apiSession.response.durationMs).toBeLessThan(Number(limit));
});

defineStep('the response body should be empty', function (this: CustomWorld) {
  expect(this.apiSession.response.text).toBe('');
});
