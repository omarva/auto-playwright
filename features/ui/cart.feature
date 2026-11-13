@ui @cart
Feature: Shopping cart
  As a shopper
  I want to manage the products in my cart
  So that I only buy what I need

  Background:
    Given I am logged in as "standard_user"

  @smoke
  Scenario: Add a product to the cart
    When I add "Sauce Labs Backpack" to the cart
    Then the cart badge should show 1

  @regression
  Scenario: Add multiple products to the cart
    When I add the following products to the cart:
      | Sauce Labs Backpack     |
      | Sauce Labs Bike Light   |
      | Sauce Labs Bolt T-Shirt |
    And I open the cart
    Then the cart badge should show 3
    And the cart should contain:
      | Sauce Labs Backpack     |
      | Sauce Labs Bike Light   |
      | Sauce Labs Bolt T-Shirt |

  @regression
  Scenario: Remove a product from the cart
    Given I have added "Sauce Labs Backpack" to the cart
    When I remove "Sauce Labs Backpack" from the cart
    Then the cart badge should not be visible
