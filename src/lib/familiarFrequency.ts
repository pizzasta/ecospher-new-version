// Familiar Frequency — the system that notices recurring strangers before you do.
//
// When the same anonymous handle keeps appearing in your field, it earns a
// "familiar" status. Not a follow. Not a friend. Just quiet recognition:
// the ecosystem noticed you've crossed paths more than once.
//
// Everything lives in localStorage so it works offline and never requires
// a login. Data is deliberately minimal — we only track what's needed
// to create the feeling, not to profile anyone.

export type FamiliarStage =
  | 'drifting'      // appeared 2x, barely a pattern
    | 'crossing'      // 3-4x, definitely recurring
      | 'known'         // 5-7x, unmistakable presence
        | 'deep'          // 8+, this person exists in your field

        export interface FamiliarSignal {
          handle: string
            crossings: number         // how many times paths have crossed
              stage: FamiliarStage
                lastCrossedAt: number     // timestamp
                  firstCrossedAt: number
                    moods: string[]           // mood trail of their signals you've encountered
                      lastContent: string       // fragment of their last signal (max 80 chars)
                        signalIds: string[]       // last 10 signal IDs seen from them
                          quietSince?: number       // if they've gone silent, when
                          }

                          const STORE_KEY = 'ecosphere:familiarFrequencies'
                          const MAX_FAMILIARS = 12   // cap — a field, not a roster

                          function loadAll(): FamiliarSignal[] {
                            try {
                                return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '[]') as FamiliarSignal[]
                                  } catch {
                                      return []
                                        }
                                        }

                                        function saveAll(signals: FamiliarSignal[]): void {
                                          try {
                                              window.localStorage.setItem(STORE_KEY, JSON.stringify(signals.slice(0, MAX_FAMILIARS)))
                                                } catch { /* storage full — session only */ }
                                                }

                                                function stageFor(crossings: number): FamiliarStage {
                                                  if (crossings >= 8) return 'deep'
                                                    if (crossings >= 5) return 'known'
                                                      if (crossings >= 3) return 'crossing'
                                                        return 'drifting'
                                                        }

                                                        // ─── write ────────────────────────────────────────────────────────────────────

                                                        /**
                                                         * Record a signal crossing. Call this whenever a signal from a given handle
                                                          * appears in the user's feed and they've scrolled past or interacted with it.
                                                           * Anonymous handles are welcome — that's the point.
                                                            */
                                                            export function recordCrossing(
                                                              handle: string,
                                                                signalId: string,
                                                                  mood: string,
                                                                    contentFragment: string,
                                                                    ): void {
                                                                      if (!handle || handle === 'you') return  // never track self

                                                                        const all = loadAll()
                                                                          const existing = all.find(f => f.handle === handle)
                                                                            const now = Date.now()
                                                                              const fragment = contentFragment.slice(0, 80)

                                                                                if (existing) {
                                                                                    existing.crossings += 1
                                                                                        existing.stage = stageFor(existing.crossings)
                                                                                            existing.lastCrossedAt = now
                                                                                                existing.lastContent = fragment
                                                                                                    existing.moods = [...new Set([mood, ...existing.moods])].slice(0, 5)
                                                                                                        existing.signalIds = [signalId, ...existing.signalIds].slice(0, 10)
                                                                                                            existing.quietSince = undefined  // they're back
                                                                                                                saveAll(all)
                                                                                                                  } else {
                                                                                                                      // only start tracking at 2nd crossing — first encounter is just encounter
                                                                                                                          const newcomer: FamiliarSignal = {
                                                                                                                                handle,
                                                                                                                                      crossings: 1,
                                                                                                                                            stage: 'drifting',
                                                                                                                                                  lastCrossedAt: now,
                                                                                                                                                        firstCrossedAt: now,
                                                                                                                                                              moods: [mood],
                                                                                                                                                                    lastContent: fragment,
                                                                                                                                                                          signalIds: [signalId],
                                                                                                                                                                              }
                                                                                                                                                                                  saveAll([newcomer, ...all])
                                                                                                                                                                                    }
                                                                                                                                                                                    }
                                                                                                                                                                                    
                                                                                                                                                                                    /**
                                                                                                                                                                                     * Mark a handle as quiet — they haven't appeared in N days.
                                                                                                                                                                                      * Call when the feed loads and a previously-familiar handle is absent.
                                                                                                                                                                                       */
                                                                                                                                                                                       export function markQuiet(handle: string): void {
                                                                                                                                                                                         const all = loadAll()
                                                                                                                                                                                           const f = all.find(f => f.handle === handle)
                                                                                                                                                                                             if (f && !f.quietSince) {
                                                                                                                                                                                                 f.quietSince = Date.now()
                                                                                                                                                                                                     saveAll(all)
                                                                                                                                                                                                       }
                                                                                                                                                                                                       }
                                                                                                                                                                                                       
                                                                                                                                                                                                       // ─── read ─────────────────────────────────────────────────────────────────────
                                                                                                                                                                                                       
                                                                                                                                                                                                       /** Familiars worth surfacing — 'crossing' or deeper, most recent first. */
                                                                                                                                                                                                       export function getFamiliars(): FamiliarSignal[] {
                                                                                                                                                                                                         return loadAll()
                                                                                                                                                                                                             .filter(f => f.crossings >= 3)
                                                                                                                                                                                                                 .sort((a, b) => b.lastCrossedAt - a.lastCrossedAt)
                                                                                                                                                                                                                 }
                                                                                                                                                                                                                 
                                                                                                                                                                                                                 /** The single most present familiar in the field right now. */
                                                                                                                                                                                                                 export function getPrimaryFamiliar(): FamiliarSignal | null {
                                                                                                                                                                                                                   const all = getFamiliars()
                                                                                                                                                                                                                     if (all.length === 0) return null
                                                                                                                                                                                                                       // weight: crossings + recency bonus
                                                                                                                                                                                                                         const now = Date.now()
                                                                                                                                                                                                                           const scored = all.map(f => ({
                                                                                                                                                                                                                               f,
                                                                                                                                                                                                                                   score: f.crossings * 10 + (now - f.lastCrossedAt < 3600000 ? 20 : 0),
                                                                                                                                                                                                                                     }))
                                                                                                                                                                                                                                       scored.sort((a, b) => b.score - a.score)
                                                                                                                                                                                                                                         return scored[0].f
                                                                                                                                                                                                                                         }
                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                         /** Ambient copy shown for each stage — short, grounded, never dramatic. */
                                                                                                                                                                                                                                         export function stageLabel(stage: FamiliarStage): string {
                                                                                                                                                                                                                                           switch (stage) {
                                                                                                                                                                                                                                               case 'drifting':  return 'drifted past before'
                                                                                                                                                                                                                                                   case 'crossing':  return 'keeps appearing in your field'
                                                                                                                                                                                                                                                       case 'known':     return 'a recurring presence'
                                                                                                                                                                                                                                                           case 'deep':      return 'always somewhere nearby'
                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                             
                                                                                                                                                                                                                                                             /**
                                                                                                                                                                                                                                                              * One-line human reason why this person feels familiar.
                                                                                                                                                                                                                                                               * Deterministic per handle so it's stable across renders.
                                                                                                                                                                                                                                                                */
                                                                                                                                                                                                                                                                export function familiarReason(f: FamiliarSignal): string {
                                                                                                                                                                                                                                                                  const days = Math.floor((Date.now() - f.firstCrossedAt) / 86400000)
                                                                                                                                                                                                                                                                    const daysLabel = days === 0 ? 'tonight' : days === 1 ? 'yesterday' : `${days} days ago`
                                                                                                                                                                                                                                                                      const moodStr = f.moods[0] ?? 'nocturne'
                                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                        const options = [
                                                                                                                                                                                                                                                                            `first crossed ${daysLabel} · ${f.crossings} times since`,
                                                                                                                                                                                                                                                                                `${f.crossings} crossings — always in ${moodStr} spaces`,
                                                                                                                                                                                                                                                                                    `keeps showing up when you do`,
                                                                                                                                                                                                                                                                                        `you've been in the same frequency ${f.crossings} times`,
                                                                                                                                                                                                                                                                                            `drifted through ${f.crossings} of your sessions`,
                                                                                                                                                                                                                                                                                              ]
                                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                                let h = 0
                                                                                                                                                                                                                                                                                                  for (let i = 0; i < f.handle.length; i++) h = (h * 31 + f.handle.charCodeAt(i)) & 0xfffff
                                                                                                                                                                                                                                                                                                    return options[h % options.length]
                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                                                                    /**
                                                                                                                                                                                                                                                                                                     * Whether a familiar has gone quiet (absent > 2 days after being active).
                                                                                                                                                                                                                                                                                                      */
                                                                                                                                                                                                                                                                                                      export function isQuiet(f: FamiliarSignal): boolean {
                                                                                                                                                                                                                                                                                                        if (!f.quietSince) return false
                                                                                                                                                                                                                                                                                                          return Date.now() - f.quietSince > 2 * 86400000
                                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                                                                                          /** Clear all familiar data — used in privacy/reset flows. */
                                                                                                                                                                                                                                                                                                          export function clearFamiliars(): void {
                                                                                                                                                                                                                                                                                                            try { window.localStorage.removeItem(STORE_KEY) } catch { /* ok */ }
                                                                                                                                                                                                                                                                                                            }
