# Copilot Instructions for mobx-keystone

This repository is a monorepo containing the `mobx-keystone` library and its ecosystem.

## Overview

`mobx-keystone` is a state container that combines the simplicity of mutable data with the traceability of immutable data and the reactiveness of observable data. It is highly opinionated about data structure and updates, using a "living tree" concept where mutable objects generate immutable snapshots.

## Project Structure

- `packages/lib`: The core `mobx-keystone` library.
- `packages/mobx-keystone-yjs`: Yjs integration for `mobx-keystone`.
- `apps/site`: Documentation site (Docusaurus).
- `apps/benchmark`: Performance benchmarks.

## Tech Stack

- **State Management**: MobX 6
- **Language**: TypeScript (Strict mode)
- **Monorepo Tooling**: Turbo, Yarn (Berry/Plug'n'Play)
- **Linting & Formatting**: Biome
- **Testing**: Jest
- **Documentation**: Docusaurus (Site), TypeDoc (API)

## Core Concepts

When working with the library, keep these concepts in mind:
- **Models & Data Models**: The building blocks of the state tree.
- **Snapshots**: Immutable representations of the state.
- **Patches**: JSON patches for state changes.
- **Actions & Middlewares**: How state is modified and intercepted.
- **References (Refs)**: How to reference other nodes in the tree.
- **Root Stores**: The entry point of the state tree.

## Available Commands

When performing tasks, use the following `yarn` commands from the root directory:

### Core Library (`mobx-keystone`)
- `yarn lib:build`: Build the main library.
- `yarn lib:test`: Run tests for the main library.
- `yarn lib:test:ci`: Run tests for the main library in CI mode.
- `yarn lib:build-docs`: Build API documentation for the main library.

### Yjs Integration (`mobx-keystone-yjs`)
- `yarn yjs-lib:build`: Build the Yjs integration library.
- `yarn yjs-lib:test`: Run tests for the Yjs integration library.
- `yarn yjs-lib:test:ci`: Run tests for the Yjs integration library in CI mode.

### Documentation Site
- `yarn site:start`: Start the documentation site in development mode.
- `yarn site:build`: Build the documentation site.
- `yarn site:serve`: Serve the built documentation site locally.
- `yarn build-netlify`: Build the site for Netlify deployment.
- `yarn netlify-dev`: Run the Netlify development environment.

### General
- `yarn lint`: Lint the codebase using Biome.

## Coding Standards

- **Linting**: Biome is used for linting and formatting. Always run `yarn lint` before finishing a task.
- **Imports**: Biome is configured to organize imports automatically on save.
- **Exports**: Use barrel files (`index.ts`) to export public APIs from directories.
- **TypeScript**: Use strict typing. Avoid `any` where possible. Use `unknown` or specific types instead.
- **Naming**: Follow existing naming conventions (e.g., `Model` suffix for model classes).

## Development Guidelines

- Use `yarn` for package management.
- This project uses `turbo` for task orchestration.
- Follow the existing coding style and patterns found in the codebase.
- **Testing**: Always add or update tests when fixing bugs or adding features. Tests are located in `test/` directories within each package.
- **Bug Fixes**: For bug fixes, include a test case that reproduces the issue.
- **Documentation**: Update documentation in `apps/site/docs` if the change affects the public API or behavior.
