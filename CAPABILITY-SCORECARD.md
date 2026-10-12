# CO-Agent capability scorecard and competitive gap analysis

**Assessment date:** 12 October 2026  
**Scope:** The source on `codex/full-application-hardening`, not a hands-on benchmark of every installed build. Scores are an evidence-based engineering judgment, not a vendor benchmark or a claim of feature parity.

## Executive score

**Overall: 5.4/10 — a promising local-first desktop foundation, not yet a leading autonomous agent.**

The strongest differentiator is the combination of local Ollama chat, a Windows-native computer-use approval surface, workspace file proposals, and a real FFmpeg timeline MVP in one desktop app. The biggest limitation is that these are separate, shallow workflows: agent steps are user-started, computer use is one approved action at a time, chat now streams with cancellation and partial-response recovery, and the video editor lacks many expected editing tools. The app should compete on privacy, understandable approvals, and creator/developer workflow integration—not on autonomy or breadth yet.

| Dimension | Score / 10 | Weight | Evidence and reasoning |
|---|---:|---:|---|
| Local-first privacy and control | 8.0 | 15% | Ollama runs locally; selected workspace context is bounded; skills are treated as untrusted; writes and desktop input require approval. Optional API providers necessarily send conversation text to the chosen provider. |
| Chat and model flexibility | 7.0 | 12% | Ollama plus OpenAI-compatible, Anthropic, and Gemini API paths; provider requests now preserve user/assistant turn roles. Streaming local Ollama and API chat now preserves partial output on interruption; no built-in model installation or provider key vault. |
| Agent planning and execution | 4.0 | 20% | Dependency-aware plans, specialist roles, review/test steps, bounded delegation primitives, and user-approved file proposals exist. Each workflow step is user-started; durable approved-plan run history, dependency checkpoints, pause/resume/cancel, approval checkpoints, and bounded retries are now implemented. No autonomous loop, parallel workers, patch-based edits, or automatic recovery loop. |
| Desktop computer use | 4.5 | 12% | Windows screenshot, accessibility-window inspection, optional OCR, bounded plans, and approval-gated click/type/key actions. A new local vision-model comparison assesses before/after screenshots after an approved action, with conservative status/confidence/evidence and manual-review caveats; no semantic element actions or fully autonomous control loop. |
| Video and creative workflows | 4.8 | 10% | Real multi-track timeline MVP, project save/load, captions/titles, undo/redo, FFmpeg progress and cancellation, atomic temporary output, FFprobe duration/video validation, and expected-audio-stream checks. Still missing transitions, keyframes, effects, waveforms, audio routing, proxies, color grading, and transcription. |
| Integrations and extensibility | 3.0 | 10% | Public GitHub repository/skill import, optional OCR/Hyperframes/Piper, and a fixed developer-terminal preset list. No general MCP client, broad app connectors, or unified ACP agent adapters are implemented in this reconstruction. |
| Security and permission model | 7.0 | 10% | Context isolation, IPC sender checks, path/symlink/secret filtering, explicit file-write and native input approvals, bounded outputs, and tests. Security is not a sandbox: approved project scripts run with the user's OS permissions, and a compromised user session remains a risk. |
| Reliability and testability | 6.0 | 8% | Node regression suite, Windows/Ubuntu test and renderer-build CI, Windows installer packaging, artifact checks, and export-duration tests. No real-device end-to-end suite, coverage threshold, signed installer, or broad media fixture matrix. |
| UX, setup, and accessibility | 5.0 | 3% | Functional desktop UI with recent chats, model settings, studio, agents, and computer use. Setup still depends on external Ollama/runtime configuration; streaming and polished progress/recovery are incomplete. |

**Weighted score:** approximately **5.8/10 (provisional; durable workflow state, streaming chat, local outcome assessment, and render progress/cancellation have regression coverage, but real-device end-to-end testing remains absent).** Weighting intentionally emphasizes agent execution, local control, and reliability rather than counting menu items.

## Comparison with current alternatives

These are capability comparisons from public project/documentation pages, not a claim that the products have identical goals or were all tested in the same environment.

| Capability | CO-Agent in this branch | Established alternatives | What CO-Agent should do next |
|---|---|---|---|
| Desktop computer control | Windows-only, approval per action, screenshot/OCR/accessibility inspection | OpenAI and Anthropic document computer-use flows that repeatedly observe a screen, dispatch structured actions, and return observations to the model; both stress approval, bounded execution, and treating screen content as untrusted. | Build a controlled observe → propose → approve → act → verify loop, with cancellation, action history, and target/outcome checks. Do not remove approvals to imitate “full auto.” |
| Coding-agent execution | User-started planner steps, fixed terminal presets, selected-file context, full-file proposals | OpenHands describes local/remote backends, multiple agents, MCP and integrations, and workflow automations. | Prioritize patch/diff proposals, test execution tied to acceptance criteria, reliable recovery, Git worktree isolation as an optional mode, and an auditable run log. |
| Multi-agent workspace | Specialist role prompts; no parallel sessions | AionUi advertises multiple agent/CLI integrations, parallel sessions, MCP management, and ready-made assistants. | Add one provider/agent adapter interface first, then one integration at a time. Avoid adding dozens of integrations before the execution contract is reliable. |
| Local chat | Ollama, with local inference and installed model management | Ollama's chat API supports streamed messages and conversation roles; many desktop clients expose token-by-token output. | Add incremental streaming, Stop generation, first-token latency/progress, and robust partial-response recovery. |
| Video editing | Functional timeline/export MVP | Dedicated editors offer deep timelines, audio tools, transitions, effects, color controls, keyframes, proxies, and undo/redo. | Add undo/redo and render progress/cancel first, then audio correctness/waveforms and transforms. Do not claim professional-editor parity until real projects pass media regression tests. |
| Security | Local-first with explicit action/write approval and path checks | OpenAI and Anthropic computer-use guidance stresses untrusted screen content, restricted access, confirmation for consequential actions, and bounded/verified runs. | Keep native approvals, add an audit trail and per-action risk classes, and make the user-visible scope clear before every consequential operation. |
| Automation | No scheduled/background automation | OpenHands and AionUi publicly describe scheduled/event-driven automation and remote control/integrations. | Defer unattended automation until pause/cancel, durable logs, policy boundaries, and recovery are tested. |

### Sources checked

- OpenAI, [Computer use guide](https://developers.openai.com/api/docs/guides/tools-computer-use): structured computer-use execution, origin approval, outcome verification, and treating website content as untrusted.
- Anthropic, [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool): screenshot/mouse/keyboard interaction and security considerations.
- Anthropic, [How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works): client tool calls require an application execution loop and tool results.
- OpenHands, [GitHub project](https://github.com/OpenHands/OpenHands) and [Agent Canvas](https://www.openhands.dev/product/canvas): multi-agent integrations, local/remote backends, worktrees, and automation.
- AionUi, [project README](https://github.com/iOfficeAI/AionUi): multi-agent/CLI integration, parallel sessions, MCP management, and assistant presets.
- Ollama, [API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md): conversation-role messages and streaming chat responses.

## Highest-value improvements, ordered by impact

### P0 — make current features dependable

1. **Streaming chat for local and API providers:** incremental rendering, Stop, bounded buffers, cancellation propagation, and partial-response error recovery (implementation and regression tests added; validate fresh CI before treating as released).
2. **Agent run state machine:** persist approved plans and step transitions, pause/resume/cancel, bounded retries, dependency checkpoints, and a capped event log. The run store is implemented; wire the Agents UI to it and validate crash recovery next.
3. **Outcome verification:** every file operation should report changed paths and test results; computer actions should capture a fresh observation and check whether the intended state changed.
4. **Security audit trail:** show exactly which files/context go to a provider, which process command runs, what permissions are requested, and why an action needs approval.
5. **Release and app-level tests:** Electron startup smoke test, packaged-app launch test on Windows, renderer interaction tests, and a media fixture suite that validates duration, streams, and audio/video sync. Timeline rendering now reports progress, supports cancellation, removes partial output on failure, preserves a prior export, and checks expected audio streams.

### P1 — close the biggest competitive gaps

6. **Patch-first file edits:** generate unified diffs, show before/after, allow per-file accept/reject, and provide rollback.
7. **Video editing basics:** undo/redo, snapping, transform controls, audio waveform, source audio routing, render progress/cancel, and reliable audio/video synchronization.
8. **Accessibility-first computer use:** UI Automation element tree and semantic actions where possible, coordinate fallback, multi-monitor awareness, and post-action checks.
9. **Provider architecture:** common provider interface, credential storage using OS facilities, model capability metadata, request budgets, and clear local-vs-cloud disclosure.
10. **Setup recovery:** diagnose Ollama missing/offline, detect hardware/model fit, explain disk and memory requirements, offer retry/manual setup, and return to the app without trapping users in setup.

### P2 — only after reliability improves

11. MCP client and curated connectors, then ACP-compatible external agents.
12. Optional scheduled tasks with explicit schedules, pause/cancel, logs, and safe defaults.
13. Creative pipelines for captions/transcription, motion graphics, and export presets.
14. Automated benchmark harness: fixed tasks, success criteria, repeat runs, latency, failures, resource use, and regression comparisons.

## Scoring rules and limits

- A feature earns credit only when the repository implements it and the boundary is documented; a menu, prompt, or roadmap entry alone is not evidence.
- The score does not measure model intelligence, real-world task success, privacy compliance certification, or the performance of the user's particular PC.
- The score should be recalculated after running a reproducible benchmark suite on the packaged Windows app, not merely after adding code.
- **Do not market CO-Agent as a replacement for OpenHands, AionUi, a full computer-use agent, or a professional video editor yet.** Market it as a local-first desktop workspace with an early agent, computer-use, and video foundation.
