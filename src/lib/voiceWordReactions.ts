// Voice → words. Voice reactions are the truest response on Ecosphere, but a
// wall of play buttons hides what people actually said. This distills the
// spoken text of every voice reaction on a signal into the words people used
// most — surfaced as tappable word-reactions. The crowd's response, in their
// own words, ranked by how many said it.
//
// Pure and deterministic: same captions in, same ranking out. Feeds off
// whatever transcripts exist (live-recognized on record, or the seeded
// captions) and degrades to empty when there's nothing to read.

// function words + reaction filler that shouldn't count as "what was said"
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'as', 'is', 'it', 'its', 'it’s', 'this', 'that', 'these', 'those',
  'i', 'im', 'i’m', 'you', 'your', 'we', 'they', 'he', 'she', 'me', 'my', 'mine',
  'was', 'were', 'be', 'been', 'am', 'are', 'do', 'does', 'did', 'have', 'has', 'had',
  'not', 'no', 'yes', 'ok', 'okay', 'just', 'like', 'really', 'very', 'too', 'also',
  'then', 'than', 'there', 'here', 'when', 'where', 'why', 'how', 'what', 'who',
  'up', 'out', 'down', 'off', 'over', 'about', 'into', 'from', 'again', 'still',
  'uh', 'um', 'oh', 'ah', 'hmm', 'yeah', 'nah', 'wait', 'because', 'cause',
])

export interface WordReaction { word: string; count: number }

/** Strip stage directions in (parentheses) — "(laughing)", "(static)" — and
 *  reduce a caption to lowercase spoken tokens. */
function tokens(caption: string): string[] {
  return caption
    .replace(/\([^)]*\)/g, ' ')          // drop parenthetical stage directions
    .toLowerCase()
    .replace(/[^a-z’' ]+/g, ' ')     // keep letters + apostrophes
    .split(/\s+/)
    .map(w => w.replace(/^'+|'+$/g, ''))  // trim stray quotes
    .filter(w => w.length >= 2 && !STOPWORDS.has(w))
}

/**
 * The words people said most across a set of voice-reaction captions, ranked
 * by frequency (ties broken alphabetically for stability). Empty when nothing
 * intelligible was said.
 */
export function mostSaidWords(captions: Array<string | null | undefined>, limit = 5): WordReaction[] {
  const counts = new Map<string, number>()
  for (const caption of captions) {
    if (!caption) continue
    // a word counts once per reaction, not once per repetition within it
    const seen = new Set(tokens(caption))
    for (const w of seen) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : 1))
    .slice(0, limit)
}

/** Worth surfacing when the crowd has said at least two distinct things, or
 *  any one word landed with two or more people behind it. Below that there's
 *  no "what people are saying" — just a stray murmur. */
export function hasConsensus(words: WordReaction[]): boolean {
  return words.length >= 2 || (words.length > 0 && words[0].count >= 2)
}
