@ui @demo
Feature: Framework demo - a tour of playwright.dev
  A self-contained showcase of what the framework does: navigation,
  role-based locators, web-first assertions, data-driven examples and
  screenshots attached to the report. Run it headed to watch it work.

  Background:
    Given I open the Playwright website

  @smoke
  Scenario: The home page introduces Playwright
    Then the page title should contain "Playwright"
    And I capture a screenshot named "playwright-home"

  @regression
  Scenario: Navigate from the home page to the installation guide
    When I click the "Get started" link
    Then the URL should contain "/docs/intro"
    And I should see the heading "Installation"
    And I capture a screenshot named "installation-guide"

  @regression
  Scenario Outline: Installation guide exists for <language>
    When I open the "<language>" installation guide
    Then the URL should contain "<path>"
    And I should see the heading "Installation"

    Examples:
      | language | path               |
      | Node.js  | /docs/intro        |
      | Python   | /python/docs/intro |
      | Java     | /java/docs/intro   |
      | .NET     | /dotnet/docs/intro |
