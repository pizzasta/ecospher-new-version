// Anonymous mode (Settings): when on, anything you release carries no
// signal name — reactions, replies, and any public handle read this.

import { readPref } from '../hooks/useEcoPrefs'

export function anonymousMode(): boolean {
  return readPref('anonymous', true)
}

/** The handle attached to anything you release publicly. */
export function publicHandle(): string {
  if (anonymousMode()) return 'anonymous'
  try {
    return window.localStorage.getItem('signalIdentity') || 'anonymous'
  } catch {
    return 'anonymous'
  }
}
