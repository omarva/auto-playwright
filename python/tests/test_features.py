"""Binds every shared feature file (../features) to pytest-bdd test functions."""

from pytest_bdd import scenarios

scenarios("ui", "api", "backend", "demo")
