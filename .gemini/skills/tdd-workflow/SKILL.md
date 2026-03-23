---
name: tdd-workflow
description: Strict Red-Green-Refactor workflow for feature development and bug fixing. Use when the user wants to ensure high-quality, behavior-verified code by writing tests first.
---

# TDD Workflow

This skill implements a strict TDD approach to building features or fixing bugs, emphasizing behavior verification through public interfaces.

## Core Philosophy

- **Behavior over Implementation**: Tests verify *what* the system does, not *how* it does it.
- **Public Interfaces Only**: Exercise code through public APIs. Tests that break during internal refactoring are likely coupled to implementation and should be revised.
- **Vertical Slicing**: Use "tracer bullets"—one test, one implementation, repeat. Avoid writing all tests upfront.

## Workflow Phases

### 1. Planning (Mandatory)
Before writing any code:
- Identify the behavior to implement or bug to fix.
- Design the public interface (input/output).
- List and prioritize specific behaviors to be tested.
- **Ask**: "What should the public interface look like? Which behaviors are most important to test?"

### 2. The Cycle (Red-Green-Refactor)

#### Phase A: RED (Write a Failing Test)
- Write exactly ONE test for the next behavior.
- Verify it fails with a relevant error message (not just a syntax error).

#### Phase B: GREEN (Pass the Test)
- Write the absolute minimal code required to make the test pass.
- Do not anticipate future requirements or add speculative features.

#### Phase C: REFACTOR (Improve the Code)
- ONLY refactor when in a **GREEN** state.
- Improve code structure, readability, and performance without changing behavior.
- Run tests after every small refactor step to ensure no regressions.

## Checklist
Refer to [references/checklist.md](references/checklist.md) for a step-by-step cycle checklist.
