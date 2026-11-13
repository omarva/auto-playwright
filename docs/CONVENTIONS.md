# Framework Conventions

Every language implementation in this repository honours the same contract, so
the CI pipeline, Docker images and reporting dashboard can treat them
identically. If you add a new implementation, follow this document.

## 1. Single source of truth for scenarios

All Gherkin lives in the repository-root [`features/`](../features) folder.
No implementation keeps its own copy; each runner is pointed at `../features`:

| Language   | How the shared features are wired in                                   |
| ---------- | ---------------------------------------------------------------------- |
| TypeScript | `paths: ['../features/**/*.feature']` in `cucumber.mjs`                |
| Python     | `bdd_features_base_dir = ../features` in `pytest.ini`                  |
| Java       | `../features` is added as a Maven test resource (`target/test-classes/features`) |
| C#         | Feature files are linked into the project via MSBuild `<Link>` items    |

Because the step text is shared, **step wording is an API** – changing a step in
`features/` means updating all four step-definition layers in the same PR.

## 2. Tags

| Tag            | Meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| `@ui`          | Needs a browser page (a fresh `BrowserContext` per scenario)   |
| `@api`         | HTTP only – uses Playwright `APIRequestContext`, no browser    |
| `@backend`     | Targets the bundled Todo API in `backend/`                     |
| `@contract`    | JSON-schema contract checks                                    |
| `@auth` `@todos` | Todo API feature areas                                       |
| `@smoke`       | Fast, critical-path checks – run on every push                 |
| `@regression`  | Broader coverage – run nightly and on PRs                      |
| `@negative`    | Validates error handling                                       |
| `@demo`        | The self-contained showcase against playwright.dev             |
| `@e2e`         | Multi-page user journeys                                       |
| `@wip`         | Work in progress – excluded by default                         |

Default tag expression: `not @wip`. Override with the `TAGS` environment variable
using Cucumber tag-expression syntax (`@smoke and not @api`). Python translates
it to a pytest `-m` expression automatically.

## 3. Configuration (environment variables)

Every implementation reads the same variables (and an optional `.env` file in its
own folder). Defaults are chosen so that `run tests` works with zero setup.

| Variable         | Default                                 | Notes                                        |
| ---------------- | --------------------------------------- | -------------------------------------------- |
| `BROWSER`        | `chromium`                              | `chromium` \| `firefox` \| `webkit`          |
| `BROWSER_CHANNEL`| _(empty)_                               | e.g. `chrome`, `msedge` (Chromium only)      |
| `HEADLESS`       | `true`                                  | `false` to watch the browser                 |
| `SLOW_MO`        | `0`                                     | ms delay between actions (great for demos)   |
| `TIMEOUT`        | `15000`                                 | action + assertion timeout, ms               |
| `NAV_TIMEOUT`    | `30000`                                 | navigation timeout, ms                       |
| `BASE_URL`       | `https://www.saucedemo.com`             | UI system under test                         |
| `API_BASE_URL`   | `https://jsonplaceholder.typicode.com`  | Public API system under test                 |
| `BACKEND_URL`    | `http://localhost:3000`                 | Bundled Todo API (`backend/`)                |
| `BACKEND_REQUIRED` | `false`                               | `true` = fail (not skip) when the Todo API is down |
| `DEMO_URL`       | `https://playwright.dev`                | Demo feature target                          |
| `USER_PASSWORD`  | `secret_sauce`                          | Password for named demo-store users          |
| `TAGS`           | `not @wip`                              | Cucumber tag expression                      |
| `PARALLEL`       | `2`                                     | Parallel workers / threads                   |
| `RETRIES`        | `0`                                     | Retries for failed scenarios (CI uses `1`)   |
| `TRACE`          | `retain-on-failure`                     | `on` \| `off` \| `retain-on-failure`         |
| `VIDEO`          | `off`                                   | `on` \| `off` \| `retain-on-failure`         |
| `SCREENSHOT`     | `only-on-failure`                       | `on` \| `off` \| `only-on-failure`           |

Viewport is fixed at **1280×720**; Playwright's test-id attribute is set to
**`data-test`** (the attribute used by the demo store).

## 4. Lifecycle

* **One `Browser` per worker/thread**, launched lazily – API-only scenarios never
  start a browser.
* **One `BrowserContext` + `Page` per scenario** – complete isolation, no shared
  cookies or storage.
* **One `APIRequestContext` per scenario**, created lazily with `API_BASE_URL`.
* After each scenario:
  * failed → full-page screenshot attached to every report (`image/png`);
  * trace saved to `reports/artifacts/traces/<scenario>.zip` according to `TRACE`;
  * video kept according to `VIDEO`;
  * context closed.
* API steps attach the request and response (status, headers, pretty JSON body)
  to the report as attachments.
* `I capture a screenshot named "<name>"` always attaches a screenshot.

## 5. Reports – fixed output layout

Every implementation writes **exactly** this layout under `<language>/reports/`
(the folder is git-ignored and wiped at the start of each run):

```
reports/
├── allure-results/      # raw Allure results (+ environment.properties)
├── junit/               # JUnit XML – consumed by CI test summaries
├── cucumber/            # cucumber.json and, where supported, cucumber.html / messages.ndjson
├── html/                # language-native "pretty" HTML report (index.html)
└── artifacts/           # screenshots/, traces/, videos/
```

CI collects these folders, tags every Allure result with its `language` and
`browser`, and publishes one Allure report per language plus a combined one to
GitHub Pages.

## 6. Commands

Each implementation exposes the same verbs (run from its folder):

| Verb            | TypeScript             | Python                         | Java                         | C#                               |
| --------------- | ---------------------- | ------------------------------ | ---------------------------- | -------------------------------- |
| install deps    | `npm ci`               | `pip install -r requirements-dev.txt` | `./mvnw -B -q test-compile` | `dotnet build`             |
| install browsers| `npx playwright install --with-deps` | `playwright install --with-deps` | `./mvnw -B exec:java@install-browsers` | `pwsh AutoPlaywright.Specs/bin/Debug/net10.0/playwright.ps1 install --with-deps` |
| lint            | `npm run lint`         | `ruff check . && ruff format --check . && mypy src` | `./mvnw -B spotless:check` | `dotnet format --verify-no-changes` |
| test            | `npm test`             | `pytest`                       | `./mvnw -B verify`           | `dotnet test`                    |
| demo (headed)   | `npm run demo`         | `pytest --demo`                | `./mvnw -B verify -Pdemo`    | `./run-tests.sh --demo` / `./run-tests.ps1 -Demo` |
| open report     | `npm run report`       | `allure serve reports/allure-results` | `./mvnw allure:serve` | `allure serve reports/allure-results` |

## 7. API step library

API steps are generic and keyword-agnostic: register them so they match after
`Given`, `When` **or** `Then` (pytest-bdd: stack `@given`/`@when`/`@then`;
Reqnroll: `[StepDefinition]`). They all act on one per-scenario API session.

### Services

| Step | Behaviour |
| ---- | --------- |
| `Given I use the "<service>" API` | Switches the base URL. `jsonplaceholder` → `API_BASE_URL` (the default when no service step is used); `todo` → `BACKEND_URL` (default `http://localhost:3000`). For `todo`, first `GET /health`: if unreachable and `BACKEND_REQUIRED` is not `true`, the scenario is **skipped** with the message *"Todo API is not running at <url> - start it with `node backend/server.mjs`"*; if `BACKEND_REQUIRED=true` it **fails**. CI sets `BACKEND_REQUIRED=true`. |

### Authentication (Todo API)

| Step | Behaviour |
| ---- | --------- |
| `When I log in to the API as "<user>" with password "<password>"` | `POST /api/auth/login` with `{"username","password"}`; records the response like any request. Does **not** store a token. |
| `Given I am authenticated as "<user>" with password "<password>"` | Same request, asserts `200`, stores `token`; every later request sends `Authorization: Bearer <token>`. Calling it again switches user. |
| `Given I am not authenticated` | Clears the token. |
| `Given I use the bearer token "<token>"` | Sends this exact token from now on. |

### Requests

| Step | Behaviour |
| ---- | --------- |
| `When I send a <METHOD> request to "<path>"` | METHOD ∈ GET, POST, PUT, PATCH, DELETE. |
| `When I send a <METHOD> request to "<path>" with body:` + doc string | JSON body, `Content-Type: application/json`. METHOD ∈ POST, PUT, PATCH. |
| `When I store the response field "<path>" as "<name>"` | Saves the rendered value of a field into a scenario variable. |

`${name}` placeholders are interpolated from scenario variables in request paths, request bodies **and** expected values.
An unknown variable is an error. Each request measures its wall-clock duration and
attaches request + response (method, URL, status, headers, pretty body, duration) to the report.

### Assertions

| Step | Behaviour |
| ---- | --------- |
| `Then the response status should be <int>` | |
| `Then the response header "<name>" should contain "<text>"` | Case-insensitive header name. |
| `Then the response field "<path>" should be "<value>"` | Compares the **rendered** value (see below). |
| `Then the response field "<path>" should not be empty` | Field exists, is not null and renders to a non-empty string. |
| `Then the response field "<path>" should contain "<text>"` | Array → some element renders equal to text; string → substring. |
| `Then the response should be a list of <int> items` | Body is a JSON array of that length. |
| `Then every item in the response should have field "<path>" equal to "<value>"` | Body is a non-empty array; every element matches. |
| `Then the response should contain an item with field "<path>" equal to "<value>"` | Some element matches. |
| `Then the response should not contain an item with field "<path>" equal to "<value>"` | No element matches. |
| `Then the response should match the "<name>" schema` | Validates the body against `features/schemas/<name>.schema.json` (JSON Schema draft-07); the failure message lists every violation. |
| `Then the response time should be below <int> ms` | Duration of the last request. |
| `Then the response body should be empty` | Zero-length body (e.g. 204). |

**Field paths** are dot-separated; numeric segments index arrays: `address.geo.lat`, `0.email`, `user.username`.

**Rendering rule** (identical everywhere): a JSON string renders as its raw text; every other JSON
value renders as compact JSON text: `1`, `1.5`, `true`, `false`, `null`. So `"completed" should be "false"`
works the same in every language. Never use a language's own boolean formatting (`True`, `False`).

### Running the Todo API locally

```bash
node backend/server.mjs        # Node 22.13+; listens on http://localhost:3000
```

Seeded users: `alice` / `wonderland`, `bob` / `canwefixit`.
