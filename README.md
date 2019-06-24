# mobx-data-model

[![npm version](https://badge.fury.io/js/mobx-data-model.svg)](https://badge.fury.io/js/mobx-data-model)
[![CircleCI](https://circleci.com/gh/xaviergonz/mobx-data-model.svg?style=svg)](https://circleci.com/gh/xaviergonz/mobx-data-model)
[![Coverage Status](https://coveralls.io/repos/github/xaviergonz/mobx-data-model/badge.svg?branch=master&t=Lwl2z5)](https://coveralls.io/github/xaviergonz/mobx-data-model?branch=master)

> ### Full documentation can be found on the site:
>
> ## [mobx-data-model.netlify.com](https://mobx-data-model.netlify.com)

## Introduction

TODO: Write intro

To see some code and a a glimpse of how it works check the [Todo List Example](https://mobx-data-model.netlify.com/examples/todoList)

## Comparison with `mobx-state-tree`

This library is very much like `mobx-state-tree` and takes lots of ideas from it, so the transition
should be fairly simple. There are some trade-offs though, as shown in the following chart.

| Feature                                | `mobx-data-model`   | `mobx-state-tree` |
| -------------------------------------- | ------------------- | ----------------- |
| Tree-like structure                    | ✔️                  | ✔️                |
| Immutable snapshot generation          | ✔️                  | ✔️                |
| Patch generation                       | ✔️                  | ✔️                |
| Action serialization / applying        | ✔️                  | ✔️                |
| Action middleware support (1)          | ✔️✔️                | ✔️                |
| - Atomic/Transaction middleware        | ✔️                  | ✔️                |
| - Undo manager middleware              | ✔️                  | ✔️                |
| - Redux dev tools middleware           | ❌ (in development) | ✔️                |
| Flow action support                    | ✔️                  | ✔️                |
| References                             | ✔️                  | ✔️                |
| Frozen data                            | ✔️                  | ✔️                |
| Typescript support (2)                 | ✔️✔️✔️              | ✔️                |
| Simpler instance / snapshot type usage | ✔️                  | ❌                |
| Simpler model life-cycle               | ✔️                  | ❌                |
| Runtime type validation                | ❌                  | ✔️                |
| No metadata inside snapshots           | ❌                  | ✔️                |
| Improved speed / memory usage (3)      | ✔️                  | ❌                |
| Lazy node initialization (4)           | ➖                  | ✔️                |

1. Includes an improved action tracking middleware that makes it easier to create
   middlewares for flow (async) actions.
2. Support for self-model references / cross-model references / no need for late types, no need for casting,
   etc.
3. Actions, views, etc. are stored in the prototype rather than in each model object.
4. In theory this shouldn't be as important since the initialization speed is faster and this
   lack of lazy initialization leads to less confusing life-cycles.

## Requirements

This library requires a more or less modern Javascript environment to work, namely one with support for:

- Proxies
- Symbols
- WeakMap/WeakSet
- Object.entries (this one can be polyfilled)

In other words, it should work on mostly anything except _it won't work in Internet Explorer_.

If you are using Typescript, then version >= 3.2.4 is recommended, though it _might_ work with older versions.

## Installation

> `npm install mobx-data-model`

> `yarn add mobx-data-model`
