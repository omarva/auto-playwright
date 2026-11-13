#!/usr/bin/env node
/**
 * Todo API: a small, dependency-free back-end used as a system under test.
 *
 * Built only on Node's standard library (node:http, node:sqlite, node:crypto), so it
 * starts in milliseconds anywhere Node 22.13+ is installed:
 *
 *   node backend/server.mjs                 # http://localhost:3000
 *   PORT=4000 DB_FILE=todos.db node backend/server.mjs
 *
 * Endpoints (see openapi.yaml):
 *   GET    /health
 *   POST   /api/auth/login          -> { token, tokenType, expiresIn, user }
 *   GET    /api/me
 *   GET    /api/todos?completed=true|false
 *   POST   /api/todos
 *   GET    /api/todos/:id
 *   PUT    /api/todos/:id
 *   PATCH  /api/todos/:id
 *   DELETE /api/todos/:id
 *
 * Auth is a real HS256 JWT. Every todo belongs to a user; other users get 404, never 403,
 * so ids cannot be probed.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const SECRET = process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS ?? 3600);
const MAX_BODY_BYTES = 64 * 1024;
const TITLE_MAX = 200;

// ---------------------------------------------------------------- storage

const db = new DatabaseSync(process.env.DB_FILE ?? ':memory:');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

const SEED_USERS = [
  { username: 'alice', name: 'Alice Liddell', password: 'wonderland' },
  { username: 'bob', name: 'Bob Builder', password: 'canwefixit' },
];
const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, name, password_hash, salt) VALUES (?, ?, ?, ?)',
);
for (const user of SEED_USERS) {
  const salt = crypto.randomBytes(16).toString('hex');
  insertUser.run(user.username, user.name, hashPassword(user.password, salt), salt);
}

const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT id, username, name FROM users WHERE id = ?'),
  listTodos: db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY id'),
  listTodosByStatus: db.prepare('SELECT * FROM todos WHERE user_id = ? AND completed = ? ORDER BY id'),
  getTodo: db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?'),
  insertTodo: db.prepare(
    'INSERT INTO todos (user_id, title, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *',
  ),
  updateTodo: db.prepare(
    'UPDATE todos SET title = ?, completed = ?, updated_at = ? WHERE id = ? AND user_id = ? RETURNING *',
  ),
  deleteTodo: db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?'),
};

const toTodo = (row) => ({
  id: Number(row.id),
  title: row.title,
  completed: row.completed === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------- JWT (HS256)

const b64url = (input) => Buffer.from(input).toString('base64url');

function signToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: String(user.id), name: user.username, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- HTTP helpers

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

async function readJson(req) {
  const type = req.headers['content-type'] ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
}

function authenticate(req) {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'Missing bearer token');
  const claims = verifyToken(match[1].trim());
  if (!claims) throw new HttpError(401, 'Invalid or expired token');
  const user = q.userById.get(Number(claims.sub));
  if (!user) throw new HttpError(401, 'Unknown user');
  return user;
}

function validateTodo(body, { partial }) {
  const errors = [];
  const allowed = new Set(['title', 'completed']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) errors.push(`${key} is not allowed`);
  if (!partial || 'title' in body) {
    if (typeof body.title !== 'string' || body.title.trim() === '') errors.push('title is required');
    else if (body.title.length > TITLE_MAX) errors.push(`title must be at most ${TITLE_MAX} characters`);
  }
  if ('completed' in body && typeof body.completed !== 'boolean') errors.push('completed must be a boolean');
  if (partial && Object.keys(body).length === 0) errors.push('at least one field is required');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
}

function todoId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Todo not found');
  return id;
}

// ---------------------------------------------------------------- routes

const routes = [
  ['GET', /^\/health$/, () => ({ status: 200, body: { status: 'ok', uptime: Math.round(process.uptime()) } })],

  [
    'POST',
    /^\/api\/auth\/login$/,
    async (req) => {
      const body = await readJson(req);
      const user = typeof body.username === 'string' ? q.userByName.get(body.username) : undefined;
      const password = typeof body.password === 'string' ? body.password : '';
      const ok =
        user &&
        crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.salt), 'hex'), Buffer.from(user.password_hash, 'hex'));
      if (!ok) throw new HttpError(401, 'Invalid username or password');
      return {
        status: 200,
        body: {
          token: signToken(user),
          tokenType: 'Bearer',
          expiresIn: TOKEN_TTL_SECONDS,
          user: { id: Number(user.id), username: user.username, name: user.name },
        },
      };
    },
  ],

  [
    'GET',
    /^\/api\/me$/,
    (req) => {
      const user = authenticate(req);
      return { status: 200, body: { id: Number(user.id), username: user.username, name: user.name } };
    },
  ],

  [
    'GET',
    /^\/api\/todos$/,
    (req, _match, url) => {
      const user = authenticate(req);
      const completed = url.searchParams.get('completed');
      if (completed !== null && completed !== 'true' && completed !== 'false') {
        throw new HttpError(400, 'Validation failed', ['completed must be true or false']);
      }
      const rows =
        completed === null ? q.listTodos.all(user.id) : q.listTodosByStatus.all(user.id, completed === 'true' ? 1 : 0);
      return { status: 200, body: rows.map(toTodo) };
    },
  ],

  [
    'POST',
    /^\/api\/todos$/,
    async (req) => {
      const user = authenticate(req);
      const body = await readJson(req);
      validateTodo(body, { partial: false });
      const now = new Date().toISOString();
      const row = q.insertTodo.get(user.id, body.title.trim(), body.completed ? 1 : 0, now, now);
      return { status: 201, body: toTodo(row), headers: { Location: `/api/todos/${row.id}` } };
    },
  ],

  [
    'GET',
    /^\/api\/todos\/([^/]+)$/,
    (req, match) => {
      const user = authenticate(req);
      const row = q.getTodo.get(todoId(match[1]), user.id);
      if (!row) throw new HttpError(404, 'Todo not found');
      return { status: 200, body: toTodo(row) };
    },
  ],

  [
    ['PUT', 'PATCH'],
    /^\/api\/todos\/([^/]+)$/,
    async (req, match) => {
      const user = authenticate(req);
      const id = todoId(match[1]);
      const body = await readJson(req);
      const partial = req.method === 'PATCH';
      validateTodo(body, { partial });
      const existing = q.getTodo.get(id, user.id);
      if (!existing) throw new HttpError(404, 'Todo not found');
      const title = 'title' in body ? body.title.trim() : existing.title;
      const completed = 'completed' in body ? (body.completed ? 1 : 0) : partial ? existing.completed : 0;
      const row = q.updateTodo.get(title, completed, new Date().toISOString(), id, user.id);
      return { status: 200, body: toTodo(row) };
    },
  ],

  [
    'DELETE',
    /^\/api\/todos\/([^/]+)$/,
    (req, match) => {
      const user = authenticate(req);
      const result = q.deleteTodo.run(todoId(match[1]), user.id);
      if (result.changes === 0) throw new HttpError(404, 'Todo not found');
      return { status: 204 };
    },
  ],
];

// ---------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  const url = new URL(req.url ?? '/', 'http://localhost');
  let status = 500;
  try {
    const candidates = routes.filter(([, pattern]) => pattern.test(url.pathname));
    if (candidates.length === 0) throw new HttpError(404, `No route for ${url.pathname}`);
    const route = candidates.find(([method]) => [method].flat().includes(req.method));
    if (!route) {
      const allow = candidates.flatMap(([method]) => [method].flat()).join(', ');
      throw Object.assign(new HttpError(405, `Method ${req.method} not allowed`), { allow });
    }
    const result = await route[2](req, url.pathname.match(route[1]), url);
    status = result.status;
    send(res, result.status, result.body, result.headers);
  } catch (error) {
    if (error instanceof HttpError) {
      status = error.status;
      send(
        res,
        error.status,
        { error: error.message, ...(error.details ? { details: error.details } : {}) },
        {
          ...(error.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
          ...(error.allow ? { Allow: error.allow } : {}),
        },
      );
    } else {
      console.error(error);
      send(res, 500, { error: 'Internal server error' });
    }
  } finally {
    if (process.env.LOG_REQUESTS !== 'false') {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      console.log(`${req.method} ${url.pathname} ${status} ${ms.toFixed(1)}ms`);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Todo API listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
