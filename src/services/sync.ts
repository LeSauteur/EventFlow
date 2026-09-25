import type { EventFlowData } from './storage.ts'

export const SYNC_META_KEY = 'eventflow.syncMeta'
export const SYNC_TOKEN_KEY = 'eventflow.githubToken'
export const SYNC_INTERVAL_MS = 15_000
export const SYNC_DIRTY_THRESHOLD = 10

export const SHARED_COLLECTIONS = [
  'events',
  'tasks',
  'risks',
  'activities',
  'checklistItems',
  'questions',
  'contractors',
  'templates',
  'budgets',
] as const

export type SharedCollection = typeof SHARED_COLLECTIONS[number]
export type SharedData = Pick<EventFlowData, SharedCollection>
export type RecordVersions = Record<SharedCollection, Record<string, string>>
export type Tombstone = { id: string; deleted_at: string }
export type Tombstones = Record<SharedCollection, Tombstone[]>
export type SyncChangeSet = Partial<Record<SharedCollection, string[]>>

export interface SyncEnvelope {
  version: 1
  updated_at: string
  data: SharedData
  record_versions: RecordVersions
  tombstones: Tombstones
}

export interface SyncMeta {
  revision: number
  dirty: boolean
  dirtyCount: number
  lastOnlineSync: string | null
  autosavePaused: boolean
  initialized: boolean
  preferRemoteOnFirstLoad: boolean
  recordVersions: RecordVersions
  tombstones: Tombstones
}

export type SyncStatus = 'local' | 'dirty' | 'syncing' | 'online' | 'error'

export interface SyncViewState {
  status: SyncStatus
  dirty: boolean
  lastOnlineSync: string | null
  hasToken: boolean
  error: string | null
}

export interface RemoteFile {
  sha: string
  snapshot: SyncEnvelope
}

export interface SyncClient {
  get(): Promise<RemoteFile | null>
  put(snapshot: SyncEnvelope, sha?: string): Promise<void>
}

export interface SyncEngineOptions {
  storage: Storage
  sessionStorage: Storage
  getLocalData: () => EventFlowData
  applySharedData: (data: SharedData) => void
  client: SyncClient
  now?: () => Date
  setIntervalFn?: (callback: () => void, delay: number) => ReturnType<typeof setInterval>
  clearIntervalFn?: (timer: ReturnType<typeof setInterval>) => void
}

const EMPTY_ARRAYS: SharedData = {
  events: [], tasks: [], risks: [], activities: [], checklistItems: [], questions: [], contractors: [], templates: [], budgets: [],
}

function emptyVersions(): RecordVersions {
  return Object.fromEntries(SHARED_COLLECTIONS.map((key) => [key, {}])) as RecordVersions
}

function emptyTombstones(): Tombstones {
  return Object.fromEntries(SHARED_COLLECTIONS.map((key) => [key, []])) as unknown as Tombstones
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function safeIso(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback
}

function entityId(collection: SharedCollection, item: Record<string, unknown>): string {
  return String(collection === 'budgets' ? item.eventId ?? '' : item.id ?? '')
}

function entityTimestamp(item: Record<string, unknown>, fallback: string): string {
  for (const key of ['updatedAt', 'modifiedAt', 'timestamp', 'resolvedAt', 'createdAt', 'lastVerifiedAt']) {
    if (item[key]) return safeIso(item[key], fallback)
  }
  return fallback
}

function sharedFromData(data: Partial<EventFlowData> | Record<string, unknown>): SharedData {
  const result = clone(EMPTY_ARRAYS)
  for (const collection of SHARED_COLLECTIONS) {
    const value = data[collection]
    result[collection] = (Array.isArray(value) ? clone(value) : []) as never
  }
  return result
}

export function readSyncMeta(storage: Storage): SyncMeta {
  const fallback: SyncMeta = {
    revision: 0,
    dirty: false,
    dirtyCount: 0,
    lastOnlineSync: null,
    autosavePaused: false,
    initialized: false,
    preferRemoteOnFirstLoad: false,
    recordVersions: emptyVersions(),
    tombstones: emptyTombstones(),
  }
  const raw = storage.getItem(SYNC_META_KEY)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<SyncMeta>
    const versions = emptyVersions()
    const tombstones = emptyTombstones()
    for (const collection of SHARED_COLLECTIONS) {
      if (isRecord(parsed.recordVersions?.[collection])) versions[collection] = { ...parsed.recordVersions![collection] }
      if (Array.isArray(parsed.tombstones?.[collection])) tombstones[collection] = clone(parsed.tombstones![collection])
    }
    return {
      ...fallback,
      ...parsed,
      revision: Number.isFinite(parsed.revision) ? Number(parsed.revision) : 0,
      dirtyCount: Number.isFinite(parsed.dirtyCount) ? Number(parsed.dirtyCount) : 0,
      recordVersions: versions,
      tombstones,
    }
  } catch {
    return fallback
  }
}

export function writeSyncMeta(storage: Storage, meta: SyncMeta) {
  storage.setItem(SYNC_META_KEY, JSON.stringify(meta))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('eventflow-sync-meta'))
}

export function initializeSyncState(hadLocalData: boolean, storage: Storage = window.localStorage) {
  if (storage.getItem(SYNC_META_KEY)) return readSyncMeta(storage)
  const meta = readSyncMeta(storage)
  meta.preferRemoteOnFirstLoad = !hadLocalData
  writeSyncMeta(storage, meta)
  return meta
}

export function markSyncDirty(changes: SyncChangeSet, storage: Storage = window.localStorage, timestamp = new Date().toISOString()) {
  const meta = readSyncMeta(storage)
  meta.revision += 1
  meta.dirty = true
  meta.dirtyCount += 1
  for (const collection of SHARED_COLLECTIONS) {
    for (const id of changes[collection] ?? []) {
      if (id) meta.recordVersions[collection][id] = timestamp
    }
  }
  writeSyncMeta(storage, meta)
  return meta
}

export function markAllDataDirty(data: EventFlowData, storage: Storage = window.localStorage, timestamp = new Date().toISOString()) {
  const changes: SyncChangeSet = {}
  for (const collection of SHARED_COLLECTIONS) {
    changes[collection] = data[collection].map((item) => entityId(collection, item as unknown as Record<string, unknown>)).filter(Boolean)
  }
  return markSyncDirty(changes, storage, timestamp)
}

export function markDeleted(collection: SharedCollection, id: string, storage: Storage = window.localStorage, timestamp = new Date().toISOString()) {
  const meta = readSyncMeta(storage)
  meta.revision += 1
  meta.dirty = true
  meta.dirtyCount += 1
  meta.tombstones[collection] = [...meta.tombstones[collection].filter((item) => item.id !== id), { id, deleted_at: timestamp }]
  delete meta.recordVersions[collection][id]
  writeSyncMeta(storage, meta)
  return meta
}

export function snapshotFromLocal(data: EventFlowData, meta: SyncMeta, timestamp: string): SyncEnvelope {
  const shared = sharedFromData(data)
  const versions = clone(meta.recordVersions)
  for (const collection of SHARED_COLLECTIONS) {
    for (const item of shared[collection] as unknown as Record<string, unknown>[]) {
      const id = entityId(collection, item)
      if (id && !versions[collection][id]) versions[collection][id] = entityTimestamp(item, timestamp)
    }
  }
  return { version: 1, updated_at: timestamp, data: shared, record_versions: versions, tombstones: clone(meta.tombstones) }
}

export function normalizeSnapshot(value: unknown, fallbackTime = new Date(0).toISOString()): SyncEnvelope {
  const root = isRecord(value) ? value : {}
  const backupData = root.format === 'eventflow-backup' && isRecord(root.data) ? root.data : root
  const dataRoot = isRecord(root.data) && root.version !== undefined ? root.data : backupData
  const updatedAt = safeIso(root.updated_at ?? root.exportedAt, fallbackTime)
  const data = sharedFromData(dataRoot)
  const versions = emptyVersions()
  const providedVersions = isRecord(root.record_versions) ? root.record_versions : {}
  const tombstones = emptyTombstones()
  const providedTombstones = isRecord(root.tombstones) ? root.tombstones : {}
  for (const collection of SHARED_COLLECTIONS) {
    const supplied = providedVersions[collection]
    if (isRecord(supplied)) {
      for (const [id, timestamp] of Object.entries(supplied)) versions[collection][id] = safeIso(timestamp, updatedAt)
    }
    for (const item of data[collection] as unknown as Record<string, unknown>[]) {
      const id = entityId(collection, item)
      if (id && !versions[collection][id]) versions[collection][id] = entityTimestamp(item, updatedAt)
    }
    const deleted = providedTombstones[collection]
    if (Array.isArray(deleted)) {
      tombstones[collection] = deleted.filter(isRecord).map((item) => ({ id: String(item.id ?? ''), deleted_at: safeIso(item.deleted_at, updatedAt) })).filter((item) => item.id)
    }
  }
  return { version: 1, updated_at: updatedAt, data, record_versions: versions, tombstones }
}

function laterTimestamp(left?: string, right?: string) {
  return (left ?? '') >= (right ?? '') ? left : right
}

export function mergeSnapshots(local: SyncEnvelope, remote: SyncEnvelope, timestamp = new Date().toISOString()): SyncEnvelope {
  const data = clone(EMPTY_ARRAYS)
  const versions = emptyVersions()
  const tombstones = emptyTombstones()
  for (const collection of SHARED_COLLECTIONS) {
    const candidates = new Map<string, Record<string, unknown>>()
    for (const item of remote.data[collection] as unknown as Record<string, unknown>[]) candidates.set(entityId(collection, item), item)
    for (const item of local.data[collection] as unknown as Record<string, unknown>[]) {
      const id = entityId(collection, item)
      const existing = candidates.get(id)
      if (!existing || (local.record_versions[collection][id] ?? '') >= (remote.record_versions[collection][id] ?? '')) candidates.set(id, item)
    }
    const deleted = new Map<string, string>()
    for (const item of [...remote.tombstones[collection], ...local.tombstones[collection]]) {
      const previous = deleted.get(item.id)
      if (!previous || item.deleted_at > previous) deleted.set(item.id, item.deleted_at)
    }
    const mergedItems: Record<string, unknown>[] = []
    for (const [id, item] of candidates) {
      if (!id) continue
      const version = laterTimestamp(local.record_versions[collection][id], remote.record_versions[collection][id]) ?? timestamp
      const deletedAt = deleted.get(id)
      if (!deletedAt || version > deletedAt) {
        mergedItems.push(clone(item))
        versions[collection][id] = version
      }
    }
    data[collection] = mergedItems as never
    tombstones[collection] = [...deleted].map(([id, deleted_at]) => ({ id, deleted_at }))
  }
  return { version: 1, updated_at: timestamp, data, record_versions: versions, tombstones }
}

function snapshotsDiffer(left: SyncEnvelope, right: SyncEnvelope) {
  return JSON.stringify({ data: left.data, record_versions: left.record_versions, tombstones: left.tombstones }) !== JSON.stringify({ data: right.data, record_versions: right.record_versions, tombstones: right.tombstones })
}

function hasSharedRecords(snapshot: SyncEnvelope) {
  return SHARED_COLLECTIONS.some((collection) => snapshot.data[collection].length > 0) || SHARED_COLLECTIONS.some((collection) => snapshot.tombstones[collection].length > 0)
}

function safeSyncError(error: unknown) {
  if (error instanceof Error && /^GitHub API: HTTP \d{3}$/.test(error.message)) return `Онлайн-сохранение не удалось (${error.message}). Локальные данные сохранены.`
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const redacted = detail
    .replace(/github_pat_[A-Za-z0-9_]+/gi, '[token hidden]')
    .replace(/ghp_[A-Za-z0-9]+/gi, '[token hidden]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [token hidden]')
    .slice(0, 180)
  return `Онлайн-сохранение не удалось (${redacted}). Локальные данные сохранены.`
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export class SyncConflictError extends Error {
  constructor() { super('Конфликт версий GitHub') }
}

export class GitHubContentsClient implements SyncClient {
  private readonly tokenProvider: () => string | null
  private readonly fetchFn: typeof fetch
  private readonly owner: string
  private readonly repo: string
  private readonly path: string

  constructor(
    tokenProvider: () => string | null,
    fetchFn: typeof fetch = fetch,
    owner = 'LeSauteur',
    repo = 'EventFlow',
    path = 'data/eventflow-data.json',
  ) {
    this.tokenProvider = tokenProvider
    this.fetchFn = fetchFn.bind(globalThis)
    this.owner = owner
    this.repo = repo
    this.path = path
  }

  private headers(write = false) {
    const token = this.tokenProvider()
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(write ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  private url() {
    return `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`
  }

  async get(): Promise<RemoteFile | null> {
    const response = await this.fetchFn(`${this.url()}?ref=main`, { headers: this.headers(), cache: 'no-store' })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub API: HTTP ${response.status}`)
    const file = await response.json() as { sha?: string; content?: string }
    if (!file.sha || !file.content) throw new Error('Файл синхронизации имеет неверный формат')
    return { sha: file.sha, snapshot: normalizeSnapshot(JSON.parse(decodeBase64(file.content))) }
  }

  async put(snapshot: SyncEnvelope, sha?: string): Promise<void> {
    const token = this.tokenProvider()
    if (!token) throw new Error('Добавьте GitHub token для онлайн-сохранения')
    const response = await this.fetchFn(this.url(), {
      method: 'PUT',
      headers: this.headers(true),
      body: JSON.stringify({
        message: 'Sync EventFlow shared data',
        content: encodeBase64(`${JSON.stringify(snapshot, null, 2)}\n`),
        branch: 'main',
        ...(sha ? { sha } : {}),
      }),
    })
    if (response.status === 409) throw new SyncConflictError()
    if (!response.ok) throw new Error(`GitHub API: HTTP ${response.status}`)
  }
}

export class EventFlowSyncEngine {
  private readonly options: SyncEngineOptions
  private state: SyncViewState
  private listeners = new Set<(state: SyncViewState) => void>()
  private interval: ReturnType<typeof setInterval> | null = null
  private inFlight: Promise<boolean> | null = null
  private readonly now: () => Date
  private readonly setIntervalFn: NonNullable<SyncEngineOptions['setIntervalFn']>
  private readonly clearIntervalFn: NonNullable<SyncEngineOptions['clearIntervalFn']>
  private metaListener = () => {
    this.refreshFromMeta()
    const meta = readSyncMeta(this.options.storage)
    if (meta.dirtyCount >= SYNC_DIRTY_THRESHOLD && !meta.autosavePaused) void this.syncNow(false)
  }

  constructor(options: SyncEngineOptions) {
    this.options = options
    this.now = options.now ?? (() => new Date())
    this.setIntervalFn = options.setIntervalFn ?? ((callback, delay) => setInterval(callback, delay))
    this.clearIntervalFn = options.clearIntervalFn ?? ((timer) => clearInterval(timer))
    const meta = readSyncMeta(options.storage)
    this.state = {
      status: meta.dirty ? 'dirty' : 'local', dirty: meta.dirty, lastOnlineSync: meta.lastOnlineSync,
      hasToken: !!options.sessionStorage.getItem(SYNC_TOKEN_KEY), error: null,
    }
  }

  subscribe(listener: (state: SyncViewState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  getState() { return this.state }

  notifyLocalChange() { this.metaListener() }

  private update(next: Partial<SyncViewState>) {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener(this.state)
  }

  private refreshFromMeta() {
    const meta = readSyncMeta(this.options.storage)
    this.update({ dirty: meta.dirty, lastOnlineSync: meta.lastOnlineSync, status: this.state.status === 'syncing' ? 'syncing' : meta.dirty ? 'dirty' : meta.lastOnlineSync ? 'online' : 'local' })
  }

  async start() {
    if (typeof window !== 'undefined') window.addEventListener('eventflow-sync-meta', this.metaListener)
    this.interval = this.setIntervalFn(() => {
      const meta = readSyncMeta(this.options.storage)
      if (meta.dirty && !meta.autosavePaused && this.options.sessionStorage.getItem(SYNC_TOKEN_KEY)) void this.syncNow(false)
    }, SYNC_INTERVAL_MS)
    await this.loadOnline()
  }

  stop() {
    if (this.interval) this.clearIntervalFn(this.interval)
    this.interval = null
    if (typeof window !== 'undefined') window.removeEventListener('eventflow-sync-meta', this.metaListener)
  }

  setToken(token: string) {
    const clean = token.trim()
    if (clean) this.options.sessionStorage.setItem(SYNC_TOKEN_KEY, clean)
    else this.options.sessionStorage.removeItem(SYNC_TOKEN_KEY)
    this.update({ hasToken: !!clean, error: null })
  }

  clearToken() {
    this.options.sessionStorage.removeItem(SYNC_TOKEN_KEY)
    this.update({ hasToken: false, error: null })
  }

  async loadOnline() {
    try {
      const remote = await this.options.client.get()
      const meta = readSyncMeta(this.options.storage)
      if (!remote) {
        meta.initialized = true
        meta.preferRemoteOnFirstLoad = false
        writeSyncMeta(this.options.storage, meta)
        this.refreshFromMeta()
        return
      }
      const timestamp = this.now().toISOString()
      const local = snapshotFromLocal(this.options.getLocalData(), meta, timestamp)
      const useRemote = !meta.initialized && meta.preferRemoteOnFirstLoad && hasSharedRecords(remote.snapshot)
      const merged = useRemote ? remote.snapshot : mergeSnapshots(local, remote.snapshot, timestamp)
      this.options.applySharedData(merged.data)
      meta.recordVersions = merged.record_versions
      meta.tombstones = merged.tombstones
      meta.initialized = true
      meta.preferRemoteOnFirstLoad = false
      meta.lastOnlineSync = remote.snapshot.updated_at
      meta.dirty = useRemote ? false : snapshotsDiffer(merged, remote.snapshot)
      meta.dirtyCount = meta.dirty ? Math.max(1, meta.dirtyCount) : 0
      writeSyncMeta(this.options.storage, meta)
      this.update({ status: meta.dirty ? 'dirty' : 'online', dirty: meta.dirty, lastOnlineSync: meta.lastOnlineSync, error: null })
    } catch {
      this.refreshFromMeta()
    }
  }

  syncNow(manual = true): Promise<boolean> {
    if (this.inFlight) return this.inFlight
    if (manual) {
      const meta = readSyncMeta(this.options.storage)
      meta.autosavePaused = false
      writeSyncMeta(this.options.storage, meta)
    }
    if (!this.options.sessionStorage.getItem(SYNC_TOKEN_KEY)) {
      this.update({ status: manual ? 'error' : 'dirty', error: manual ? 'Добавьте GitHub token для онлайн-сохранения' : null })
      return Promise.resolve(false)
    }
    this.inFlight = this.performSync().finally(() => { this.inFlight = null })
    return this.inFlight
  }

  private async performSync() {
    this.update({ status: 'syncing', error: null })
    let conflictCount = 0
    try {
      while (conflictCount < 2) {
        const remote = await this.options.client.get()
        const meta = readSyncMeta(this.options.storage)
        const timestamp = this.now().toISOString()
        const local = snapshotFromLocal(this.options.getLocalData(), meta, timestamp)
        const upload = remote ? mergeSnapshots(local, remote.snapshot, timestamp) : local
        this.options.applySharedData(upload.data)
        const revisionForUpload = meta.revision
        try {
          await this.options.client.put(upload, remote?.sha)
          const current = readSyncMeta(this.options.storage)
          current.recordVersions = mergeSnapshots(snapshotFromLocal(this.options.getLocalData(), current, timestamp), upload, timestamp).record_versions
          current.tombstones = mergeSnapshots(snapshotFromLocal(this.options.getLocalData(), current, timestamp), upload, timestamp).tombstones
          current.lastOnlineSync = timestamp
          current.autosavePaused = false
          if (current.revision === revisionForUpload) {
            current.dirty = false
            current.dirtyCount = 0
          }
          writeSyncMeta(this.options.storage, current)
          this.update({ status: current.dirty ? 'dirty' : 'online', dirty: current.dirty, lastOnlineSync: timestamp, error: null })
          return true
        } catch (error) {
          if (!(error instanceof SyncConflictError)) throw error
          conflictCount += 1
          if (conflictCount >= 2) throw error
        }
      }
    } catch (error) {
      const meta = readSyncMeta(this.options.storage)
      if (error instanceof SyncConflictError) meta.autosavePaused = true
      meta.dirty = true
      writeSyncMeta(this.options.storage, meta)
      this.update({ status: 'error', dirty: true, error: error instanceof SyncConflictError ? 'Конфликт не удалось разрешить. Автосохранение приостановлено.' : safeSyncError(error) })
      return false
    }
    return false
  }
}
