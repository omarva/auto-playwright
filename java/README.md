# ☕ Java — Playwright + Cucumber-JVM

The Java implementation of the shared [`features/`](../features). It follows the
[framework conventions](../docs/CONVENTIONS.md): same tags, same environment
variables, and the same report layout as the other languages.

| | |
|---|---|
| **Runtime** | Java 21 · Maven 3.9 (wrapper included, no install needed) |
| **Browser automation** | Playwright for Java 1.65 |
| **BDD** | Cucumber-JVM 8 on the JUnit Platform 6 suite engine · PicoContainer DI |
| **Assertions** | Playwright web-first assertions · AssertJ |
| **Accessibility** | axe-core for Playwright (WCAG 2.0/2.1 A + AA) |
| **Reports** | Allure · masterthought Cucumber HTML · Cucumber HTML/JSON/NDJSON · JUnit XML |
| **Lint** | Spotless + google-java-format |

## Quick start

```bash
cd java
./mvnw -B exec:java@install-browsers   # download chromium (+ OS deps on Linux)
./mvnw -B verify                       # run every scenario, build the reports
```

On Windows use `mvnw.cmd` instead of `./mvnw`.

### Common recipes

```bash
TAGS="@smoke" ./mvnw -B verify                   # only smoke scenarios
TAGS="@api" ./mvnw -B verify                     # API only – no browser is launched
TAGS="@backend" ./mvnw -B verify                 # Todo API tests (start: node ../backend/server.mjs)
BROWSER=firefox ./mvnw -B verify                 # chromium | firefox | webkit
PARALLEL=4 RETRIES=1 ./mvnw -B verify            # 4 threads, retry failures once
HEADLESS=false SLOW_MO=300 ./mvnw -B verify      # watch it run
./mvnw -B verify -Pdemo                          # the @demo tour, headed, slow-mo 500 ms
./mvnw -B verify -Dtags="@cart and not @negative" -Dworkers=1   # same knobs via -D
./mvnw -B spotless:check                         # lint (spotless:apply to fix)
```

All runtime options are listed in [CONVENTIONS.md](../docs/CONVENTIONS.md#3-configuration-environment-variables).
Copy [`.env.example`](.env.example) to `.env` to set them locally.

## API & back-end testing

`ApiSteps` implements the shared, keyword-agnostic API step library
([CONVENTIONS.md §7](../docs/CONVENTIONS.md#7-api-step-library)) on Playwright's
`APIRequestContext`. Per-scenario state (service, bearer token, `${variables}`, last
response and its timing) lives in `support/ApiSession.java`.

* **Services:** `jsonplaceholder` (`API_BASE_URL`) and `todo`, the bundled back-end
  (`BACKEND_URL`, default `http://localhost:3000`). If the Todo API is down, `@backend`
  scenarios are **skipped**. With `BACKEND_REQUIRED=true` (as in CI) they **fail** instead.
* **Contracts:** `../features/schemas/*.schema.json` are copied to the test classpath and
  validated with networknt json-schema-validator (draft-07). Every violation is listed.
* Every request/response pair (headers, pretty JSON, duration) is attached to the reports.

## Reports

`./mvnw verify` always generates the reports, even when scenarios fail. The build
still fails afterwards (Failsafe `verify`), so CI goes red.

| Report | Location | Open with |
|---|---|---|
| **Allure** | `reports/allure-results/` | `./mvnw allure:serve` |
| **Cucumber HTML (masterthought)** | `reports/html/index.html` | any browser |
| Cucumber HTML (official) | `reports/cucumber/cucumber.html` | any browser |
| Cucumber JSON / NDJSON messages | `reports/cucumber/` | tooling |
| JUnit XML (with flaky/rerun info) | `reports/junit/` | CI test summaries |
| Screenshots · traces · videos | `reports/artifacts/` | `npx playwright show-trace <zip>` |

When `RETRIES > 0`, each re-run writes `*.rerun-N.*` files next to the originals
instead of overwriting them. The masterthought report merges them and shows each
scenario's latest result.

## How it is wired

```
src/test/java/dev/autoplaywright/
├── config/Config.java          # env → .env → defaults
├── support/
│   ├── BrowserManager.java     # one Playwright + Browser per thread (ThreadLocal, lazy)
│   ├── ScenarioContext.java    # per-scenario BrowserContext, Page and APIRequestContext
│   ├── Hooks.java              # screenshots, traces, videos, Allure environment
│   ├── Patterns.java           # JS-safe regex helpers for Playwright assertions
│   └── report/                 # re-run-safe Cucumber formatters
├── pages/                      # Page Object Model
├── steps/                      # step definitions, one class per feature area
└── runner/RunCucumberIT.java   # JUnit Platform @Suite (run by Maven Failsafe)
```

* Feature files are **not** copied into this module. Maven adds `../features` as
  a test resource, so all languages run the same Gherkin.
* Scenarios run in parallel (`PARALLEL` threads). Each thread owns its Playwright
  instance and each scenario gets a fresh `BrowserContext`, so nothing leaks
  between scenarios.
* `@api` scenarios use Playwright's `APIRequestContext` and never start a browser.

## Docker

The build context is the repository root, because the image needs `features/`:

```bash
docker build -f java/Dockerfile -t auto-playwright-java .
docker run --rm -e TAGS=@smoke -v "$PWD/java/reports:/app/java/reports" auto-playwright-java
```
