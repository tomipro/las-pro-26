# Copilot Coding Instructions

> Applies to all code generation in this repo.
> Stack: React + Python + CSS.

## Core

- Prioritize clarity and maintainability; be explicit over clever.
- Follow SOLID and GRASP principles.
- Keep modules and functions small and single-purpose.
- Prefer composition and dependency injection over deep inheritance.
- Use type hints in Python; keep React components functional with hooks.
- Avoid side effects in render paths; isolate effects and I/O.

## Python

- Use dataclasses (or Pydantic) for plain data containers.
- Raise and catch specific exceptions; fail loudly.
- Avoid positional args beyond 2-3 params; prefer keyword args.
- Name modules for their domain; avoid generic utils dumping grounds.

## React

- One component, one responsibility; extract logic into hooks.
- Keep state local unless sharing is necessary.
- Avoid premature memoization; measure first.

## CSS

- Prefer CSS Modules for component scope.
- Define reusable tokens on :root; avoid magic numbers.
- No !important; fix specificity instead.

## Universal

- Avoid deep nesting; use guard clauses.
- Replace repeated conditionals on type with polymorphism.
- No commented-out code in commits.