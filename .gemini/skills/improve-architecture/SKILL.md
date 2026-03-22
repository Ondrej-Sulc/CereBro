---
name: improve-architecture
description: Systematic workflow for identifying architectural friction and refactoring shallow modules into "deep modules" to improve maintainability and testability. Use when the user asks for codebase improvements, refactoring, or when the system architecture feels overly complex or fragmented.
---

# Improve Architecture

This skill implements a workflow for deepening codebase architecture by identifying "shallow" modules and refactoring them into "deep modules" with simple interfaces and rich implementations.

## Core Principles

- **Deep Modules**: A module should provide significant functionality through a simple, stable interface. Complexity is hidden internally.
- **Information Hiding**: Encapsulate internal logic and state. The caller should not need to know "how" it works, only "what" it does.
- **Identify Friction**: Look for "shallow" areas where the interface is as complex as the implementation, or where a single concept is fragmented across many files.
- **Boundary Testing**: Prioritize testing the public interface (the boundary) rather than internal implementation details.

## Systematic Workflow

### 1. Discovery & Analysis
- **Explore**: Navigate the codebase to find fragmented concepts or shallow modules.
- **Identify Friction**: Pinpoint areas where understanding requires jumping between many files or where interfaces are leaky.
- **Candidates**: Present 2-3 specific refactoring candidates, explaining:
    - The "Cluster" of modules involved.
    - The source of the friction (coupling, fragmentation, etc.).
    - The expected impact on testability and maintenance.

### 2. Design Phase
Once a candidate is selected:
- **Frame the Problem**: Define the constraints and dependencies of the new module.
- **Propose 3+ Designs**:
    - **Minimalist**: Smallest possible API surface.
    - **Flexible**: Maximizes extensibility and use cases.
    - **Optimized**: Makes the most common usage trivial.
- **Recommendation**: Provide an opinionated recommendation on the best approach.

### 3. Implementation Plan
- **Map the Transition**: Outline the steps to migrate from the current state to the new deep module.
- **Test Strategy**: Identify which tests will be replaced by boundary tests.
- **Execution**: Apply the changes incrementally, maintaining a "Green" state whenever possible.

## Resources
- **Principles**: Refer to [references/principles.md](references/principles.md) for deeper theory on Information Hiding.
- **Checklist**: See [references/checklist.md](references/checklist.md) for evaluating architectural depth.
