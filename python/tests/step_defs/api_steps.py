from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from urllib.parse import urljoin

from pytest_bdd import then, when

from autopw.config import config
from tests.step_defs._patterns import n, q, step

if TYPE_CHECKING:
    from playwright.sync_api import APIRequestContext, APIResponse

    from tests.conftest import ApiState, Reporter


def _record(
    state: ApiState, reporter: Reporter, method: str, url: str, response: APIResponse, payload: Any = None
) -> None:
    text = response.text()
    try:
        body: Any = json.loads(text) if text else None
    except json.JSONDecodeError:
        body = text
    state.response, state.body = response, body
    reporter.json(
        f"{method} {url}",
        {
            "request": {"method": method, "url": urljoin(config.api_base_url, url), "body": payload},
            "response": {"status": response.status, "headers": response.headers, "body": body},
        },
    )


def _response(state: ApiState) -> APIResponse:
    if state.response is None:
        raise AssertionError("No request has been sent in this scenario yet")
    return state.response


@when(step(f"I send a GET request to {q('url')}"))
def send_get(api: APIRequestContext, api_state: ApiState, reporter: Reporter, url: str) -> None:
    _record(api_state, reporter, "GET", url, api.get(url))


@when(step(f"I send a POST request to {q('url')} with body:"))
def send_post(api: APIRequestContext, api_state: ApiState, reporter: Reporter, url: str, docstring: str) -> None:
    payload = json.loads(docstring)
    _record(api_state, reporter, "POST", url, api.post(url, data=payload), payload)


@then(step(f"the response status should be {n('status')}"), converters={"status": int})
def response_status(api_state: ApiState, status: int) -> None:
    actual = _response(api_state).status
    assert actual == status, f"expected HTTP {status}, got {actual}"


@then(step(f"the response header {q('header')} should contain {q('expected')}"))
def response_header(api_state: ApiState, header: str, expected: str) -> None:
    value = _response(api_state).headers.get(header.lower(), "")
    assert expected in value, f"header {header!r} = {value!r} does not contain {expected!r}"


@then(step(f"the response field {q('name')} should be {q('expected')}"))
def response_field(api_state: ApiState, name: str, expected: str) -> None:
    body = api_state.body
    assert isinstance(body, dict), f"response body is not a JSON object: {body!r}"
    assert name in body, f"response has no field {name!r}: {body!r}"
    assert str(body[name]) == expected, f"field {name!r} = {body[name]!r}, expected {expected!r}"


@then(step(f"the response should be a list of {n('count')} items"), converters={"count": int})
def response_list(api_state: ApiState, count: int) -> None:
    assert isinstance(api_state.body, list), f"response body is not a JSON array: {api_state.body!r}"
    assert len(api_state.body) == count, f"expected {count} items, got {len(api_state.body)}"
