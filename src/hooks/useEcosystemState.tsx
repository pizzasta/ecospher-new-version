import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type EcosystemPage =
  | 'home'
  | 'signals'
  | 'drift'
  | 'rooms'
  | 'unsent'
  | 'capsules'
  | 'relics'
  | 'pod'
  | 'zones'
  | 'frequencies'
  | 'anomalies'
  | 'settings'

export type EcosystemInteractionType =
  | 'page_visit'
  | 'signal_play'
  | 'signal_saved'
  | 'room_enter'
  | 'drift_activity'
  | 'drift_discovery'
  | 'capsule_saved'
  | 'capsule_opened'
  | 'relic_unlocked'
  | 'archived'
  | 'voice_reaction'
  | 'rare_event'

export type EcosystemInteraction = {
  id: string
  type: EcosystemInteractionType
  label: string
  page?: EcosystemPage
  createdAt: string
}

export type ArchiveEntry = {
  id: string
  itemType: 'signal' | 'capsule' | 'relic' | 'audio' | 'room'
  label: string
  archivedAt: string
}

export type LibraryEntry = {
  id: string
  itemType: 'signal' | 'audio' | 'capsule' | 'relic' | 'drift'
  label: string
  savedAt: string
  favorite: boolean
}

export type ListeningEntry = {
  id: string
  label: string
  playedAt: string
}

export type ActiveAudio = {
  id: string
  label: string
  source: EcosystemPage
}

export type EcosystemState = {
  currentPage: EcosystemPage
  activeSignal: string | null
  activeRoom: string | null
  activeAudio: ActiveAudio | null
  resonanceLevel: number
  driftActivity: number
  roomActivity: number
  rareEvent: string | null
  currentAtmosphere: string | null
  userSignalIdentity: string | null
  playedSignals: string[]
  savedSignals: string[]
  unlockedRelics: string[]
  savedCapsules: string[]
  openedCapsules: string[]
  driftDiscoveries: string[]
  savedRooms: string[]
  library: LibraryEntry[]
  archiveHistory: ArchiveEntry[]
  listeningHistory: ListeningEntry[]
  recentInteractions: EcosystemInteraction[]
}

const ecosystemStateStorageKey = 'ecosphere:EcosystemState'
const signalIdentityStorageKey = 'signalIdentity'
const maxRecentInteractions = 18
const maxHistoryEntries = 30

const defaultEcosystemState: EcosystemState = {
  currentPage: 'home',
  activeSignal: null,
  activeRoom: null,
  activeAudio: null,
  resonanceLevel: 42,
  driftActivity: 18,
  roomActivity: 0,
  rareEvent: null,
  currentAtmosphere: null,
  userSignalIdentity: null,
  playedSignals: [],
  savedSignals: [],
  unlockedRelics: [],
  savedCapsules: [],
  openedCapsules: [],
  driftDiscoveries: [],
  savedRooms: [],
  library: [],
  archiveHistory: [],
  listeningHistory: [],
  recentInteractions: [],
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function createInteraction(type: EcosystemInteractionType, label: string, page?: EcosystemPage): EcosystemInteraction {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label,
    page,
    createdAt: new Date().toISOString(),
  }
}

function addInteraction(state: EcosystemState, interaction: EcosystemInteraction) {
  return [interaction, ...state.recentInteractions].slice(0, maxRecentInteractions)
}

function addUnique(list: string[], value: string, max = 40) {
  return list.includes(value) ? list : [value, ...list].slice(0, max)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function readStoredState(): EcosystemState {
  if (typeof window === 'undefined') {
    return defaultEcosystemState
  }

  let storedIdentity: string | null = null
  try {
    storedIdentity = window.localStorage.getItem(signalIdentityStorageKey)
  } catch {
    return defaultEcosystemState
  }

  try {
    const stored = window.localStorage.getItem(ecosystemStateStorageKey)
    if (!stored) {
      return { ...defaultEcosystemState, userSignalIdentity: storedIdentity }
    }

    const parsed = JSON.parse(stored) as Partial<EcosystemState>
    return {
      ...defaultEcosystemState,
      ...parsed,
      currentPage: parsed.currentPage ?? 'home',
      activeAudio: null,
      resonanceLevel: clamp(Number(parsed.resonanceLevel ?? defaultEcosystemState.resonanceLevel)),
      driftActivity: clamp(Number(parsed.driftActivity ?? defaultEcosystemState.driftActivity)),
      roomActivity: clamp(Number(parsed.roomActivity ?? 0)),
      userSignalIdentity: storedIdentity || parsed.userSignalIdentity || null,
      playedSignals: stringArray(parsed.playedSignals),
      savedSignals: stringArray(parsed.savedSignals),
      unlockedRelics: stringArray(parsed.unlockedRelics),
      savedCapsules: stringArray(parsed.savedCapsules),
      openedCapsules: stringArray(parsed.openedCapsules),
      driftDiscoveries: stringArray(parsed.driftDiscoveries),
      savedRooms: stringArray(parsed.savedRooms),
      library: Array.isArray(parsed.library) ? parsed.library.slice(0, 60) : [],
      archiveHistory: Array.isArray(parsed.archiveHistory) ? parsed.archiveHistory.slice(0, maxHistoryEntries) : [],
      listeningHistory: Array.isArray(parsed.listeningHistory) ? parsed.listeningHistory.slice(0, maxHistoryEntries) : [],
      recentInteractions: Array.isArray(parsed.recentInteractions) ? parsed.recentInteractions.slice(0, maxRecentInteractions) : [],
    }
  } catch {
    try {
      window.localStorage.removeItem(ecosystemStateStorageKey)
    } catch { /* storage unavailable */ }
    return { ...defaultEcosystemState, userSignalIdentity: storedIdentity }
  }
}

function useEcosystemStore() {
  const [state, setState] = useState<EcosystemState>(readStoredState)

  useEffect(() => {
    try {
      // activeAudio is session-only; never resurrect a "playing" state on reload
      window.localStorage.setItem(ecosystemStateStorageKey, JSON.stringify({ ...state, activeAudio: null }))
    } catch { /* storage unavailable */ }
  }, [state])

  const updateState = useCallback((updater: (current: EcosystemState) => EcosystemState) => {
    setState((current) => updater(current))
  }, [])

  const visitPage = useCallback((page: EcosystemPage) => {
    updateState((current) => {
      let storedIdentity: string | null = null
      try {
        storedIdentity = window.localStorage.getItem(signalIdentityStorageKey)
      } catch { /* storage unavailable */ }
      return {
        ...current,
        currentPage: page,
        userSignalIdentity: storedIdentity || current.userSignalIdentity,
        resonanceLevel: clamp(current.resonanceLevel + 1),
        recentInteractions: addInteraction(current, createInteraction('page_visit', `entered ${page}`, page)),
      }
    })
  }, [updateState])

  const playSignal = useCallback((signalId: string, resonanceBoost = 6, label?: string) => {
    updateState((current) => ({
      ...current,
      activeSignal: signalId,
      playedSignals: addUnique(current.playedSignals, signalId),
      listeningHistory: [
        { id: signalId, label: label ?? signalId, playedAt: new Date().toISOString() },
        ...current.listeningHistory,
      ].slice(0, maxHistoryEntries),
      resonanceLevel: clamp(current.resonanceLevel + resonanceBoost),
      rareEvent: current.resonanceLevel + resonanceBoost >= 92 ? 'quiet replay activity detected' : current.rareEvent,
      recentInteractions: addInteraction(current, createInteraction('signal_play', `played ${label ?? signalId}`, current.currentPage)),
    }))
  }, [updateState])

  const saveToLibrary = useCallback((itemType: LibraryEntry['itemType'], id: string, label: string) => {
    updateState((current) => {
      if (current.library.some((entry) => entry.itemType === itemType && entry.id === id)) return current
      return {
        ...current,
        savedSignals: itemType === 'signal' ? addUnique(current.savedSignals, id) : current.savedSignals,
        library: [
          { id, itemType, label, savedAt: new Date().toISOString(), favorite: false },
          ...current.library,
        ].slice(0, 60),
        resonanceLevel: clamp(current.resonanceLevel + 3),
        recentInteractions: addInteraction(current, createInteraction('signal_saved', `kept ${label}`, current.currentPage)),
      }
    })
  }, [updateState])

  const saveSignal = useCallback((signalId: string, label?: string) => {
    saveToLibrary('signal', signalId, label ?? signalId)
  }, [saveToLibrary])

  const unsaveFromLibrary = useCallback((itemType: LibraryEntry['itemType'], id: string) => {
    updateState((current) => ({
      ...current,
      savedSignals: itemType === 'signal' ? current.savedSignals.filter((sid) => sid !== id) : current.savedSignals,
      library: current.library.filter((entry) => !(entry.itemType === itemType && entry.id === id)),
    }))
  }, [updateState])

  const toggleLibraryFavorite = useCallback((itemType: LibraryEntry['itemType'], id: string) => {
    updateState((current) => ({
      ...current,
      library: current.library.map((entry) =>
        entry.itemType === itemType && entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
      ),
    }))
  }, [updateState])

  const setActiveAudio = useCallback((audio: ActiveAudio | null) => {
    updateState((current) => (current.activeAudio?.id === audio?.id && current.activeAudio?.label === audio?.label
      ? current
      : { ...current, activeAudio: audio }))
  }, [updateState])

  const enterRoom = useCallback((roomId: string) => {
    updateState((current) => ({
      ...current,
      activeRoom: roomId,
      roomActivity: clamp(current.roomActivity + 6),
      resonanceLevel: clamp(current.resonanceLevel + 3),
      recentInteractions: addInteraction(current, createInteraction('room_enter', `entered chamber ${roomId}`, current.currentPage)),
    }))
  }, [updateState])

  const saveRoom = useCallback((roomId: string) => {
    updateState((current) => ({
      ...current,
      savedRooms: addUnique(current.savedRooms, roomId, 16),
    }))
  }, [updateState])

  const exploreDrift = useCallback((label = 'drift field explored') => {
    updateState((current) => ({
      ...current,
      driftActivity: clamp(current.driftActivity + 8),
      resonanceLevel: clamp(current.resonanceLevel + 2),
      rareEvent: current.driftActivity >= 80 ? 'memory current unstable' : current.rareEvent,
      recentInteractions: addInteraction(current, createInteraction('drift_activity', label, 'drift')),
    }))
  }, [updateState])

  const discoverDrift = useCallback((discoveryId: string, label: string) => {
    updateState((current) => {
      if (current.driftDiscoveries.includes(discoveryId)) return current
      return {
        ...current,
        driftDiscoveries: addUnique(current.driftDiscoveries, discoveryId),
        library: [
          { id: discoveryId, itemType: 'drift' as const, label, savedAt: new Date().toISOString(), favorite: false },
          ...current.library.filter((entry) => !(entry.itemType === 'drift' && entry.id === discoveryId)),
        ].slice(0, 60),
        driftActivity: clamp(current.driftActivity + 10),
        resonanceLevel: clamp(current.resonanceLevel + 5),
        recentInteractions: addInteraction(current, createInteraction('drift_discovery', label, 'drift')),
      }
    })
  }, [updateState])

  const saveCapsule = useCallback((capsuleId: string) => {
    updateState((current) => ({
      ...current,
      savedCapsules: addUnique(current.savedCapsules, capsuleId, 24),
      resonanceLevel: clamp(current.resonanceLevel + 4),
      recentInteractions: addInteraction(current, createInteraction('capsule_saved', `saved capsule ${capsuleId}`, 'capsules')),
    }))
  }, [updateState])

  const openCapsule = useCallback((capsuleId: string, label?: string) => {
    updateState((current) => {
      const alreadyOpened = current.openedCapsules.includes(capsuleId)
      return {
        ...current,
        openedCapsules: addUnique(current.openedCapsules, capsuleId, 24),
        resonanceLevel: clamp(current.resonanceLevel + (alreadyOpened ? 1 : 5)),
        archiveHistory: alreadyOpened
          ? current.archiveHistory
          : [
              { id: `${capsuleId}-${Date.now()}`, itemType: 'capsule' as const, label: label ?? capsuleId, archivedAt: new Date().toISOString() },
              ...current.archiveHistory,
            ].slice(0, maxHistoryEntries),
        recentInteractions: alreadyOpened
          ? current.recentInteractions
          : addInteraction(current, createInteraction('capsule_opened', `opened ${label ?? capsuleId}`, 'capsules')),
      }
    })
  }, [updateState])

  const unlockRelic = useCallback((relicId: string, label?: string) => {
    updateState((current) => {
      if (current.unlockedRelics.includes(relicId)) return current
      return {
        ...current,
        unlockedRelics: addUnique(current.unlockedRelics, relicId, 24),
        resonanceLevel: clamp(current.resonanceLevel + 7),
        rareEvent: `relic unlocked: ${label ?? relicId}`,
        recentInteractions: addInteraction(current, createInteraction('relic_unlocked', `discovered relic ${label ?? relicId}`, 'relics')),
      }
    })
  }, [updateState])

  const archiveEntry = useCallback((itemType: ArchiveEntry['itemType'], label: string) => {
    updateState((current) => ({
      ...current,
      archiveHistory: [
        { id: `${itemType}-${Date.now()}`, itemType, label, archivedAt: new Date().toISOString() },
        ...current.archiveHistory,
      ].slice(0, maxHistoryEntries),
      recentInteractions: addInteraction(current, createInteraction('archived', `archived ${label}`, current.currentPage)),
    }))
  }, [updateState])

  const reactToSignal = useCallback((signalId: string, label: string) => {
    updateState((current) => ({
      ...current,
      resonanceLevel: clamp(current.resonanceLevel + 2),
      recentInteractions: addInteraction(current, createInteraction('voice_reaction', label, current.currentPage)),
    }))
  }, [updateState])

  const setRareEvent = useCallback((event: string | null) => {
    updateState((current) => ({
      ...current,
      rareEvent: event,
      recentInteractions: event
        ? addInteraction(current, createInteraction('rare_event', event, current.currentPage))
        : current.recentInteractions,
    }))
  }, [updateState])

  const setAtmosphere = useCallback((atmosphere: string | null) => {
    updateState((current) => (current.currentAtmosphere === atmosphere ? current : { ...current, currentAtmosphere: atmosphere }))
  }, [updateState])

  return useMemo(() => ({
    ecosystemState: state,
    archiveEntry,
    discoverDrift,
    enterRoom,
    exploreDrift,
    openCapsule,
    playSignal,
    reactToSignal,
    saveCapsule,
    saveRoom,
    saveSignal,
    saveToLibrary,
    setActiveAudio,
    setAtmosphere,
    setRareEvent,
    toggleLibraryFavorite,
    unlockRelic,
    unsaveFromLibrary,
    visitPage,
  }), [
    state,
    archiveEntry,
    discoverDrift,
    enterRoom,
    exploreDrift,
    openCapsule,
    playSignal,
    reactToSignal,
    saveCapsule,
    saveRoom,
    saveSignal,
    saveToLibrary,
    setActiveAudio,
    setAtmosphere,
    setRareEvent,
    toggleLibraryFavorite,
    unlockRelic,
    unsaveFromLibrary,
    visitPage,
  ])
}

export type EcosystemStore = ReturnType<typeof useEcosystemStore>

const EcosystemContext = createContext<EcosystemStore | null>(null)

/**
 * Single shared ecosystem store. Mount once near the root; every page and
 * system reads/writes the same living state.
 */
export function EcosystemProvider({ children }: { children: ReactNode }) {
  const store = useEcosystemStore()
  return <EcosystemContext.Provider value={store}>{children}</EcosystemContext.Provider>
}

export function useEcosystemState(): EcosystemStore {
  const ctx = useContext(EcosystemContext)
  if (!ctx) {
    throw new Error('useEcosystemState must be used inside <EcosystemProvider>')
  }
  return ctx
}
