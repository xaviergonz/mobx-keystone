---
name: release-tag-version
description: Release workflow for this repository. Ask the user to choose lib, yjs, or loro first, analyze unreleased changelog entries, recommend a semver bump, then update changelog and version, commit, tag, push, and publish.
---

# Release Tag Version

Follow this workflow only for this repository.

## Package Targets

Select one package at the start of each run:

- `lib`:
  - package name: `mobx-keystone`
  - package.json: `packages/lib/package.json`
  - changelog: `CHANGELOG.md`
  - publish dir: `packages/lib`
  - build command: `pnpm lib:build`
  - test command: `pnpm lib:test`
  - unreleased format: `## Unreleased`
- `yjs`:
  - package name: `mobx-keystone-yjs`
  - package.json: `packages/mobx-keystone-yjs/package.json`
  - changelog: `packages/mobx-keystone-yjs/CHANGELOG.md`
  - publish dir: `packages/mobx-keystone-yjs`
  - build command: `pnpm yjs-lib:build`
  - test command: `pnpm yjs-lib:test`
  - unreleased format: `## Unreleased`
- `loro`:
  - package name: `mobx-keystone-loro`
  - package.json: `packages/mobx-keystone-loro/package.json`
  - changelog: `packages/mobx-keystone-loro/CHANGELOG.md`
  - publish dir: `packages/mobx-keystone-loro`
  - build command: `pnpm loro-lib:build`
  - test command: `pnpm loro-lib:test`
  - unreleased format: `## Unreleased`

Global release branch: `master`

Commit message format: `v<version>` (example: `v1.2.3`)

Tag format: `v<version>` by default. If that tag already exists, stop and ask whether to use a package-specific tag.

## Repository Guard

- After branch sync checks pass, verify this is the `mobx-keystone` repository by checking:
  - `packages/lib/package.json` exists and `"name": "mobx-keystone"`,
  - `packages/mobx-keystone-yjs/package.json` exists and `"name": "mobx-keystone-yjs"`,
  - `packages/mobx-keystone-loro/package.json` exists and `"name": "mobx-keystone-loro"`.
- If checks fail, stop and tell the user this skill is project-specific and cannot run in the current repository.

## Interaction Contract

- Always ask the user which package to release first (`lib`, `yjs`, `loro`).
- Always inspect the selected package changelog unreleased entries first.
- Always compute and explain a semver recommendation (`major`, `minor`, or `patch`).
- Always present all three bump options and the resulting versions.
- Always ask the user to choose bump type, even if one option is recommended.
- Never perform writes (file edits, commit, tag, push, publish) before explicit user confirmation.
- Ask for a final confirmation before push+publish.

## Semver Recommendation Rules

- Recommend `major` for breaking changes (API removals, incompatible behavior changes, migration-required changes).
- Recommend `minor` for backward-compatible features.
- Recommend `patch` for bug fixes, docs, tests, refactors, and performance-only changes.
- If multiple categories appear, recommend the highest impact bump.

## Required Workflow

1. Verify current branch is `master`:
   - `git branch --show-current`
   - If branch is not `master`, stop and ask user to switch to `master` before running release.
2. Ensure local `master` is synced with `origin/master`:
   - `git fetch origin`
   - `git pull --ff-only origin master`
3. Run repository guard checks.
4. Ask which package to release (`lib`, `yjs`, `loro`).
5. Resolve selected package paths (`package.json`, changelog, publish dir).
6. Read current version from selected package `package.json`.
7. Check for an `## Unreleased` section in the selected package changelog.
   - If the section is absent or present but has no bullet entries, stop: tell the user there is nothing to release and ask them to add changelog entries under `## Unreleased` first.
8. Parse the unreleased changelog bullets.
9. Propose `major`, `minor`, and `patch` next versions from current version.
10. Tell the user:
   - current version,
   - unreleased summary,
   - recommended bump with rationale,
   - all three selectable bump options.
11. Ask the user to select bump type.
12. After selection, compute target version and draft the exact edits to apply (do not write files yet):
    - Update selected package `package.json` version to `<target-version>`.
    - Keep `## Unreleased` as the top section and leave it empty.
    - Insert a new section `## <target-version>` directly below `## Unreleased`.
    - Move unreleased bullets into the new version section.
13. Show planned diff summary and ask for confirmation to apply edits and execute pre-push steps.
14. If confirmed, run release commands in order:
   - Ensure working tree is clean or only has intended release files.
   - Apply/verify release edits.
   - Run pre-publish checks:
     - `pnpm lint`
     - `pnpm <selected-package-build-command>`
     - `pnpm <selected-package-test-command>`
   - Verify tag `v<target-version>` does not already exist locally or on `origin`.
   - Commit: `git commit -m "v<target-version>"`.
   - Tag: `git tag "v<target-version>"`.
15. Ask for final confirmation before push+publish.
16. If confirmed, finish release:
   - Push commit and tag to `origin master`.
   - Publish from selected package directory using `npm publish`.
17. Report exact outputs for commit SHA, tag, push status, and publish result.

## Command Template

```bash
# first, verify current branch is master
if [ "$(git branch --show-current)" != "master" ]; then
  echo "Not on master; aborting release."
  exit 1
fi

# then sync local master with origin/master
git fetch origin
git pull --ff-only origin master

# choose PACKAGE=lib|yjs|loro

# inspect selected package
# lib
cat packages/lib/package.json
rg -n "^## Unreleased|^## [0-9]" CHANGELOG.md

# yjs
cat packages/mobx-keystone-yjs/package.json
rg -n "^## Unreleased|^## [0-9]" packages/mobx-keystone-yjs/CHANGELOG.md

# loro
cat packages/mobx-keystone-loro/package.json
rg -n "^## Unreleased|^## [0-9]" packages/mobx-keystone-loro/CHANGELOG.md

# after user selects bump and confirms writes
# edit selected changelog + selected package.json

# package checks (choose based on PACKAGE)
# lib: pnpm lib:build && pnpm lib:test
# yjs: pnpm yjs-lib:build && pnpm yjs-lib:test
# loro: pnpm loro-lib:build && pnpm loro-lib:test
pnpm lint
if git rev-parse -q --verify "refs/tags/vX.Y.Z" >/dev/null; then echo "tag exists locally"; fi
if git ls-remote --exit-code --tags origin "refs/tags/vX.Y.Z" >/dev/null 2>&1; then echo "tag exists on origin"; fi
git add <selected-changelog> <selected-package-json>
git commit -m "vX.Y.Z"
git tag "vX.Y.Z"

# ask for final confirmation before running push/publish
git push origin master
git push origin "vX.Y.Z"

cd <selected-publish-dir>
npm publish
```

## Stop Conditions

- If selected package is not one of `lib`/`yjs`/`loro`, stop and ask again.
- If current branch is not `master`, stop and ask user to switch to `master` before releasing.
- If the selected changelog has no `## Unreleased` section, or the section exists but has no bullet entries, stop and tell the user there is nothing unreleased to publish; ask them to add entries under `## Unreleased` first.
- If `master` cannot be fast-forwarded, stop and ask user how to proceed.
- If tag `v<target-version>` already exists, stop and ask user for tag strategy.
- If publish fails, do not retry destructive changes automatically; report error and ask.
