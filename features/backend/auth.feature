@api @backend @auth
Feature: Todo API authentication
  As a client of the bundled Todo API (see backend/)
  I want to exchange credentials for a JWT bearer token
  So that only authenticated users can reach their data

  Background:
    Given I use the "todo" API

  @smoke
  Scenario: Log in with valid credentials
    When I log in to the API as "alice" with password "wonderland"
    Then the response status should be 200
    And the response should match the "login-response" schema
    And the response field "tokenType" should be "Bearer"
    And the response field "token" should not be empty
    And the response field "user.username" should be "alice"

  @negative
  Scenario Outline: Invalid credentials are rejected (<case>)
    When I log in to the API as "<username>" with password "<password>"
    Then the response status should be 401
    And the response field "error" should be "Invalid username or password"

    Examples:
      | case           | username | password   |
      | wrong password | alice    | nope       |
      | unknown user   | mallory  | wonderland |
      | empty password | bob      |            |

  @regression
  Scenario: An authenticated user can read their profile
    Given I am authenticated as "alice" with password "wonderland"
    When I send a GET request to "/api/me"
    Then the response status should be 200
    And the response field "username" should be "alice"
    And the response field "name" should be "Alice Liddell"

  @negative
  Scenario: Protected endpoints require a token
    Given I am not authenticated
    When I send a GET request to "/api/todos"
    Then the response status should be 401
    And the response header "www-authenticate" should contain "Bearer"
    And the response field "error" should be "Missing bearer token"

  @negative
  Scenario: A forged token is rejected
    Given I use the bearer token "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged-signature"
    When I send a GET request to "/api/me"
    Then the response status should be 401
    And the response field "error" should be "Invalid or expired token"
