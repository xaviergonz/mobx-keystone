---
name: release-tag-version
description: Release workflow for this repository. Analyze the unreleased changelog entries of lib, yjs and loro, ask once which packages to release and the semver bump of each, then update changelogs and versions, build, test, commit, tag, push, hand the user the `npm publish` commands to run in their own terminal, and prepare the next release, without further confirmations.
---

# Release Tag Version

Follow this workflow only for this repository.

## Package Targets

| Key | Package name | package.json | Changelog | Publish dir | Build | Test |
| --- | --- | --- | --- | --- | --- | --- |
| `lib` | `mobx-keystone` | `packages/lib/package.json` | `CHANGELOG.md` | `packages/lib` | `pnpm lib:build` | `pnpm lib:test` |
| `yjs` | `mobx-keystone-yjs` | `packages/mobx-keystone-yjs/package.json` | `packages/mobx-keystone-yjs/CHANGELOG.md` | `packages/mobx-keystone-yjs` | `pnpm yjs-lib:build` | `pnpm yjs-lib:test` |
| `loro` | `mobx-keystone-loro` | `packages/mobx-keystone-loro/package.json` | `packages/mobx-keystone-loro/CHANGELOG.md` | `packages/mobx-keystone-loro` | `pnpm loro-lib:build` | `pnpm loro-lib:test` |

- Release branch: `master`.
- Unreleased section heading: `## Unreleased`.
- Release commit message and tag: `<package-name>@v<version>` (e.g. `mobx-keystone@v1.2.3`).
- Post-publish prep commit message: `chore(<package-name>): prepare next release`.
- When several packages are released, always process them in the order `lib`, `yjs`, `loro` (`yjs` and `loro` depend on `mobx-keystone`).

## Interaction Contract

- Ask the user exactly once: which packages to release and the bump of each. Their answer authorizes the whole release (file edits, commits, tags, pushes, `npm publish` and the prep commits); do not ask for any other confirmation afterwards.
- Skip the question entirely when the skill arguments already name the packages and bumps (e.g. `lib minor`, `lib patch yjs minor`).
- The only other user action is running `npm publish` in their own terminal (see step 4) and telling you when it is done.
- Only stop and ask when a stop condition below is hit.
- The release/tag commit must not keep `## Unreleased` in the changelog; after publishing, re-add an empty `## Unreleased` as the top changelog section.

## Semver Recommendation Rules

- `major` for breaking changes (API removals, incompatible behavior changes, migration-required changes).
- `minor` for backward-compatible features.
- `patch` for bug fixes, docs, tests, refactors and performance-only changes.
- If several categories appear, recommend the highest impact bump.

## Workflow

### 1. Preflight (no questions)

1. `git branch --show-current` must be `master`.
2. Tracked files must have no changes (`git status --porcelain --untracked-files=no` is empty); untracked files are fine and must never be committed.
3. `git fetch origin && git pull --ff-only origin master`.
4. Repository guard: the three package.json files exist with the names in the table above. If not, stop: this skill is project-specific.
5. `npm whoami` must print a username. If it fails, the npm token in `~/.npmrc` is missing or expired: stop and tell the user to run `npm login` (or set a new token with `npm config set //registry.npmjs.org/:_authToken=<token>`) before releasing, so no tag is pushed for a release that cannot be published.

### 2. Analyze and ask once

1. For each package read the current version and the bullets under `## Unreleased` in its changelog.
2. Packages without an `## Unreleased` section or without bullets in it cannot be released; mention them as "nothing to release".
3. If no package has unreleased bullets, stop and tell the user to add changelog entries first.
4. Show the user, for each releasable package: current version, a short summary of the unreleased bullets and the recommended bump with its rationale.
5. Unless the arguments already answered it, ask with a single `AskUserQuestion` call containing one question per releasable package, with these options (recommended one first, labelled `(Recommended)`):
   - `<bump> → <version>` for `patch`, `minor` and `major` (three options),
   - `Skip` (do not release this package).
6. If every package is skipped, stop.
7. If `lib` gets a `major` bump and a released or unreleased `yjs`/`loro` package declares a `mobx-keystone` peer dependency range that excludes the new version, stop and ask how to proceed.

### 3. Release commits and tags

For each selected package, in order:

1. Verify the tag `<package-name>@v<version>` does not exist locally (`git rev-parse -q --verify refs/tags/<tag>`) or on origin (`git ls-remote --exit-code --tags origin refs/tags/<tag>`).
2. Set `version` in its package.json.
3. In its changelog, replace the `## Unreleased` heading with `## <version>` (the bullets stay under it).

Then run the checks once for all selected packages (builds must run after the edits, since they copy the changelog into the package):

1. `pnpm lint`
2. The build command of each selected package, in order.
3. The test command of each selected package, in order.

If everything passes, for each selected package in order:

1. `git add <changelog> <package.json>`
2. `git commit -m "<package-name>@v<version>"`
3. `git tag "<package-name>@v<version>"`

Finally push: `git push origin master` and `git push origin <each tag>`.

### 4. Publish

Do not run `npm publish` yourself. Publishing needs a 2FA one-time password or browser login, and without a TTY npm does not prompt for it: it fails straight away with `EOTP` (and masks the authentication URL), so the user must run it in their own terminal.

1. Give the user, in one block, the commands to publish every selected package in order, run from the repo root, e.g.:

   ```sh
   (cd packages/lib && npm publish) && (cd packages/mobx-keystone-yjs && npm publish)
   ```

   Tell them npm will show an `Authenticate your account at:` URL for each package (press ENTER to open it and log in), and to tell you when each prints `+ <package-name>@<version>`.
2. Wait for the user. If they report that a publish failed, stop and report; do not retry or undo anything automatically.
3. Once they confirm the `+ <package-name>@<version>` line for a package, continue with step 5 for it.

### 5. Prepare the next release

For each published package, in order:

1. Insert an empty `## Unreleased` section as the top section of its changelog (right after `# Change Log`, followed by a blank line).
2. `git add <changelog>` and `git commit -m "chore(<package-name>): prepare next release"`.

Then `git push origin master`.

### 6. Report

Report for each released package: release commit SHA, tag, the `npm publish` result the user confirmed and the prep commit SHA.

A `+ <package-name>@<version>` line from `npm publish` already confirms the publish succeeded. Do not wait or poll for the new version to show up in the registry (`npm view`, registry requests, background loops): npm may take a few minutes to make it visible, and that delay is not a failure. Finish the workflow and the report right away; at most mention that the version may take a few minutes to appear on npm.

## Stop Conditions

- Not on `master`, tracked changes present, or `master` cannot be fast-forwarded: stop and ask.
- Repository guard fails: stop.
- No releasable package, or every package skipped: stop.
- A release tag already exists: stop and ask for a tag strategy.
- Lint, build or tests fail: stop before committing and report the failure (the edited package.json/changelog files are left uncommitted; tell the user).
- A push fails: stop and report the exact state.
- `npm whoami` fails in preflight: stop and tell the user to log in to npm.
- The user reports that `npm publish` failed: stop and report; never retry or revert automatically.
- Prep commit or its push fails: report the exact state and ask before any follow-up action.
