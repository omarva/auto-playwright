@api @backend @todos
Feature: Todo API resources
  As an authenticated user of the Todo API
  I want to create, read, update and delete my todos
  So that I can keep track of my work

  Background:
    Given I use the "todo" API
    And I am authenticated as "alice" with password "wonderland"

  @smoke @e2e
  Scenario: Full CRUD lifecycle of a todo
    When I send a POST request to "/api/todos" with body:
      """json
      { "title": "Write Playwright tests" }
      """
    Then the response status should be 201
    And the response should match the "todo" schema
    And the response field "completed" should be "false"
    And the response header "location" should contain "/api/todos/"
    When I store the response field "id" as "todoId"
    And I send a GET request to "/api/todos/${todoId}"
    Then the response status should be 200
    And the response field "title" should be "Write Playwright tests"
    When I send a PATCH request to "/api/todos/${todoId}" with body:
      """json
      { "completed": true }
      """
    Then the response status should be 200
    And the response field "completed" should be "true"
    And the response field "title" should be "Write Playwright tests"
    When I send a PUT request to "/api/todos/${todoId}" with body:
      """json
      { "title": "Rewrite Playwright tests", "completed": false }
      """
    Then the response status should be 200
    And the response field "title" should be "Rewrite Playwright tests"
    And the response field "completed" should be "false"
    When I send a DELETE request to "/api/todos/${todoId}"
    Then the response status should be 204
    And the response body should be empty
    When I send a GET request to "/api/todos/${todoId}"
    Then the response status should be 404

  @regression
  Scenario: Created todos appear in the filtered list
    When I send a POST request to "/api/todos" with body:
      """json
      { "title": "Buy milk", "completed": true }
      """
    And I store the response field "id" as "doneId"
    And I send a GET request to "/api/todos?completed=true"
    Then the response status should be 200
    And the response should match the "todo-list" schema
    And the response should contain an item with field "id" equal to "${doneId}"
    And every item in the response should have field "completed" equal to "true"

  @negative
  Scenario: Users cannot see each other's todos
    When I send a POST request to "/api/todos" with body:
      """json
      { "title": "Alice's secret plan" }
      """
    And I store the response field "id" as "secretId"
    Given I am authenticated as "bob" with password "canwefixit"
    When I send a GET request to "/api/todos/${secretId}"
    Then the response status should be 404
    When I send a GET request to "/api/todos"
    Then the response should not contain an item with field "id" equal to "${secretId}"

  @negative
  Scenario: Invalid todos are rejected with every validation error
    When I send a POST request to "/api/todos" with body:
      """json
      { "title": "   ", "priority": "high" }
      """
    Then the response status should be 400
    And the response field "error" should be "Validation failed"
    And the response field "details" should contain "title is required"
    And the response field "details" should contain "priority is not allowed"

  @negative
  Scenario: Unknown todos return 404
    When I send a GET request to "/api/todos/999999"
    Then the response status should be 404
    And the response field "error" should be "Todo not found"

  @regression
  Scenario: Listing todos stays within the performance budget
    When I send a GET request to "/api/todos"
    Then the response status should be 200
    And the response time should be below 1000 ms
