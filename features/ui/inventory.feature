@ui @inventory
Feature: Product catalogue
  As a shopper
  I want to browse and sort the catalogue
  So that I can quickly find the product I want

  Background:
    Given I am logged in as "standard_user"

  @smoke
  Scenario: Catalogue lists all products
    Then I should see 6 products

  @regression
  Scenario Outline: Sort products by <option>
    When I sort products by "<option>"
    Then the products should be sorted by "<field>" in "<order>" order

    Examples:
      | option              | field | order      |
      | Name (A to Z)       | name  | ascending  |
      | Name (Z to A)       | name  | descending |
      | Price (low to high) | price | ascending  |
      | Price (high to low) | price | descending |
