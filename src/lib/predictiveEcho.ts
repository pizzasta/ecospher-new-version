// Predictive Echo: a tiny client-side Markov chain trained on the ghost
// archive, used to ghost-complete whatever the user is typing. No network,
// no AI service — just the network finishing your thought from its memory.

import { GHOST_ARCHIVE } from './ghostArchive'

const SENTENCE_END = /[.!?]$/

type Chain = Map<string, string[]>

let chain: Chain | null = null

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean)
}

function buildChain(): Chain {
  const next: Chain = new Map()
  for (const ghost of GHOST_ARCHIVE) {
    const words = tokenize(ghost.content)
    for (let i = 0; i < words.length - 1; i += 1) {
      const list = next.get(words[i])
      if (list) list.push(words[i + 1])
      else next.set(words[i], [words[i + 1]])
    }
  }
  return next
}

function getChain(): Chain {
  if (!chain) chain = buildChain()
  return chain
}

/**
 * Returns a plausible completion for the partial text (the suffix only,
 * starting with a space), or null when there's nothing to echo.
 */
export function predictText(partial: string, maxWords = 7): string | null {
  const words = tokenize(partial)
  if (words.length === 0) return null

  const markov = getChain()
  let current = words[words.length - 1]
  if (!markov.has(current)) return null

  const out: string[] = []
  for (let i = 0; i < maxWords; i += 1) {
    const options = markov.get(current)
    if (!options || options.length === 0) break
    const pick = options[Math.floor(Math.random() * options.length)]
    out.push(pick)
    if (SENTENCE_END.test(pick)) break
    current = pick
  }

  if (out.length === 0) return null
  return ` ${out.join(' ')}`
}
