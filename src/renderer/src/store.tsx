import React, { useCallback, useSyncExternalStore } from 'react'

/** A small observable store modeled after Flutter's ChangeNotifier. */
export class Store {
  private listeners = new Set<() => void>()
  private _version = 0

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notifyListeners(): void {
    this._version = (this._version + 1) % Number.MAX_SAFE_INTEGER
    for (const listener of this.listeners) listener()
  }

  get version(): number {
    return this._version
  }
}

const StoreRegistryContext = React.createContext<Map<Function, Store> | null>(null)

export function StoreProvider<T extends Store>({
  create,
  children,
}: {
  create: () => T
  children: React.ReactNode
}) {
  const parentRegistry = React.useContext(StoreRegistryContext)
  const [store] = React.useState(create)
  const registry = React.useMemo(() => {
    const next = new Map(parentRegistry)
    next.set(store.constructor, store)
    return next
  }, [parentRegistry, store])
  return <StoreRegistryContext.Provider value={registry}>{children}</StoreRegistryContext.Provider>
}

export function useReader<T extends Store>(StoreClass: new (...args: never[]) => T): T {
  const registry = React.useContext(StoreRegistryContext)
  if (registry === null) throw new Error('useReader must be used within a StoreProvider')
  const store = registry.get(StoreClass)
  if (!store) throw new Error(`No store found for ${StoreClass.name}`)
  return store as T
}

export function useWatcher<T extends Store>(StoreClass: new (...args: never[]) => T): T {
  const store = useReader(StoreClass)
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  useSyncExternalStore(
    subscribe,
    () => store.version,
    () => store.version,
  )
  return store
}

export function useSelector<T extends Store, U>(
  StoreClass: new (...args: never[]) => T,
  selector: (store: T) => U,
): U {
  const store = useReader(StoreClass)
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  return useSyncExternalStore(
    subscribe,
    () => selector(store),
    () => selector(store),
  )
}
