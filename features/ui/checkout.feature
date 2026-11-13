@ui @checkout
Feature: Checkout
  As a shopper
  I want to pay for the products in my cart
  So that they are shipped to me

  Background:
    Given I am logged in as "standard_user"
    And I have added "Sauce Labs Backpack" to the cart

  @smoke @e2e
  Scenario: Complete a purchase end to end
    When I proceed to checkout
    And I enter first name "Ada", last name "Lovelace" and postal code "10001"
    And I continue to the order overview
    Then the order item total should be "$29.99"
    When I finish the checkout
    Then I should see the order confirmation "Thank you for your order!"

  @negative @regression
  Scenario Outline: Checkout requires customer information (<case>)
    When I proceed to checkout
    And I enter first name "<first>", last name "<last>" and postal code "<zip>"
    And I continue to the order overview
    Then I should see the checkout error "<error>"

    Examples:
      | case                | first | last     | zip   | error                          |
      | missing first name  |       | Lovelace | 10001 | Error: First Name is required  |
      | missing last name   | Ada   |          | 10001 | Error: Last Name is required   |
      | missing postal code | Ada   | Lovelace |       | Error: Postal Code is required |
