Feature: model router behavior
  Scenario: preset switching persists the selected preset
    Given the router plugin is loaded from the fixture config
    When I run the "/preset openai" command
    Then the command output should mention preset switching
    And the persisted state should contain preset "openai"

  Scenario: budget mode switching persists the selected mode
    Given the router plugin is loaded from the fixture config
    When I run the "/mode budget" command
    Then the command output should mention budget mode switching
    And the persisted state should contain mode "budget"

  Scenario: agent registration is derived from the active fixture preset
    Given the router plugin is loaded from the fixture config
    When I register router agents
    Then the registered agents should match the active fixture preset
    And the router commands should be registered

  Scenario: malformed persisted state does not block plugin startup
    Given the router plugin is loaded with malformed persisted state
    When I register router agents
    Then the registered agents should match the active fixture preset

  Scenario: agent registration does not depend on provider metadata
    Given the router plugin is loaded from the fixture config
    When I register router agents without provider metadata
    Then the registered agents should match the active fixture preset
    And the router commands should be registered

  Scenario: system prompt contains the required routing sections
    Given the router plugin is loaded from the fixture config
    When I transform the system prompt for an anthropic orchestrator
    Then the system prompt should include the required routing sections

  Scenario: subagent enforcement banners expose cap and redundancy semantics
    Given the router plugin is loaded from the fixture config
    When I dispatch a fast subagent with cap 2 and repeat the same read
    Then the enforcement output should include cap tracking and redundancy warnings
