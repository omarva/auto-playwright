"""Generic, keyword-agnostic API step library (docs/CONVENTIONS.md section 7)."""

from __future__ import annotations

import json
import re
import time
from functools import cache
from typing import TYPE_CHECKING, Any

import pytest
from jsonschema import Draft7Validator
from playwright.sync_api import Error as PlaywrightError
from pytest_bdd import step as bdd_step

from autopw.config import PROJECT_DIR, config
from tests.step_defs._patterns import n, q, step

if TYPE_CHECKING:
    from playwright.sync_api import APIRequestContext

    from tests.conftest import ApiState, Reporter

SCHEMAS_DIR = PROJECT_DIR.parent / "features" / "schemas"
METHODS = "GET|POST|PUT|PATCH|DELETE"
BODY_METHODS = "POST|PUT|PATCH"
_VARIABLE = re.compile(r"\$\{(\w+)\}")
_MISSING = object()


# --------------------------------------------------------------------------- helpers


def render(value: Any) -> str:
    """Strings render raw; every other JSON value renders as compact JSON (``true``, ``1``, ``null``)."""
    return value if isinstance(value, str) else json.dumps(value, separators=(",", ":"))


def interpolate(state: ApiState, text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in state.variables:
            raise KeyError(f"Unknown scenario variable ${{{name}}}; known: {sorted(state.variables)}")
        return state.variables[name]

    return _VARIABLE.sub(replace, text)


def lookup(data: Any, path: str) -> Any:
    """Resolve a dot path (numeric segments index arrays); returns ``_MISSING`` if absent."""
    current = data
    for segment in path.split("."):
        if isinstance(current, list) and segment.isdigit() and int(segment) < len(current):
            current = current[int(segment)]
        elif isinstance(current, dict) and segment in current:
            current = current[segment]
        else:
            return _MISSING
    return current


def field_value(state: ApiState, path: str) -> Any:
    value = lookup(state.body, path)
    if value is _MISSING:
        raise AssertionError(f"Response has no field {path!r}: {state.text[:500]}")
    return value


def items(state: ApiState) -> list[Any]:
    if not isinstance(state.body, list):
        raise AssertionError(f"Response body is not a JSON array: {state.text[:500]}")
    return state.body


def item_matches(item: Any, path: str, expected: str) -> bool:
    value = lookup(item, path)
    return value is not _MISSING and render(value) == expected


@cache
def schema_validator(name: str) -> Draft7Validator:
    path = SCHEMAS_DIR / f"{name}.schema.json"
    if not path.is_file():
        raise FileNotFoundError(f"No schema {name!r} at {path}")
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema)


def send(
    api: APIRequestContext,
    state: ApiState,
    reporter: Reporter,
    method: str,
    path: str,
    body: str | None = None,
) -> None:
    url = state.base_url.rstrip("/") + interpolate(state, path)
    headers = {"Accept": "application/json"}
    if state.token:
        headers["Authorization"] = f"Bearer {state.token}"
    payload: Any = None
    if body is not None:
        payload = json.loads(interpolate(state, body))
        headers["Content-Type"] = "application/json"
    started = time.perf_counter()
    response = api.fetch(url, method=method, headers=headers, data=payload)
    text = response.text()
    state.duration_ms = (time.perf_counter() - started) * 1000
    state.response, state.text = response, text
    try:
        state.body = json.loads(text) if text else None
    except json.JSONDecodeError:
        state.body = text
    reporter.json(
        f"{method} {url}",
        {
            "request": {"method": method, "url": url, "body": payload},
            "response": {
                "status": response.status,
                "headers": response.headers,
                "body": state.body,
                "durationMs": round(state.duration_ms, 1),
            },
        },
    )


def _login(api: APIRequestContext, state: ApiState, reporter: Reporter, username: str, password: str) -> None:
    body = json.dumps({"username": username, "password": password})
    send(api, state, reporter, "POST", "/api/auth/login", body)


# --------------------------------------------------------------------------- services & auth


@bdd_step(step(f"I use the {q('service')} API"))
def use_service(api: APIRequestContext, api_state: ApiState, service: str) -> None:
    if service == "jsonplaceholder":
        api_state.base_url = config.api_base_url
        return
    if service != "todo":
        raise ValueError(f"Unknown API service {service!r}; expected 'jsonplaceholder' or 'todo'")
    api_state.base_url = config.backend_url
    health = config.backend_url.rstrip("/") + "/health"
    try:
        healthy = api.get(health, timeout=3000).ok
    except PlaywrightError:
        healthy = False
    if not healthy:
        message = f"Todo API is not running at {config.backend_url} - start it with `node backend/server.mjs`"
        if config.backend_required:
            pytest.fail(message)
        pytest.skip(message)


@bdd_step(step(f"I log in to the API as {q('username')} with password {q('password')}"))
def log_in(api: APIRequestContext, api_state: ApiState, reporter: Reporter, username: str, password: str) -> None:
    _login(api, api_state, reporter, username, password)


@bdd_step(step(f"I am authenticated as {q('username')} with password {q('password')}"))
def authenticate(api: APIRequestContext, api_state: ApiState, reporter: Reporter, username: str, password: str) -> None:
    api_state.token = None
    _login(api, api_state, reporter, username, password)
    assert api_state.response is not None
    assert api_state.response.status == 200, f"login as {username!r} failed: {api_state.text[:500]}"
    api_state.token = render(field_value(api_state, "token"))


@bdd_step("I am not authenticated")
def not_authenticated(api_state: ApiState) -> None:
    api_state.token = None


@bdd_step(step(f"I use the bearer token {q('token')}"))
def use_token(api_state: ApiState, token: str) -> None:
    api_state.token = token


# --------------------------------------------------------------------------- requests


@bdd_step(step(f"I send a (?P<method>{METHODS}) request to {q('path')}"))
def send_request(api: APIRequestContext, api_state: ApiState, reporter: Reporter, method: str, path: str) -> None:
    send(api, api_state, reporter, method, path)


@bdd_step(step(f"I send a (?P<method>{BODY_METHODS}) request to {q('path')} with body:"))
def send_request_with_body(
    api: APIRequestContext, api_state: ApiState, reporter: Reporter, method: str, path: str, docstring: str
) -> None:
    send(api, api_state, reporter, method, path, docstring)


@bdd_step(step(f"I store the response field {q('path')} as {q('name')}"))
def store_field(api_state: ApiState, path: str, name: str) -> None:
    api_state.variables[name] = render(field_value(api_state, path))


# --------------------------------------------------------------------------- assertions


@bdd_step(step(f"the response status should be {n('status')}"), converters={"status": int})
def response_status(api_state: ApiState, status: int) -> None:
    assert api_state.response is not None, "No request has been sent in this scenario yet"
    actual = api_state.response.status
    assert actual == status, f"expected HTTP {status}, got {actual}: {api_state.text[:500]}"


@bdd_step(step(f"the response header {q('header')} should contain {q('expected')}"))
def response_header(api_state: ApiState, header: str, expected: str) -> None:
    assert api_state.response is not None, "No request has been sent in this scenario yet"
    expected = interpolate(api_state, expected)
    value = api_state.response.headers.get(header.lower(), "")
    assert expected in value, f"header {header!r} = {value!r} does not contain {expected!r}"


@bdd_step(step(f"the response field {q('path')} should be {q('expected')}"))
def field_equals(api_state: ApiState, path: str, expected: str) -> None:
    expected = interpolate(api_state, expected)
    actual = render(field_value(api_state, path))
    assert actual == expected, f"field {path!r} = {actual!r}, expected {expected!r}"


@bdd_step(step(f"the response field {q('path')} should not be empty"))
def field_not_empty(api_state: ApiState, path: str) -> None:
    value = field_value(api_state, path)
    assert value is not None, f"field {path!r} is null"
    assert render(value) != "", f"field {path!r} is empty"


@bdd_step(step(f"the response field {q('path')} should contain {q('expected')}"))
def field_contains(api_state: ApiState, path: str, expected: str) -> None:
    expected = interpolate(api_state, expected)
    value = field_value(api_state, path)
    if isinstance(value, list):
        rendered = [render(v) for v in value]
        assert expected in rendered, f"field {path!r} = {rendered!r} has no element {expected!r}"
    else:
        assert expected in render(value), f"field {path!r} = {render(value)!r} does not contain {expected!r}"


@bdd_step(step(f"the response should be a list of {n('count')} items"), converters={"count": int})
def list_length(api_state: ApiState, count: int) -> None:
    actual = len(items(api_state))
    assert actual == count, f"expected {count} items, got {actual}"


@bdd_step(step(f"every item in the response should have field {q('path')} equal to {q('expected')}"))
def every_item(api_state: ApiState, path: str, expected: str) -> None:
    expected = interpolate(api_state, expected)
    elements = items(api_state)
    assert elements, "response array is empty"
    mismatches = [i for i, item in enumerate(elements) if not item_matches(item, path, expected)]
    assert not mismatches, f"items {mismatches} do not have {path!r} = {expected!r}"


@bdd_step(step(f"the response should contain an item with field {q('path')} equal to {q('expected')}"))
def contains_item(api_state: ApiState, path: str, expected: str) -> None:
    expected = interpolate(api_state, expected)
    found = any(item_matches(item, path, expected) for item in items(api_state))
    assert found, f"no item has {path!r} = {expected!r}"


@bdd_step(step(f"the response should not contain an item with field {q('path')} equal to {q('expected')}"))
def not_contains_item(api_state: ApiState, path: str, expected: str) -> None:
    expected = interpolate(api_state, expected)
    found = any(item_matches(item, path, expected) for item in items(api_state))
    assert not found, f"an item unexpectedly has {path!r} = {expected!r}"


@bdd_step(step(f"the response should match the {q('name')} schema"))
def matches_schema(api_state: ApiState, reporter: Reporter, name: str) -> None:
    errors = sorted(schema_validator(name).iter_errors(api_state.body), key=lambda e: list(map(str, e.absolute_path)))
    problems = [f"{'/'.join(str(p) for p in error.absolute_path) or '<root>'}: {error.message}" for error in errors]
    if problems:
        reporter.json(f"schema violations ({name})", problems)
    assert not problems, f"Response does not match schema {name!r}:\n" + "\n".join(problems)


@bdd_step(step(f"the response time should be below {n('limit')} ms"), converters={"limit": int})
def response_time(api_state: ApiState, limit: int) -> None:
    assert api_state.duration_ms < limit, f"response took {api_state.duration_ms:.0f} ms (budget {limit} ms)"


@bdd_step("the response body should be empty")
def body_empty(api_state: ApiState) -> None:
    assert api_state.text == "", f"expected an empty body, got {api_state.text[:500]!r}"
