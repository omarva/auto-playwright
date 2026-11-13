# C# · Reqnroll · Playwright

> The .NET implementation of the shared BDD suite: **.NET 10**, **Reqnroll 3** (the open-source
> successor to SpecFlow) on **NUnit**, **Microsoft.Playwright**, **Allure**, and **axe-core**.

It runs the exact same Gherkin as every other language in this repo. The features live in
[`../features`](../features) and are **linked** into the project by MSBuild, never copied.

## Quick start

```bash
cd dotnet
dotnet build
pwsh AutoPlaywright.Specs/bin/Debug/net10.0/playwright.ps1 install --with-deps chromium   # once
dotnet test
```

> On Windows without PowerShell 7, `powershell -File AutoPlaywright.Specs\bin\Debug\net10.0\playwright.ps1 install` works as well.

### The run scripts

`run-tests.sh` and `run-tests.ps1` turn the repo-wide [conventions](../docs/CONVENTIONS.md)
(`TAGS`, `BROWSER`, `PARALLEL`) into `dotnet test` arguments:

```bash
./run-tests.sh                                   # everything except @wip
TAGS="@smoke and not @api" ./run-tests.sh        # Cucumber tag expression
BROWSER=firefox PARALLEL=4 ./run-tests.sh        # another browser, more workers
./run-tests.sh --demo                            # headed, slowed-down tour of playwright.dev
./run-tests.sh --install-browsers                # build and install the browser first
```

```powershell
./run-tests.ps1 -Tags "@regression" -Browser webkit
./run-tests.ps1 -Demo
```

### Filtering by tag with plain `dotnet test`

Reqnroll turns every Gherkin tag into an NUnit **Category**, so tags map directly to VSTest filters:

| Tag expression           | `dotnet test --filter`               |
| ------------------------ | ------------------------------------ |
| `@smoke`                 | `Category=smoke`                     |
| `@smoke and not @api`    | `Category=smoke&Category!=api`       |
| `@cart or @checkout`     | `Category=cart\|Category=checkout`   |
| `not @wip` *(default)*   | `Category!=wip`                      |

Parallel workers: `dotnet test -- NUnit.NumberOfTestWorkers=4`. Features run in parallel, and
scenarios inside a feature run in sequence.

## Configuration

Precedence is **environment variable › `dotnet/.env` › `appsettings.json` › default**.
Every variable is listed in [docs/CONVENTIONS.md](../docs/CONVENTIONS.md#3-configuration-environment-variables).

```dotenv
# dotnet/.env (git-ignored)
BROWSER=firefox
HEADLESS=false
SLOW_MO=250
TRACE=on
VIDEO=retain-on-failure
```

## Reports

All output goes to `dotnet/reports/`, which is wiped before each `dotnet test`:

| Path                          | What                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `reports/allure-results/`     | Allure raw results + `environment.properties` → `allure serve reports/allure-results` |
| `reports/html/index.html`     | Reqnroll's Cucumber HTML report (self-contained, with screenshots) |
| `reports/cucumber/messages.ndjson` | Cucumber Messages stream (feed it to any Cucumber tool)      |
| `reports/junit/junit-results.xml` | JUnit XML for CI dashboards                                   |
| `reports/junit/results.trx`   | VSTest TRX (Azure DevOps / Visual Studio)                         |
| `reports/artifacts/`          | `screenshots/`, `traces/` (open at [trace.playwright.dev](https://trace.playwright.dev)), `videos/` |

Each failed scenario attaches a full-page screenshot and its Playwright trace to Allure and the
HTML report. API steps attach the request, the response metadata and the pretty-printed body.
Accessibility steps attach the full axe-core violation list.

## Layout

```
dotnet/
├── AutoPlaywright.slnx
├── global.json                  # .NET 10 SDK, rollForward latestFeature
├── Directory.Build.props        # nullable, analyzers, warnings-as-errors
├── test.runsettings             # NUnit workers + JUnit/TRX loggers
├── run-tests.sh / run-tests.ps1
├── Dockerfile                   # build context = repo root
└── AutoPlaywright.Specs/
    ├── reqnroll.json            # Allure plugin + HTML/Messages formatters
    ├── allureConfig.json
    ├── appsettings.json         # defaults
    ├── Support/                 # TestSettings, Paths, BrowserPool, ScenarioSession, Hooks, ReportAttachments
    ├── Pages/                   # Page Objects (Login, Inventory, Cart, Checkout, PlaywrightSite)
    └── Steps/                   # Step definitions, one class per domain
```

**Lifecycle.** One Playwright driver per process. A pool hands out one browser per concurrent
worker, launched only when a `@ui` scenario needs it. Each scenario gets a fresh `BrowserContext`
(1280×720, test-id attribute `data-test`) and its own `APIRequestContext`. Reqnroll's
context injection shares the per-scenario `ScenarioSession` between step classes.

> Reqnroll writes the generated code-behind to `obj/` (`ReqnrollUseIntermediateOutputPathForCodeBehind`),
> so the shared `features/` folder only ever contains `.feature` files.

## Docker

```bash
# from the repository root
docker build -f dotnet/Dockerfile -t autoplaywright-dotnet .
docker run --rm -e TAGS="@smoke" -e BROWSER=firefox \
  -v "$PWD/dotnet/reports:/app/dotnet/reports" autoplaywright-dotnet
```

## Lint

```bash
dotnet format --verify-no-changes
```
