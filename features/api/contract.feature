@api @contract
Feature: JSONPlaceholder API contract
  As an API consumer
  I want responses to honour a published contract
  So that my integration does not break silently

  Every schema lives in features/schemas/ and is shared by all four languages.

  @smoke
  Scenario: A post matches the post schema
    When I send a GET request to "/posts/1"
    Then the response status should be 200
    And the response should match the "post" schema
    And the response time should be below 5000 ms

  @regression
  Scenario: The post list matches the post-list schema
    When I send a GET request to "/posts"
    Then the response status should be 200
    And the response should match the "post-list" schema
    And the response should be a list of 100 items

  @regression
  Scenario: A user exposes a nested address and company
    When I send a GET request to "/users/1"
    Then the response status should be 200
    And the response should match the "user" schema
    And the response field "address.city" should be "Gwenborough"
    And the response field "address.geo.lat" should be "-37.3159"
    And the response field "company.name" should be "Romaguera-Crona"

  @regression
  Scenario: Comments belong to their post
    When I send a GET request to "/posts/1/comments"
    Then the response status should be 200
    And the response should be a list of 5 items
    And every item in the response should have field "postId" equal to "1"
    And the response field "0.email" should be "Eliseo@gardner.biz"
