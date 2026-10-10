# Version history, releases, and rollback

CO-Agent uses Git history as the source of truth. A commit is a recoverable snapshot; a version tag is a named checkpoint; a GitHub Release is a convenient download/notes page.

## Find an earlier version

A named safety checkpoint is available at [\`checkpoint/v0.6.1-before-tool-integrations\`](https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tree/checkpoint/v0.6.1-before-tool-integrations). It preserves the repository state before the current Tesseract/Hyperframes integration and documentation refresh.

- Browse all commits: https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/commits/main/
- Compare two versions: `https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/compare/<older-ref>...<newer-ref>`
- Browse tags: https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/tags
- Browse releases: https://github.com/mickel112233/CO-Agent-v0.6.1-enhanced-source/releases

Replace a placeholder ref with a real commit SHA, branch, or tag.

## Safely check out an older snapshot

Use a fresh clone or worktree so you don't lose current work:

```bash
git fetch --all --tags
git log --oneline --decorate --graph -30
git switch --detach <commit-sha-or-tag>
```

Detached HEAD is ideal for inspection/testing. To continue development from that point, create a branch:

```bash
git switch -c investigate/older-version <commit-sha-or-tag>
```

## Roll back a working tree without rewriting shared history

If the goal is to undo one or more commits on a shared branch, prefer `git revert`:

```bash
git log --oneline
git revert <commit-sha>
git push
```

For multiple commits, revert in reverse chronological order or revert a range after reviewing the diff. Do not use `git reset --hard` on shared work unless you intentionally want to discard local changes and understand the consequences.

## Create a stable checkpoint

Before a risky change, commit and create a version tag:

```bash
git status
git add .
git commit -m "chore: checkpoint before risky change"
git tag -a v0.6.2 -m "CO-Agent v0.6.2"
git push origin main
git push origin v0.6.2
```

Use a new, unique semantic version tag for each release; never move an existing release tag to a different commit. After pushing a `v*` tag, the release workflow builds on Windows and Ubuntu and creates a GitHub Release with build artifacts when the workflow succeeds. The version tag should point to a commit that passed CI.

## Release checklist

- [ ] Update `package.json` version and visible UI version together.
- [ ] Update README and roadmap if behavior/status changed.
- [ ] Run `npm test` and `npm run build`.
- [ ] Confirm Windows and Ubuntu CI are green.
- [ ] Tag the exact verified commit with a unique `vX.Y.Z` tag.
- [ ] Push the tag and inspect the generated GitHub Release/artifacts.
- [ ] Record breaking changes and migration notes.

**Note:** Git history lets you inspect any existing commit immediately, even if no release was published for it. Tags/releases make important milestones easier to find.
