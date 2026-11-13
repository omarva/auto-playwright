# 🗄️ Todo API: the bundled back-end

A small but realistic REST service that the framework's `@backend` scenarios test.
It uses **zero npm dependencies**, only Node's standard library (`node:http`, `node:sqlite`, `node:crypto`),
so it starts in milliseconds on any machine with **Node 22.13+**.

```bash
node backend/server.mjs                 # http://localhost:3000
PORT=4000 DB_FILE=todos.db node backend/server.mjs
docker run --rm -p 3000:3000 ghcr.io/omarva/auto-playwright-backend
```

## What it does

| | |
|---|---|
| **Auth** | `POST /api/auth/login` returns an HS256 **JWT**; passwords are scrypt-hashed |
| **Resources** | `/api/todos` CRUD (`GET` list + `?completed=` filter, `POST`, `GET`/`PUT`/`PATCH`/`DELETE /:id`) |
| **Isolation** | Each user only sees their own todos; anyone else gets **404**, never 403, so ids can't be probed |
| **Validation** | Unknown fields, blank titles, wrong types, and **every** error is returned in `details[]` |
| **HTTP semantics** | 201 + `Location`, 204 on delete, 401 + `WWW-Authenticate`, 405 + `Allow`, 413, 415 |
| **Contract** | [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1) |

Seeded users: **alice / wonderland** and **bob / canwefixit**.

| Variable | Default | |
|---|---|---|
| `PORT` | `3000` | |
| `DB_FILE` | `:memory:` | SQLite file; in-memory by default, so every start is clean |
| `JWT_SECRET` | random per start | Set it to keep tokens valid across restarts |
| `TOKEN_TTL_SECONDS` | `3600` | |
| `LOG_REQUESTS` | `true` | One line per request with its timing |

## How the tests use it

Scenarios in [`features/backend`](../features/backend) start with `Given I use the "todo" API`, which targets
`BACKEND_URL` (default `http://localhost:3000`). If the service isn't running, those scenarios are **skipped**
with a hint, so the rest of the suite still works without it. CI starts it automatically and sets
`BACKEND_REQUIRED=true`, which turns "not running" into a failure.
