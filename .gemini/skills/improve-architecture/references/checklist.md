# Evaluating Architectural Depth

## Identifying "Shallow" Modules
- [ ] Is the interface as complex as the internal implementation?
- [ ] Are internal data structures or implementation details leaked in the API?
- [ ] Does a change in logic often require changes to multiple files/modules?
- [ ] Is the module's main purpose to "coordinate" other modules without providing its own value?

## Evaluation Checklist
- [ ] **Small Interface**: Does the module have few public methods/properties?
- [ ] **Large Implementation**: Does it perform significant or complex work behind that interface?
- [ ] **Stable API**: Can the implementation change without breaking callers?
- [ ] **Information Hiding**: Are internal state and helper functions private/hidden?
- [ ] **AI Navigability**: Can an AI agent understand the module's purpose by reading only its public interface?

## Refactoring Signals
- **Fragile Tests**: Tests break during internal refactors despite behavior remaining the same.
- **Shotgun Surgery**: A single change requires touching many files across the codebase.
- **Boilerplate**: Callers must write excessive setup/teardown or boilerplate to use the module.
- **Deep Nesting**: The implementation is deeply nested or overly branching due to external state dependencies.
