@api
Feature: Posts REST API
  As an API consumer
  I want to read and create posts
  So that I can integrate with the blogging service

  @smoke
  Scenario: Retrieve a single post
    When I send a GET request to "/posts/1"
    Then the response status should be 200
    And the response header "content-type" should contain "application/json"
    And the response field "id" should be "1"
    And the response field "userId" should be "1"

  @regression
  Scenario: Filter posts by user
    When I send a GET request to "/posts?userId=1"
    Then the response status should be 200
    And the response should be a list of 10 items

  @regression
  Scenario: Create a post
    When I send a POST request to "/posts" with body:
      """json
      {
        "title": "Automated with Playwright",
        "body": "Created by a Cucumber scenario",
        "userId": 1
      }
      """
    Then the response status should be 201
    And the response field "title" should be "Automated with Playwright"
    And the response field "id" should be "101"

  @negative
  Scenario: Request a post that does not exist
    When I send a GET request to "/posts/99999"
    Then the response status should be 404
