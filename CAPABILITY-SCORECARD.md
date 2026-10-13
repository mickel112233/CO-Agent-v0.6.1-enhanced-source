# CO-Agent capability scorecard and competitive gap analysis

**Assessment date:** 12 October 2026  
**Scope:** The source on `codex/full-application-hardening`, not a hands-on benchmark of every installed build. Scores are an evidence-based engineering judgment, not a vendor benchmark or a claim of feature parity.

## Executive score

**Overall: 6.1/10 — a materially hardened local-first desktop foundation, still short of a leading autonomous agent.**

The strongest differentiator is the combination of local Ollama chat, Windows-native computer-use approval, durable workflow checkpoints, reviewable file proposals, a permission-gated MCP/ACP integration layer, and a real FFmpeg timeline in one desktop app. The biggest limitation remains depth: steps are user-started, computer use is one approved action at a time, external integrations have only mock-server coverage, and the video editor lacks many professional editing tools. The app should compete on privacy, understandable approvals, and creator/developer workflow integration—not on autonomy or breadth yet.

| Dimension | Score / 10 | Weight | Evidence and reasoning |
|---|---:|---:|---|
| Local-first privacy and control | 8.0 | 15% | Ollama runs locally; selected workspace context is bounded; skills are treated as untrusted; writes and desktop input require approval. Optional API providers necessarily send conversation text to the chosen provider. |
| Chat and model flexibility | 7.5 | 12% | Ollama plus OpenAI-compatible, Anthropic, and Gemini API paths; role history, streaming, cancellation, and bounded partial-response recovery are implemented. No OS-backed credential vault or provider capability metadata yet. |
| Agent planning and execution | 4.8 | 20% | Dependency-aware plans, specialist roles, durable approved-plan state, dependency checkpoints, pause/resume/cancel, bounded retries, event history, and interrupted-step recovery. Active local-model requests can now be cancelled through the UI into the fetch abort signal. File proposals produce bounded unified-diff previews, receive per-file native approval, and use backed-up multi-file writes with rollback. Steps still run only when user-started; no autonomous execution loop, parallel workers, or broad task outcome verification. |
| Desktop computer use | 5.0 | 12% | Windows screenshot, accessibility-window inspection, optional OCR, bounded plans, and approval-gated click/type/key actions. A local vision-model comparison assesses before/after screenshots after an approved action with conservative status/confidence/evidence. No semantic element actions, full task-level verification, or autonomous control loop. |
| Video and creative workflows | 4.8 | 10% | Real multi-track timeline MVP, project save/load, captions/titles, undo/redo, FFmpeg progress and cancellation, atomic temporary output, FFprobe duration/video validation, and expected-audio-stream checks. Still missing transitions, keyframes, effects, waveforms, audio routing, proxies, color grading, and transcription. |
| Integrations and extensibility | 4.5 | 10% | Public GitHub repository/skill import, optional OCR/Hyperframes/Piper, current-spec experimental Streamable HTTP MCP with per-call approval, and an ACP v2 stdio adapter with filtered environment, live updates, cancellation, and per-permission prompts. No OAuth, ACP login, broad app connectors, OS sandbox, or real external-agent compatibility run yet. |
| Security and permission model | 7.5 | 10% | Context isolation, IPC sender checks, path/symlink/secret filtering, explicit file-write and native input approvals, per-call MCP/ACP permission prompts, bounded outputs, and a redacted bounded local audit trail. Security is not a sandbox or tamper-proof log: external agents and approved project scripts still run with the user's OS permissions. |
| Reliability and testability | 7.0 | 8% | Node regression suite and Windows/Ubuntu CI; tests cover run transitions/recovery, active-step cancellation, provider streaming/partial responses, computer outcome parsing, render progress/cancellation/audio validation, MCP/ACP protocol mocks, and per-file diff previews. CI now silently installs the Windows package and launches smoke mode to verify renderer/preload assets and IPC registration. No real-device task benchmark, signed installer, or broad media fixture matrix. |
| UX, setup, and accessibility | 5.2 | 3% | Functional desktop UI with recent chats, live streaming output, explicit durable-run controls, computer-use outcome assessments, and render progress/cancel. Setup still depends on external Ollama/runtime configuration; deeper keyboard/accessibility and packaged-app interaction tests remain. |

**Weighted score:** approximately **6.1/10 (provisional engineering score; durable execution and active-step cancellation, streamed chat, computer-use assessment, cancellable video render, MCP, ACP, per-file diff approvals, and packaged Windows startup smoke testing have regression coverage. Live-device task benchmarks and real MCP/ACP server compatibility runs remain absent).** Weighting intentionally emphasizes agent execution, local control, and reliability rather than counting menu items.

## Comparison with current alternatives

These are capability comparisons from public project/documentation pages, not a claim that the products have identical goals or were all tested in the same environment.

| Capability | CO-Agent in this branch | Established alternatives | What CO-Agent should do next |
|---|---|---|---|
| Desktop computer control | Windows-only, approval per action, screenshot/OCR/accessibility inspection | OpenAI and Anthropic document computer-use flows that repeatedly observe a screen, dispatch structured actions, and return observations to the model; both stress approval, bounded execution, and treating screen content as untrusted. | Build a controlled observe → propose → approve → act → verify loop, with cancellation, action history, and target/outcome checks. Do not remove approvals to imitate “full auto.” |
| Coding-agent execution | User-started planner steps, fixed terminal presets, selected-file context, full-file proposals | OpenHands describes local/remote backends, multiple agents, MCP and integrations, and workflow automations; CO-Agent now has a bounded but experimental MCP/ACP bridge. | Prioritize patch/diff proposals, test execution tied to acceptance criteria, reliable recovery, Git worktree isolation as an optional mode, and an auditable run log. |
| Multi-agent workspace | Specialist role prompts; no parallel sessions | AionUi advertises multiple agent/CLI integrations, parallel sessions, MCP management, and ready-made assistants. | Add one provider/agent adapter interface first, then one integration at a time. Avoid adding dozens of integrations before the execution contract is reliable. |
| Local chat | Ollama streaming plus OpenAI-compatible, Anthropic, and Gemini API providers | Ollama's chat API supports streamed messages and conversation roles; many desktop clients expose token-by-token output. | Add incremental streaming, Stop generation, first-token latency/progress, and robust partial-response recovery. |
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
- MCP, [Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx): required method/name headers and current transport behavior.
- ACP, [protocol v2 overview](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v2/overview.mdx) and [v2 initialization](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v2/initialization.mdx): JSON-RPC process/session lifecycle and capability negotiation.

## Highest-value improvements, ordered by impact

### P0 — make current features dependable

1. **Streaming chat for local and API providers:** incremental rendering, Stop, bounded buffers, cancellation propagation, and partial-response recovery; regression tests and Windows/Ubuntu CI pass.
2. **Agent run state machine:** durable approved plans, step transitions, pause/resume/cancel, active model-call cancellation, bounded retries, dependency checkpoints, and startup recovery are implemented. Restarted running/unreviewed steps become retryable failures rather than stranded checkpoints; real-task recovery benchmarks remain.
3. **Outcome verification:** file proposals now show bounded unified diffs with per-file approval and transactional rollback; computer actions compare before/after screenshots locally. Add deterministic task-level assertions and test execution tied to acceptance criteria.
4. **Security audit trail:** a local redacted bounded log records file approvals, agent steps, computer actions, MCP/ACP calls, and renders. Next add integrity protection, export controls, and clearer provider-context disclosures.
5. **Release and app-level tests:** Windows CI silently installs the package and launches a smoke mode that checks renderer/preload assets and IPC registration. Add real renderer interaction tests and a media fixture suite for duration, streams, and audio/video sync. Timeline rendering reports progress, supports cancellation, removes partial output on failure, preserves prior exports, and checks expected audio streams.

### P1 — close the biggest competitive gaps

6. **Patch-first file edits:** improve diff hunk/context quality, add an explicit rollback UI, and run selected tests against the accepted changes.
7. **Video editing basics:** audio waveform, transform controls, source audio routing, reliable audio/video synchronization, transitions, and effects; undo/redo and render progress/cancel are already implemented.
8. **Accessibility-first computer use:** UI Automation element tree and semantic actions where possible, coordinate fallback, multi-monitor awareness, and post-action checks.
9. **Provider architecture:** common provider interface, credential storage using OS facilities, model capability metadata, request budgets, and clear local-vs-cloud disclosure.
10. **Setup recovery:** diagnose Ollama missing/offline, detect hardware/model fit, explain disk and memory requirements, offer retry/manual setup, and return to the app without trapping users in setup.

### P2 — only after reliability improves

11. Expand MCP transport/auth support and add curated connectors; test ACP v2 against real agent executables, implement auth/login where advertised, and add stronger workspace isolation and audit-log integrity.
12. Optional scheduled tasks with explicit schedules, pause/cancel, logs, and safe defaults.
13. Creative pipelines for captions/transcription, motion graphics, and export presets.
14. Automated benchmark harness: fixed tasks, success criteria, repeat runs, latency, failures, resource use, and regression comparisons.

## Scoring rules and limits

- A feature earns credit only when the repository implements it and the boundary is documented; a menu, prompt, or roadmap entry alone is not evidence.
- The score does not measure model intelligence, real-world task success, privacy compliance certification, or the performance of the user's particular PC.
- The score should be recalculated after running a reproducible task benchmark on the packaged Windows app, plus real MCP/ACP server compatibility tests—not merely after adding code.
- **Do not market CO-Agent as a replacement for OpenHands, AionUi, a full computer-use agent, or a professional video editor yet.** Market it as a local-first desktop workspace with an early agent, computer-use, and video foundation.
