# 🐍 Python · Playwright + pytest-bdd

[pytest-bdd](https://pytest-bdd.readthedocs.io) runs the shared [`../features`](../features)
Gherkin (Cucumber syntax) on Playwright's sync API. You also get the pytest
ecosystem: xdist parallelism, reruns, fixtures and plugins.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
playwright install --with-deps                       # first time only
pytest                                               # full suite, headless, 2 workers
pytest --demo                                        # watch the @demo tour in a real browser
allure serve reports/allure-results                  # open the Allure report
```

## Selecting scenarios

Gherkin tags become pytest markers, so you can pass a Cucumber tag expression in `TAGS`
or use pytest's `-m` directly:

```bash
TAGS="@smoke and not @api" pytest
pytest -m "cart or checkout" -n 4
BROWSER=webkit RETRIES=1 pytest
```

The `PARALLEL`, `RETRIES` and `TAGS` variables map onto `-n`, `--reruns` and `-m`
unless you pass those flags yourself. All other variables are described in
[CONVENTIONS.md](../docs/CONVENTIONS.md#3-configuration-environment-variables).

## Layout

```
src/autopw/
├── config.py            typed, validated environment config
└── pages/               page objects (login, inventory, cart, checkout, playwright.dev)
tests/
├── conftest.py          fixtures (browser, context, page, api), hooks, evidence capture
├── test_features.py     binds ../features via pytest-bdd scenarios()
└── step_defs/           auth, shop, api, demo (+ accessibility) step definitions
```

## Reports

| Output                                 | Produced by                     |
| -------------------------------------- | ------------------------------- |
| `reports/allure-results/`              | allure-pytest-bdd               |
| `reports/html/index.html`              | pytest-html (self-contained, screenshots embedded) |
| `reports/cucumber/cucumber.json`       | pytest-bdd `--cucumberjson`     |
| `reports/junit/pytest-junit.xml`       | pytest `--junitxml`             |
| `reports/artifacts/{screenshots,traces,videos}` | conftest fixtures      |

## Quality gates

```bash
ruff check . && ruff format --check . && mypy
```

mypy runs in `strict` mode and ruff enforces pyflakes, bugbear, pyupgrade, pylint and
more.

## Docker

```bash
# from the repository root
docker build -f python/Dockerfile -t auto-playwright-py .
docker run --rm -e TAGS=@smoke -v "$PWD/python/reports:/app/python/reports" auto-playwright-py
```
