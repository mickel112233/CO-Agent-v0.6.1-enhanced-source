---
name: quality-harness
description: Turn feature requests into testable plans, safe changes, regression tests, and evidence-based releases.
---

# Quality harness skill

## Before editing
- Inspect the repository status, package scripts, architecture, existing tests, and CI workflows.
- Define the intended behavior, non-goals, acceptance criteria, and likely regressions.
- Break work into small steps with explicit dependencies and ownership.

## During implementation
- Prefer focused changes compatible with existing conventions.
- Add regression tests for each bug and boundary condition, not only the happy path.
- Test invalid input, missing dependencies, timeouts, cancellation, path traversal, permissions, and platform-specific behavior when relevant.
- Keep secrets, real user data, and production credentials out of fixtures and logs.
- Never weaken security checks simply to make a test pass.

## Release gate
- Run the actual test and build commands when tools are available.
- Inspect diffs for accidental changes and run whitespace/lint checks if configured.
- Check Windows packaging separately from renderer compilation.
- Distinguish local results from CI results and pending jobs from completed jobs.
- Record exact commands, outcomes, known limitations, and recovery steps.
