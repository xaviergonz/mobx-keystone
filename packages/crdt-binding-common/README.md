# CRDT binding snapshot helpers

Private, source-only workspace package shared by the Yjs and Loro bindings.
It contains snapshot merging, JSON equality, and change-time snapshot capture;
transaction lifecycles and native container operations stay in each binding.

Both bindings declare this package as a development dependency and bundle its
implementation into their published builds. It must not be externalized or
exposed in their public declarations. No separate build or publication is needed.

Unit tests live in `test/`; the binding packages retain their integration tests.
Root Yjs and Loro test commands run the shared suite through Turbo, including CI.
Run it directly with `pnpm --dir packages/crdt-binding-common test` (build core
first), and type-check it with `pnpm --dir packages/crdt-binding-common quick-build-tests`.
