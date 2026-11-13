import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { config } from './config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RecordedResponse {
  method: HttpMethod;
  url: string;
  status: number;
  headers: Record<string, string>;
  text: string;
  body: unknown;
  durationMs: number;
}

const SERVICES: Readonly<Record<string, () => string>> = {
  jsonplaceholder: () => config.apiBaseUrl,
  todo: () => config.backendUrl,
};

const SCHEMAS_DIR = path.resolve(__dirname, '../../../features/schemas');
const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = new Map<string, ValidateFunction>();

/** Renders a JSON value the same way in every language: strings raw, everything else compact JSON. */
export function render(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value === undefined ? null : value);
}

/** Resolves a dot path such as `address.geo.lat` or `0.email`. Throws a descriptive error if absent. */
export function resolvePath(body: unknown, fieldPath: string): unknown {
  let current: unknown = body;
  for (const segment of fieldPath.split('.')) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      if (index >= current.length) throw new Error(`Path "${fieldPath}": index ${index} is out of range`);
      current = current[index];
    } else if (current !== null && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      throw new Error(`Path "${fieldPath}": no "${segment}" in ${JSON.stringify(current)?.slice(0, 300)}`);
    }
  }
  return current;
}

function schemaValidator(name: string): ValidateFunction {
  let validate = schemaCache.get(name);
  if (!validate) {
    const file = path.join(SCHEMAS_DIR, `${name}.schema.json`);
    if (!fs.existsSync(file)) throw new Error(`Schema "${name}" not found at ${file}`);
    validate = ajv.compile(JSON.parse(fs.readFileSync(file, 'utf8')) as object);
    schemaCache.set(name, validate);
  }
  return validate;
}

export function schemaErrors(name: string, body: unknown): string[] {
  const validate = schemaValidator(name);
  if (validate(body)) return [];
  return (validate.errors ?? []).map(
    (e: ErrorObject) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'} ${JSON.stringify(e.params)}`,
  );
}

/** Per-scenario API state: target service, auth token, variables and the last response. */
export class ApiSession {
  baseUrl = config.apiBaseUrl;
  token?: string;
  readonly variables = new Map<string, string>();
  last?: RecordedResponse;

  constructor(private readonly context: () => Promise<APIRequestContext>) {}

  /** Selects a service. Returns false when the service is unreachable (caller decides skip vs fail). */
  async useService(name: string): Promise<boolean> {
    const resolve = SERVICES[name];
    if (!resolve) throw new Error(`Unknown API service "${name}". Known: ${Object.keys(SERVICES).join(', ')}`);
    this.baseUrl = resolve().replace(/\/$/, '');
    if (name !== 'todo') return true;
    try {
      const api = await this.context();
      const health = await api.get(`${this.baseUrl}/health`, { timeout: 3_000 });
      return health.ok();
    } catch {
      return false;
    }
  }

  interpolate(text: string): string {
    return text.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      const value = this.variables.get(name);
      if (value === undefined) throw new Error(`Unknown scenario variable "\${${name}}"`);
      return value;
    });
  }

  async send(method: HttpMethod, rawPath: string, rawBody?: string): Promise<RecordedResponse> {
    const url = `${this.baseUrl}${this.interpolate(rawPath)}`;
    const data: unknown = rawBody === undefined ? undefined : JSON.parse(this.interpolate(rawBody));
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';

    const api = await this.context();
    const started = performance.now();
    const response: APIResponse = await api.fetch(url, { method, headers, data, failOnStatusCode: false });
    const text = await response.text();
    const durationMs = Math.round(performance.now() - started);

    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    this.last = { method, url, status: response.status(), headers: response.headers(), text, body, durationMs };
    return this.last;
  }

  get response(): RecordedResponse {
    if (!this.last) throw new Error('No request has been sent in this scenario yet');
    return this.last;
  }

  /** Report attachment describing the last exchange. */
  describe(requestBody?: string): Record<string, unknown> {
    const r = this.response;
    return {
      request: {
        method: r.method,
        url: r.url,
        authenticated: Boolean(this.token),
        body: requestBody === undefined ? undefined : (JSON.parse(this.interpolate(requestBody)) as unknown),
      },
      response: { status: r.status, durationMs: r.durationMs, headers: r.headers, body: r.body },
    };
  }
}
