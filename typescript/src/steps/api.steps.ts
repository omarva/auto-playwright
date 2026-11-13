import { Then, When } from '@cucumber/cucumber';
import type { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { config } from '../support/config';
import type { CustomWorld } from '../support/world';

async function record(
  world: CustomWorld,
  method: string,
  url: string,
  response: APIResponse,
  requestBody?: unknown,
): Promise<void> {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // Non-JSON payload: keep the raw text.
  }
  world.lastResponse = response;
  world.lastResponseBody = body;
  await world.attachJson(`${method} ${url}`, {
    request: { method, url: new URL(url, config.apiBaseUrl).toString(), body: requestBody },
    response: { status: response.status(), headers: response.headers(), body },
  });
}

function responseOf(world: CustomWorld): APIResponse {
  if (!world.lastResponse) throw new Error('No request has been sent in this scenario yet');
  return world.lastResponse;
}

function field(world: CustomWorld, name: string): unknown {
  const body = world.lastResponseBody;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`Response body is not a JSON object: ${JSON.stringify(body)}`);
  }
  if (!(name in body)) throw new Error(`Response has no field "${name}": ${JSON.stringify(body)}`);
  return (body as Record<string, unknown>)[name];
}

When('I send a GET request to {string}', async function (this: CustomWorld, url: string) {
  const api = await this.api();
  await record(this, 'GET', url, await api.get(url));
});

When('I send a POST request to {string} with body:', async function (this: CustomWorld, url: string, body: string) {
  const payload: unknown = JSON.parse(body);
  const api = await this.api();
  await record(this, 'POST', url, await api.post(url, { data: payload }), payload);
});

Then('the response status should be {int}', function (this: CustomWorld, status: number) {
  expect(responseOf(this).status()).toBe(status);
});

Then(
  'the response header {string} should contain {string}',
  function (this: CustomWorld, header: string, expected: string) {
    expect(responseOf(this).headers()[header.toLowerCase()]).toContain(expected);
  },
);

Then('the response field {string} should be {string}', function (this: CustomWorld, name: string, expected: string) {
  expect(String(field(this, name))).toBe(expected);
});

Then('the response should be a list of {int} items', function (this: CustomWorld, count: number) {
  expect(Array.isArray(this.lastResponseBody), 'response body should be a JSON array').toBe(true);
  expect(this.lastResponseBody as unknown[]).toHaveLength(count);
});
