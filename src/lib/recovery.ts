// Shared crash / stale-build recovery. Used by the Settings "force latest
// version" button and the SignalErrorBoundary escape hatch so a stuck client
// can always get back to a clean state instead of looping on a broken reload.

/** Drop the service worker + Cache Storage (stale-build recovery). Best effort. */
export async function clearStaleBuild(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch { /* best effort — caller reloads regardless */ }
}

/** Full reset for an unrecoverable render crash: clears the service worker,
 *  caches, localStorage and the audio IndexedDB, then hard-reloads into a clean
 *  app. Destructive — only offered as the stubborn-case escape hatch. */
export async function recoverFromCrash(): Promise<void> {
  await clearStaleBuild()
  try { window.localStorage.clear() } catch { /* storage unavailable */ }
  try { indexedDB.deleteDatabase('ecosphere-audio') } catch { /* unavailable */ }
  window.location.reload()
}
