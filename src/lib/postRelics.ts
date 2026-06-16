// Post → relic aging. A signal you release to the feed is public, and after a
// quiet delay it matures into a relic — the same object, just kept by the
// network long enough to count as one. The relic links back to the original
// post (same id), so the hub and the relics shelf show two views of one thing.

export const MY_POSTS_KEY = 'ecosphere:myFeedPosts'
export const RELIC_DELAY_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export type StoredPost = {
  id: string
  content: string
  mood: string
  postedAt: number
  anonymous?: boolean
  audioId?: string
  audioUrl?: string
  remote?: boolean
}

// reads whatever the feed persisted (full FeedSignal objects) but only needs
// these fields; tolerant of older entries that predate postedAt
export function loadStoredPosts(): StoredPost[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MY_POSTS_KEY) ?? '[]') as Array<Record<string, unknown>>
    return raw
      .filter(p => typeof p.id === 'string')
      .map(p => ({
        id: String(p.id),
        content: typeof p.content === 'string' ? p.content : '',
        mood: typeof p.mood === 'string' ? p.mood : 'drift',
        postedAt: typeof p.postedAt === 'number' ? p.postedAt : 0,
        anonymous: Boolean(p.anonymous),
        audioId: typeof p.audioId === 'string' ? p.audioId : undefined,
        audioUrl: typeof p.audioUrl === 'string' ? p.audioUrl : undefined,
        remote: Boolean(p.remote),
      }))
  } catch {
    return []
  }
}

export function relicReadyAt(post: Pick<StoredPost, 'postedAt'>): number {
  return post.postedAt + RELIC_DELAY_MS
}

export function isRelicReady(post: Pick<StoredPost, 'postedAt'>, now = Date.now()): boolean {
  return post.postedAt > 0 && now >= relicReadyAt(post)
}

/** Whole days left before a post matures (0 once it's ready). */
export function daysUntilRelic(post: Pick<StoredPost, 'postedAt'>, now = Date.now()): number {
  return Math.max(0, Math.ceil((relicReadyAt(post) - now) / 86400000))
}

/** Posts that have aged past the delay — now relics, newest first. */
export function agedPostRelics(now = Date.now()): StoredPost[] {
  return loadStoredPosts().filter(p => isRelicReady(p, now)).sort((a, b) => b.postedAt - a.postedAt)
}

/** Posts still maturing — show a countdown so the link is visible meanwhile. */
export function maturingPosts(now = Date.now()): StoredPost[] {
  return loadStoredPosts().filter(p => p.postedAt > 0 && !isRelicReady(p, now)).sort((a, b) => relicReadyAt(a) - relicReadyAt(b))
}
