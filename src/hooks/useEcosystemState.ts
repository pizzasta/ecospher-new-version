import { useCallback, useEffect, useMemo, useState } from 'react'

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
  | 'room_enter'
  | 'drift_activity'
  | 'capsule_saved'
  | 'relic_unlocked'
  | 'rare_event'

export type EcosystemInteraction = {
  id: string
  type: EcosystemInteractionType
  label: string
  page?: EcosystemPage
  createdAt: string
}

export type EcosystemState = {
  currentPage: EcosystemPage
  activeSignal: string | null
  activeRoom: string | null
  resonanceLevel: number
  driftActivity: number
  rareEvent: string | null
  userSignalIdentity: string | null
  unlockedRelics: string[]
  savedCapsules: string[]
  recentInteractions: EcosystemInteraction[]
}

const ecosystemStateStorageKey = 'ecosphere:EcosystemState'
const signalIdentityStorageKey = 'signalIdentity'
const maxRecentInteractions = 18

const defaultEcosystemState: EcosystemState = {
  currentPage: 'home',
  activeSignal: null,
  activeRoom: null,
  resonanceLevel: 42,
  driftActivity: 18,
  rareEvent: null,
  userSignalIdentity: null,
  unlockedRelics: [],
  savedCapsules: [],
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

function readStoredState(): EcosystemState {
  if (typeof window === 'undefined') {
    return defaultEcosystemState
  }

  const storedIdentity = window.localStorage.getItem(signalIdentityStorageKey)

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
      resonanceLevel: clamp(Number(parsed.resonanceLevel ?? defaultEcosystemState.resonanceLevel)),
      driftActivity: clamp(Number(parsed.driftActivity ?? defaultEcosystemState.driftActivity)),
      userSignalIdentity: storedIdentity || parsed.userSignalIdentity || null,
      unlockedRelics: Array.isArray(parsed.unlockedRelics) ? parsed.unlockedRelics : [],
      savedCapsules: Array.isArray(parsed.savedCapsules) ? parsed.savedCapsules : [],
      recentInteractions: Array.isArray(parsed.recentInteractions) ? parsed.recentInteractions.slice(0, maxRecentInteractions) : [],
    }
  } catch {
    window.localStorage.removeItem(ecosystemStateStorageKey)
    return { ...defaultEcosystemState, userSignalIdentity: storedIdentity }
  }
}

export function useEcosystemState() {
  const [state, setState] = useState<EcosystemState>(readStoredState)

  useEffect(() => {
    window.localStorage.setItem(ecosystemStateStorageKey, JSON.stringify(state))
  }, [state])

  const updateState = useCallback((updater: (current: EcosystemState) => EcosystemState) => {
    setState((current) => updater(current))
  }, [])

  const visitPage = useCallback((page: EcosystemPage) => {
    updateState((current) => ({
      ...current,
      currentPage: page,
      userSignalIdentity: window.localStorage.getItem(signalIdentityStorageKey) || current.userSignalIdentity,
      resonanceLevel: clamp(current.resonanceLevel + 1),
      recentInteractions: addInteraction(current, createInteraction('page_visit', `entered ${page}`, page)),
    }))
  }, [updateState])

  const playSignal = useCallback((signalId: string, resonanceBoost = 6) => {
    updateState((current) => ({
      ...current,
      activeSignal: signalId,
      resonanceLevel: clamp(current.resonanceLevel + resonanceBoost),
      rareEvent: current.resonanceLevel + resonanceBoost >= 92 ? 'quiet replay activity detected' : current.rareEvent,
      recentInteractions: addInteraction(current, createInteraction('signal_play', `played signal ${signalId}`, current.currentPage)),
    }))
  }, [updateState])

  const enterRoom = useCallback((roomId: string) => {
    updateState((current) => ({
      ...current,
      activeRoom: roomId,
      resonanceLevel: clamp(current.resonanceLevel + 3),
      recentInteractions: addInteraction(current, createInteraction('room_enter', `entered chamber ${roomId}`, current.currentPage)),
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

  const saveCapsule = useCallback((capsuleId: string) => {
    updateState((current) => {
      const savedCapsules = current.savedCapsules.includes(capsuleId)
        ? current.savedCapsules
        : [capsuleId, ...current.savedCapsules].slice(0, 24)

      return {
        ...current,
        savedCapsules,
        resonanceLevel: clamp(current.resonanceLevel + 4),
        recentInteractions: addInteraction(current, createInteraction('capsule_saved', `saved capsule ${capsuleId}`, 'capsules')),
      }
    })
  }, [updateState])

  const unlockRelic = useCallback((relicId: string) => {
    updateState((current) => {
      const unlockedRelics = current.unlockedRelics.includes(relicId)
        ? current.unlockedRelics
        : [relicId, ...current.unlockedRelics].slice(0, 24)

      return {
        ...current,
        unlockedRelics,
        resonanceLevel: clamp(current.resonanceLevel + 7),
        rareEvent: `relic unlocked: ${relicId}`,
        recentInteractions: addInteraction(current, createInteraction('relic_unlocked', `discovered relic ${relicId}`, 'relics')),
      }
    })
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

  return useMemo(() => ({
    ecosystemState: state,
    enterRoom,
    exploreDrift,
    playSignal,
    saveCapsule,
    setRareEvent,
    unlockRelic,
    visitPage,
  }), [enterRoom, exploreDrift, playSignal, saveCapsule, setRareEvent, state, unlockRelic, visitPage])
}
