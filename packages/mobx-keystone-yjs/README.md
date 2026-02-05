<p align="center">
  <h1 align="center">mobx-keystone-yjs</h1>
</p>
<p align="center">
  <i>Seamlessly integrate mobx-keystone models with the Y.js ecosystem for an unmatched toolkit to build dynamic, responsive, and collaborative web applications</i>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/mobx-keystone-yjs">
    <img src="https://img.shields.io/npm/v/mobx-keystone-yjs.svg?style=for-the-badge&logo=npm&labelColor=333" />
  </a>
  <a aria-label="License" href="./LICENSE">
    <img src="https://img.shields.io/npm/l/mobx-keystone-yjs.svg?style=for-the-badge&labelColor=333" />
  </a>
  <a aria-label="Types" href="./packages/mobx-keystone-yjs/tsconfig.json">
    <img src="https://img.shields.io/npm/types/mobx-keystone-yjs.svg?style=for-the-badge&logo=typescript&labelColor=333" />
  </a>
  <br />
  <a aria-label="CI" href="https://github.com/xaviergonz/mobx-keystone/actions/workflows/main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/xaviergonz/mobx-keystone/main.yml?branch=master&label=CI&logo=github&style=for-the-badge&labelColor=333" />
  </a>
</p>

> ## See a [working example](https://mobx-keystone.js.org/examples/yjs-binding) in [mobx-keystone.js.org](https://mobx-keystone.js.org)

## Introduction

`mobx-keystone-yjs` seamlessly integrates `mobx-keystone` models with the `Y.js` ecosystem, providing developers with an unmatched toolkit to build dynamic, responsive, and collaborative web applications. Some of the key advantages and capabilities that this integration brings to your projects are:

## Real-time Collaboration and Synchronization

`mobx-keystone-yjs` bridges the gap between local state management and remote synchronization, allowing multiple users to interact with the same application data in real-time. This synchronization is not just limited to client-server models but extends to peer-to-peer (P2P) environments as well. Whether you're building a collaborative text editor, a shared to-do list, or any interactive platform, this binding ensures that all participants can see and respond to changes instantly, no matter where they are, transparently.

## Offline Support and Optimistic UI Changes

One of the standout features of `Y.js` is its robust offline support. Users can continue to interact with the application even when disconnected from the network. Changes made offline are seamlessly integrated once the connection is reestablished, thanks to the conflict-free replicated data types (CRDTs) at the heart of `Y.js`. This functionality not only enhances the user experience but also ensures data integrity and consistency across all states. Binding this functionality to `mobx-keystone` models means that you can take advantage of these features without having to write any additional code.

Optimistic UI updates play a crucial role in making applications feel more responsive. With CRDTs changes made by users can be immediately reflected in the UI, without waiting for server confirmation. This approach minimizes perceived latency, providing a smoother and more engaging user experience.

## Client Synchronization and Data Integrity

Binding `Y.js` and `mobx-keystone` ensures that client states are synchronized efficiently and accurately. The models are automatically updated to reflect the latest shared state, ensuring that all users have a consistent view of the data. Furthermore, the use of CRDTs in `Y.js` guarantees that even in complex, multi-user scenarios, data integrity is maintained. Conflicts are resolved automatically, ensuring that the final state is always a true representation of all users' inputs.

## P2P Support and Scalability

By leveraging `Y.js`'s P2P capabilities, `mobx-keystone-yjs` enables direct client-to-client communication, bypassing traditional server-based data flow. This not only reduces server load but also opens up new possibilities for applications where direct user-to-user interaction is preferred. The scalability offered by this approach means that your application can support a growing number of users without a proportional increase in server resources.

## Installation

> `npm install mobx-keystone-yjs`

> `yarn add mobx-keystone-yjs`

> `pnpm add mobx-keystone-yjs`
