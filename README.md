<p align="center">
  <img src="./apps/site/static/img/logo.png" height="128" />
  <h1 align="center">mobx-keystone</h1>
</p>
<p align="center">
  <i>A MobX powered state management solution based on data trees with first-class support for TypeScript, snapshots, patches and much more</i>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/mobx-keystone">
    <img src="https://img.shields.io/npm/v/mobx-keystone.svg?style=for-the-badge&logo=npm&labelColor=333" />
  </a>
  <a aria-label="License" href="./LICENSE">
    <img src="https://img.shields.io/npm/l/mobx-keystone.svg?style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Types" href="./packages/lib/tsconfig.json">
    <img src="https://img.shields.io/npm/types/mobx-keystone.svg?style=for-the-badge&logo=typescript&labelColor=333" />
  </a>
  <br />
  <a aria-label="CI" href="https://github.com/xaviergonz/mobx-keystone/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xaviergonz/mobx-keystone/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Codecov" href="https://codecov.io/gh/xaviergonz/mobx-keystone">
    <img src="https://img.shields.io/codecov/c/github/xaviergonz/mobx-keystone?token=6MLRFUBK8V&label=codecov&logo=codecov&style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Netlify Status" href="https://app.netlify.com/sites/mobx-keystone/deploys">
    <img src="https://img.shields.io/netlify/c5f60bcb-c1ff-4d04-ad14-1fc34ddbb429?label=netlify&logo=netlify&style=for-the-badge&labelColor=333" />
  </a>
</p>

> ### Full documentation can be found on the site:
>
> ## [mobx-keystone.js.org](https://mobx-keystone.js.org)

## Introduction

`mobx-keystone` is a state container that combines the _simplicity and ease of mutable data_ with the _traceability of immutable data_ and the _reactiveness and performance of observable data_, all with a fully compatible TypeScript syntax.

Simply put, it tries to combine the best features of both immutability (transactionality, traceability and composition) and mutability (discoverability, co-location and encapsulation) based approaches to state management; everything to provide the best developer experience possible.
Unlike MobX itself, `mobx-keystone` is very opinionated about how data should be structured and updated.
This makes it possible to solve many common problems out of the box.

Central in `mobx-keystone` is the concept of a _living tree_. The tree consists of mutable, but strictly protected objects (models, arrays and plain objects).
From this living tree, immutable, structurally shared snapshots are automatically generated.

Another core design goal of `mobx-keystone` is to offer a great TypeScript syntax out of the box, be it for models (and other kinds of data such as plain objects and arrays) or for its generated snapshots.

To see some code and get a glimpse of how it works check the [Todo List Example](https://mobx-keystone.js.org/examples/todo-list).

Because state trees are living, mutable models, actions are straightforward to write; just modify local instance properties where appropriate. It is not necessary to produce a new state tree yourself, `mobx-keystone`'s snapshot functionality will derive one for you automatically.

Although mutable sounds scary to some, fear not, actions have many interesting properties.
By default trees can only be modified by using an action that belongs to the same subtree.
Furthermore, actions are replayable and can be used to distribute changes.

Moreover, because changes can be detected on a fine-grained level, JSON patches are supported out of the box.
Simply subscribing to the patch stream of a tree is another way to sync diffs with, for example, back-end servers or other clients.

Since `mobx-keystone` uses MobX behind the scenes, it integrates seamlessly with [`mobx`](https://mobx.js.org) and [`mobx-react`](https://github.com/mobxjs/mobx-react).
Even cooler, because it supports snapshots, action middlewares and replayable actions out of the box, it is possible to replace a Redux store and reducer with a MobX data model.
This makes it possible to connect the Redux devtools to `mobx-keystone`.

Like React, `mobx-keystone` consists of composable components, called _models_, which capture small pieces of state. They are instantiated from props and after that manage and protect their own internal state (using actions). Moreover, when applying snapshots, tree nodes are reconciled as much as possible.

## Requirements

This library requires a more or less modern JavaScript environment to work, namely one with support for:

- MobX 6, 5, or 4 (with its gotchas)
- Proxies (when using MobX 5, or MobX 6 with the proxies setting enabled)
- Symbols
- WeakMap/WeakSet

In other words, it should work on mostly anything except _it won't work in Internet Explorer_.

If you are using TypeScript, then version >= 4.2.0 is recommended, though it _might_ work with older versions.

## Installation

> `npm install mobx-keystone`

> `yarn add mobx-keystone`
