---
name: release-tag-version
description: Release workflow for this repository. Ask the user to choose lib, yjs, or loro first, analyze unreleased changelog entries, recommend a semver bump, then update changelog and version, create package-specific commit and tag names, push, then hand off manual publish to the user.
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

Release commit message format: `<package-name>@v<version>` (example: `mobx-keystone@v1.2.3`)

Release tag format: `<package-name>@v<version>` (example: `mobx-keystone@v1.2.3`)

Post-publish prep commit format: `chore(<package-name>): prepare next release`

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
- Never perform writes (file edits, commit, tag, push) before explicit user confirmation.
- The release/tag commit must not keep `## Unreleased` in the changelog.
- After successful publish, re-add `## Unreleased` as the top changelog section and commit it as next-release preparation.
- Ask for a final confirmation before push.
- Never run `npm publish` directly; always hand off publish to the user with exact commands and wait for user confirmation before continuing.

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
    - Remove `## Unreleased` from the release/tag commit so it is not part of the published changelog version.
    - Insert a new section `## <target-version>` at the top of the changelog.
    - Move unreleased bullets into the new version section.
13. Show planned diff summary and ask for confirmation to apply edits and execute pre-push steps.
14. If confirmed, run release commands in order:
   - Ensure working tree is clean or only has intended release files.
   - Apply/verify release edits.
   - Run pre-publish checks:
     - `pnpm lint`
     - `pnpm <selected-package-build-command>`
     - `pnpm <selected-package-test-command>`
   - Compute:
     - `release-tag = <selected-package-name>@v<target-version>`
     - `release-commit-message = <selected-package-name>@v<target-version>`
     - `prep-commit-message = chore(<selected-package-name>): prepare next release`
   - Verify tag `<selected-package-name>@v<target-version>` does not already exist locally or on `origin`.
   - Commit: `git commit -m "<selected-package-name>@v<target-version>"`.
   - Tag: `git tag "<selected-package-name>@v<target-version>"`.
15. Ask for final confirmation before push+manual-publish handoff+post-publish changelog prep.
16. If confirmed, finish release agent-side:
   - Push commit and tag to `origin master`.
17. Hand off publish to the user:
   - Tell the user to run:
     - `cd <selected-publish-dir>`
     - `npm publish`
   - Ask the user to share the publish result and explicitly confirm when done.
18. After the user confirms publish succeeded:
   - Re-add `## Unreleased` as the top changelog section and leave it empty.
   - Commit the changelog-only prep commit using `chore(<selected-package-name>): prepare next release`.
   - Push the prep commit to `origin master`.
19. Report exact outputs for release commit SHA, tag, user-provided publish result, and post-publish prep commit SHA.

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
# remove `## Unreleased` from changelog in the release commit
# create `## X.Y.Z` at top and move unreleased bullets there

# package checks (choose based on PACKAGE)
# lib: pnpm lib:build && pnpm lib:test
# yjs: pnpm yjs-lib:build && pnpm yjs-lib:test
# loro: pnpm loro-lib:build && pnpm loro-lib:test
pnpm lint
if git rev-parse -q --verify "refs/tags/<package-name>@vX.Y.Z" >/dev/null; then echo "tag exists locally"; fi
if git ls-remote --exit-code --tags origin "refs/tags/<package-name>@vX.Y.Z" >/dev/null 2>&1; then echo "tag exists on origin"; fi
git add <selected-changelog> <selected-package-json>
git commit -m "<package-name>@vX.Y.Z"
git tag "<package-name>@vX.Y.Z"

# ask for final confirmation before running push and manual publish handoff
git push origin master
git push origin "<package-name>@vX.Y.Z"

# then instruct the user to run publish manually:
# cd <selected-publish-dir>
# npm publish
# wait for user confirmation that publish succeeded

# after successful publish, re-add top `## Unreleased` and commit prep
git add <selected-changelog>
git commit -m "chore(<package-name>): prepare next release"
git push origin master
```

## Stop Conditions

- If selected package is not one of `lib`/`yjs`/`loro`, stop and ask again.
- If current branch is not `master`, stop and ask user to switch to `master` before releasing.
- If the selected changelog has no `## Unreleased` section, or the section exists but has no bullet entries, stop and tell the user there is nothing unreleased to publish; ask them to add entries under `## Unreleased` first.
- If `master` cannot be fast-forwarded, stop and ask user how to proceed.
- If tag `<selected-package-name>@v<target-version>` already exists, stop and ask user for tag strategy.
- If publish fails, do not retry destructive changes automatically; report error and ask.
- If the user has not yet confirmed manual `npm publish` success, do not continue to post-publish changelog prep.
- If post-publish re-add/commit/push of `## Unreleased` fails, report the exact state and ask before taking follow-up actions.
