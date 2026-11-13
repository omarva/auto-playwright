@ui @a11y
Feature: Accessibility
  As a shopper using assistive technology
  I want the store to meet WCAG 2.1 AA
  So that I can shop independently

  The scan uses axe-core restricted to the WCAG 2.0/2.1 A and AA rule sets.
  Serious and critical violations fail the scenario; the full axe result is
  attached to the report either way.

  @regression
  Scenario: Login page has no serious accessibility violations
    Given I am on the login page
    Then the page should have no serious accessibility violations

  @regression
  Scenario: Product catalogue has no serious accessibility violations
    Given I am logged in as "standard_user"
    Then the page should have no serious accessibility violations
