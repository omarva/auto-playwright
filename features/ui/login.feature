@ui @login
Feature: User authentication
  As a registered shopper
  I want to sign in to the store
  So that I can browse and buy products

  Background:
    Given I am on the login page

  @smoke
  Scenario: Successful login with valid credentials
    When I log in as "standard_user"
    Then I should see the products page
    And the header title should be "Products"

  @negative
  Scenario: Locked out user cannot log in
    When I log in as "locked_out_user"
    Then I should see the login error "Epic sadface: Sorry, this user has been locked out."

  @negative @regression
  Scenario Outline: Login is rejected for invalid credentials (<case>)
    When I log in with username "<username>" and password "<password>"
    Then I should see the login error "<error>"

    Examples:
      | case             | username      | password     | error                                                                     |
      | missing username |               | secret_sauce | Epic sadface: Username is required                                        |
      | missing password | standard_user |              | Epic sadface: Password is required                                        |
      | unknown user     | invalid_user  | wrong_pass   | Epic sadface: Username and password do not match any user in this service |

  @regression
  Scenario: User can log out
    When I log in as "standard_user"
    And I log out
    Then I should be on the login page
