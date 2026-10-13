# CO-Agent desktop UI and Pets update

## Scope and architecture

Continue in the existing Electron + React application. Preserve IPC contracts, feature components, local-first runtime behavior, saved conversations, and all native safety confirmations. Adjust the renderer shell and styles, add a first-class Pets page backed by the existing pinned `integrations/AI-Desktop-Pet` submodule, and rearrange the existing Video Studio timeline into a conversational editing workspace. Do not replace native work with browser-only mocks or claim that an unbuilt executable is available.

## Design direction

- **Design movement:** Manus-inspired minimalist workbench, with ChatCut's conversational editor-and-timeline composition used only inside Video Studio; retain CO-Agent identity and do not reuse competitor branding or assets.
- **Core principles:** quiet light surfaces; only five primary sidebar destinations; one visible primary action per screen; real status and approvals stay explicit.
- **Color philosophy:** warm white canvas, light gray navigation and dividers, near-black text, and one restrained periwinkle/blue accent for active controls and focus. Avoid neon, glow, saturated card grids, and decorative gradients.
- **Layout paradigm:** persistent left sidebar with Chat, Video Studio, Integrations, Pets, and Settings. Keep recent tasks under Chat. Surface Setup, Agents & terminal, Computer Use, and Help through a compact Settings shortcut row so no working section becomes unreachable.
- **Signature elements:** a thin active-state rail, soft monochrome panel borders, and the included pet's own sprite preview.
- **Interaction philosophy:** preserve all existing handlers. The AI editor continues to stage timeline changes for review and explicit application. Pet overlay show/hide is explicit, and launching the separate native pet goes through the existing native confirmation.
- **Animation:** short opacity/color transitions only; respect `prefers-reduced-motion`.
- **Typography:** system sans-serif for interface text; existing monospace treatment only for paths/diagnostics.
- **Brand essence:** a practical local-first AI desktop workspace for people who make and build; deliberate, clear, user-controlled.
- **Voice:** concise and direct. Examples: “Start with a task.” “Review edits before applying.”
- **Wordmark/logo:** keep the CO-Agent mark and product name; no Manus or ChatCut marks.
- **Signature brand color:** restrained CO-Agent periwinkle accent for focus and selection, against Manus-like warm neutrals.

## Reference notes

- [Manus home](https://manus.im/) and its [Projects guide](https://manus.im/docs/features/projects) show a light, restrained task workspace. Borrow the palette and visual hierarchy, not Manus branding, copy, or project-management behavior.
- [ChatCut editor overview](https://chatcut.io/docs/editor-overview), [AI panel overview](https://chatcut.io/docs/ai-panel-overview), and [prompt composer](https://chatcut.io/docs/prompt-composer) show a conversational edit panel alongside media and a persistent timeline. Apply that broad arrangement to CO-Agent's real assistant, media assets, preview, and multitrack timeline without copying graphics or claiming feature parity.
- The user-supplied AI-Desktop-Pet archive matches the existing pinned submodule. Reuse the complete checked-in source, license, and assets; do not duplicate a second copy. Its native Windows executable is still reported by runtime discovery, never assumed to exist.

## Project structure

- `src/App.jsx`: primary navigation and route/view state; five visible destinations plus compact secondary Settings links.
- `src/Pets.jsx`: companion status and explicit overlay/native-app controls using existing preload APIs.
- `src/VideoEditor.jsx` and `src/TimelineEditor.jsx`: existing media workflow and reviewable AI timeline edits; keep their actions, changing the editor layout only.
- `src/styles.css`: shared Manus-like light theme, responsive sidebar, minimal settings/onboarding, and ChatCut-inspired studio grid.
- `integrations/AI-Desktop-Pet`: pinned full upstream pet project and source assets.
- `README.md`, `RESTORE-ROADMAP.md`, `TODO.md`: accurate navigation, source, build prerequisites, verified implementation status, and outcome tracking.

## Verification and delivery

Build the renderer and run the existing regression suite, check the diff, visually open Chat, Pets, and Video Studio in the local browser preview, create a source ZIP excluding Git metadata/build dependencies while including the pet submodule contents, then push the code and ZIP to a GitHub feature branch and open a reviewable PR. Do not merge the PR or trigger a permanent public website publication without a separate request.