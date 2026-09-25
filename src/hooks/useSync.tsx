import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useEventFlowData } from './useEventFlowData.tsx'
import { loadAll, saveAll } from '../services/storage.ts'
import { EventFlowSyncEngine, GitHubContentsClient, SYNC_TOKEN_KEY, type SharedData, type SyncViewState } from '../services/sync.ts'

interface SyncContextValue extends SyncViewState {
  saveNow: () => Promise<boolean>
  setToken: (token: string) => void
  clearToken: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

const initialState: SyncViewState = {
  status: 'local',
  dirty: false,
  lastOnlineSync: null,
  hasToken: false,
  error: null,
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { reloadData } = useEventFlowData()
  const reloadRef = useRef(reloadData)
  reloadRef.current = reloadData
  const [state, setState] = useState<SyncViewState>(() => ({ ...initialState, hasToken: !!window.sessionStorage.getItem(SYNC_TOKEN_KEY) }))

  const engine = useMemo(() => {
    const applySharedData = (shared: SharedData) => {
      saveAll({ ...loadAll(), ...shared })
      reloadRef.current()
    }
    const client = new GitHubContentsClient(() => window.sessionStorage.getItem(SYNC_TOKEN_KEY))
    return new EventFlowSyncEngine({
      storage: window.localStorage,
      sessionStorage: window.sessionStorage,
      getLocalData: () => loadAll(),
      applySharedData,
      client,
    })
  }, [])

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState)
    void engine.start()
    return () => { unsubscribe(); engine.stop() }
  }, [engine])

  const value = useMemo<SyncContextValue>(() => ({
    ...state,
    saveNow: () => engine.syncNow(true),
    setToken: (token) => engine.setToken(token),
    clearToken: () => engine.clearToken(),
  }), [engine, state])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const value = useContext(SyncContext)
  if (!value) throw new Error('useSync must be used inside SyncProvider')
  return value
}
