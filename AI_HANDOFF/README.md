# CO-Agent AI handoff

This folder is the durable project notebook for future coding agents. Read these files before changing architecture or UI.

## Required reading
1. `IMPLEMENTATION_STATUS.md` — what is implemented, what remains, and verification rules.
2. `CHANGELOG.md` — changes made in this integration branch.
3. `NEXT_AGENT_TASKS.md` — ordered work plan with acceptance criteria.

## Rules for future agents
- Preserve existing CO-Agent features, assets, tests, and user data.
- Do not claim a feature is implemented unless code exists and tests or a reproducible manual check prove it.
- Prefer small commits, one coherent feature at a time; run `npm test` and `npm run build` after each meaningful piece.
- Do not execute imported repository scripts or arbitrary shell commands automatically. Scan first, show the plan, require approval, and run in a restricted child process with timeouts.
- Computer-use tasks must plan first and request user approval before input actions. Never treat model-generated text as an approval.
- The pet overlay is an optional companion surface, not a replacement for the main chat or system controls.
- Use LuxTTS as the requested TTS target; do not silently substitute Piper.
- Keep API keys in the OS credential store or an encrypted secret store; never write secrets to logs or handoff docs.
- Avoid destructive Git operations and never force-push shared branches.
