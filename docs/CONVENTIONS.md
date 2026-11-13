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
| `API_BASE_URL`   | `https://jsonplaceholder.typicode.com`  | API system under test                        |
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
