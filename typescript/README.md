# 🟦 TypeScript · Playwright + Cucumber

[cucumber-js](https://github.com/cucumber/cucumber-js) runs the shared
[`../features`](../features) against Playwright, with step definitions in TypeScript.

## Quick start

```bash
npm ci
npx playwright install --with-deps   # first time only
npm test                             # full suite, headless, 2 workers
npm run demo                         # watch the @demo tour in a real browser
npm run report                       # build the HTML report and Allure report, then open Allure
```

## Useful scripts

| Script                | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `npm test`            | Run everything matching `TAGS` (default `not @wip`)         |
| `npm run test:smoke`  | Only `@smoke` scenarios                                     |
| `npm run test:api`    | Only `@api` scenarios (no browser is launched)              |
| `npm run demo`        | Headed, slowed-down run of the `@demo` feature              |
| `npm run report:html` | multiple-cucumber-html-reporter → `reports/html/index.html` |
| `npm run report`      | HTML report + Allure 3 report, then opens Allure            |
| `npm run lint`        | `tsc` type-check + ESLint (type-aware) + Prettier           |
| `npm run dry-run`     | Check that every step has a definition without running them |

Any variable from [CONVENTIONS.md](../docs/CONVENTIONS.md#3-configuration-environment-variables)
works, either inline or from a `.env` file (see `.env.example`):

```bash
BROWSER=webkit TAGS="@cart and not @negative" PARALLEL=4 npm test
```

## Layout

```
src/
├── pages/      Page Objects (BasePage, LoginPage, InventoryPage, CartPage, CheckoutPage, PlaywrightSitePage)
├── steps/      Step definitions: auth, shop (catalogue/cart/checkout), api, demo (+ accessibility)
└── support/    config.ts (typed env), world.ts (per-scenario state), hooks.ts (lifecycle + artifacts)
scripts/generate-report.mts   builds the multiple-cucumber-html-reporter report
cucumber.mjs                  runner config: paths, tags, parallel, retries, formatters
```

## Reports

| Output                                              | Format                           |
| --------------------------------------------------- | -------------------------------- |
| `reports/allure-results/`                           | Allure (via `allure-cucumberjs`) |
| `reports/html/index.html`                           | multiple-cucumber-html-reporter  |
| `reports/cucumber/cucumber.html`                    | Official Cucumber HTML report    |
| `reports/cucumber/cucumber.json`, `messages.ndjson` | Machine-readable results         |
| `reports/junit/cucumber-junit.xml`                  | JUnit XML for CI test summaries  |
| `reports/artifacts/{screenshots,traces,videos}`     | Failure evidence                 |

Open a trace with `npx playwright show-trace reports/artifacts/traces/<file>.zip`.

## Docker

```bash
# from the repository root
docker build -f typescript/Dockerfile -t auto-playwright-ts .
docker run --rm -e TAGS=@smoke -v "$PWD/typescript/reports:/app/typescript/reports" auto-playwright-ts
```
