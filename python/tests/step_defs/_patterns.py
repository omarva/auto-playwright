"""Helpers that build step regexes accepting empty quoted strings (``""``).

Scenario Outline placeholders are rendered into the step text before matching, so an
empty example cell becomes ``""`` - ``parsers.parse`` cannot match that, regexes can.
"""

from __future__ import annotations

from typing import Any

from pytest_bdd import parsers


def q(name: str) -> str:
    """A double-quoted string argument, possibly empty."""
    return f'"(?P<{name}>[^"]*)"'


def n(name: str) -> str:
    """An integer argument."""
    return f"(?P<{name}>\\d+)"


def step(text: str) -> Any:
    """Compile ``text`` (already containing ``q()``/``n()`` groups) into a full-match parser."""
    return parsers.re(f"^{text}$")
