---
name: tdd-workflow
description: Use when implementing a feature test-first or running adversarial TDD (keywords test, TDD, implement feature, acceptance criteria). Drives the 3-agent Spec/Codegen/Review pattern.
---

# Adversarial TDD

If the same mind writes tests and implementation, the tests assert what the code does, not what it should do. Separate the roles.

## Three agents
1. **Spec-Agent** (read-only, no access to existing impl): reads the feature/issue, writes tests covering edge cases + acceptance criteria. Output: test files only.
2. **Codegen-Agent** (edit-capable, scoped to `src/` and `tests/` but may NOT modify tests): implements until all Spec tests pass.
3. **Review-Agent** (read-only): checks consistency between tests, implementation, and existing architecture (CLAUDE.md). May veto with reasons → loop back to Codegen.

## Order
Spec → Codegen → Review. Never let Codegen weaken a test to make it pass; failing tests go back as a fix request.

## Tie to principles
- Spec encodes the *contract* (types + signatures first).
- Codegen does the simplest thing that passes (Make it Work).
- Review enforces separation, parse-at-boundary, immutability (Make it Right).

## Orchestration
Run via the Task tool / subagents (see `subagent-orchestration`); up to 3 in the adversarial loop. Tests are quality gates, not alibi coverage — target the elevated logic-error rate of AI code.
