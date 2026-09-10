import { _isComputingDerivation, createAtom, type IAtom } from "mobx"

/**
 * Tracks MobX atoms for native CRDT collections, so that reading a value
 * through a binding inside a derivation re-runs it when that value changes.
 *
 * Atoms are scoped by an object (the native collection itself, or the binding
 * root when the backend hands out throwaway wrappers for the same container),
 * then by a container id within that scope, then by key. Maps track individual
 * keys; arrays track the whole collection under the `undefined` key, because a
 * splice can change the value at every subsequent index.
 *
 * @internal
 */
export class CrdtCollectionAtoms<TScope extends object, TId> {
  private readonly scopes = new WeakMap<TScope, Map<TId, Map<string | undefined, IAtom>>>()

  /**
   * The atom tracking a collection key, if anything is currently observing it.
   */
  get(scope: TScope, id: TId, key?: string): IAtom | undefined {
    return this.scopes.get(scope)?.get(id)?.get(key)
  }

  /**
   * Notifies observers that a collection key changed.
   */
  reportChanged(scope: TScope, id: TId, key?: string): void {
    this.get(scope, id, key)?.reportChanged()
  }

  /**
   * Registers the current derivation as an observer of a collection key.
   *
   * Path resolution mostly runs while writing to the document, outside any
   * derivation. `reportObserved` would be a no-op there, so skip resolving the
   * container id and allocating a throwaway atom.
   */
  reportObserved(scope: TScope, getId: () => TId, key?: string): void {
    if (!_isComputingDerivation()) {
      return
    }

    const id = getId()
    let containers = this.scopes.get(scope)
    if (!containers) {
      containers = new Map()
      this.scopes.set(scope, containers)
    }

    const existing = containers.get(id)?.get(key)
    if (existing) {
      existing.reportObserved()
      return
    }

    const atom = createAtom("crdtCollectionAtom", undefined, () => {
      const keys = containers.get(id)
      if (keys?.get(key) === atom) {
        keys.delete(key)
        if (keys.size === 0) {
          containers.delete(id)
        }
      }
    })

    if (atom.reportObserved()) {
      let keys = containers.get(id)
      if (!keys) {
        keys = new Map()
        containers.set(id, keys)
      }
      keys.set(key, atom)
    }
  }
}
