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

/** Full reset for an unrecoverable render crash: clears localStorage and the
 *  audio IndexedDB (the data that can poison a render), best-effort drops the
 *  service worker + caches, then hard-reloads into a clean app. Destructive —
 *  only offered as the stubborn-case escape hatch.
 *
 *  Order matters: we clear the poisoning *data* first and synchronously, because
 *  a hung service-worker unregister must never block the reload (that bug made
 *  the recovery button appear dead). The SW/cache clear is raced against a short
 *  timeout so the reload always happens. */
export async function recoverFromCrash(): Promise<void> {
  try { window.localStorage.clear() } catch { /* storage unavailable */ }
  try { indexedDB.deleteDatabase('ecosphere-audio') } catch { /* unavailable */ }
  // best effort — never let a stuck service worker block the reload
  try {
    await Promise.race([
      clearStaleBuild(),
      new Promise<void>((resolve) => { window.setTimeout(resolve, 1500) }),
    ])
  } catch { /* reload regardless */ }
  window.location.reload()
}
