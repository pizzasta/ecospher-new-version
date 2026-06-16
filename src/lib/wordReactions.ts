// Auto word-reactions: short, tappable responses that change with what a
// signal actually says. Keyword hits come first (most specific), then the
// signal's mood fills the rest. Deterministic — stable across renders.

const MOOD_REACTIONS: Record<string, string[]> = {
  nocturne: ['still up too', 'i feel this', 'stay'],
  bloom: ['this is nice', 'needed this', 'soft'],
  drift: ['drifting too', 'same', 'where to'],
  static: ['i hear it', 'tune in', 'noise feels right'],
  lost: ['felt that', "i'm here", 'come back'],
}

const KEYWORD_REACTIONS: Array<{ test: RegExp; reactions: string[] }> = [
  { test: /\b(miss|missing|gone|left|lost|ex|alone|empty|goodbye)\b/i, reactions: ['felt that', "i'm here", 'same'] },
  { test: /\b(lol|lmao|haha|funny|joke|ridiculous|unhinged|chaos)\b/i, reactions: ['not me too', 'lmao', 'unwell'] },
  { test: /\b(love|crush|him|her|them|heart|texting|date)\b/i, reactions: ['oh no', 'go for it', 'text them'] },
  { test: /\b(tired|exhausted|sleep|insomnia|3am|2am|awake|wired)\b/i, reactions: ['same hours', 'rest soon', 'me too'] },
  { test: /\b(scared|afraid|anxious|panic|worry|nervous|dread)\b/i, reactions: ["you're safe", 'breathe', "i'm here"] },
  { test: /\b(rain|window|sky|stars|moon|drive|highway|ocean)\b/i, reactions: ['cinematic', 'i see it', 'take me there'] },
  { test: /\b(work|job|boss|shift|burnt|burned out|deadline)\b/i, reactions: ['clock out', 'ugh same', 'rest'] },
  { test: /\b(thank|grateful|better|healing|proud|win|made it)\b/i, reactions: ['proud of you', 'love this', 'keep going'] },
]

/** 3–4 short reactions, keyword hits first then mood. Always non-empty. */
export function wordReactionsFor(content: string, mood: string): string[] {
  const found: string[] = []
  for (const k of KEYWORD_REACTIONS) {
    if (k.test.test(content)) found.push(...k.reactions)
  }
  const base = MOOD_REACTIONS[mood] ?? MOOD_REACTIONS.drift
  return Array.from(new Set([...found, ...base])).slice(0, 4)
}
