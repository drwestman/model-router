Feature: Codex plugin bundle

  Scenario: Minimal Codex plugin assets are packaged safely
    Given the Codex plugin bundle is available
    When I inspect the Codex plugin bundle assets
    Then the manifest should use safe relative plugin paths
    And the routing skill should be present
    And the repo should define Codex router agents
    And the hooks file should define a SessionStart hook
    And the Codex package files should avoid scaffold-only wording
    And importing the Codex package entrypoint should not throw
