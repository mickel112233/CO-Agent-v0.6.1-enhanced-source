---
name: godot-game-development
description: Build maintainable Godot games with testable gameplay loops and reproducible project validation.
---

# Godot game development skill

## Inspect first
- Read project.godot and identify the engine version, render mode, input map, main scene, and current folder conventions.
- Inspect existing scenes and scripts before creating new systems. Avoid guessed node paths and APIs.
- Keep a runnable vertical slice before broadening scope.

## Implementation standards
- Use small scenes and focused scripts; use signals for decoupled events.
- Keep input, simulation, UI, persistence, and presentation responsibilities separate.
- Use typed GDScript where it improves clarity and catch null/missing-node assumptions.
- Make UI navigable by keyboard and gamepad where relevant.
- Keep save formats versioned and validate loaded data.
- Make gameplay tunable through exported properties/resources rather than scattered constants.

## Verification
- Define acceptance checks for movement, pause/restart, state transitions, scene changes, save/load, and win/loss behavior as applicable.
- Run the project's actual Godot headless/editor checks when the engine is available.
- If Godot is unavailable, state that clearly and run only tests that are possible.
- Never claim a scene was opened, game was played, or export succeeded without direct evidence.
