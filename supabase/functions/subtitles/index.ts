// Auto subtitle generation — turns a transcript into timed display cues
// sized for drifting subtitles (max ~38 chars, natural breath breaks).
// True speech-to-text needs an STT provider; plug one in where marked
// and this function keeps the same contract.
// POST { text, durationMs } → { cues: [{start, end, text}] }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { serve(h: (r: Request) => Promise<Response> | Response): void }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let body: { text?: string; durationMs?: number } = {}
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  // ── STT plug point: if body.path is given and an STT provider is wired,
  //    transcribe here and use that text instead ─────────────────────────
  const text = String(body.text ?? '').slice(0, 2000).trim()
  const durationMs = Math.min(10 * 60 * 1000, Math.max(800, Math.floor(body.durationMs ?? 8000)))
  if (!text) return json({ error: 'text required (or wire an STT provider)' }, 400)

  // split on breath points, keep lines short enough to drift
  const pieces = text
    .split(/(?<=[.!?…])\s+|\s+—\s+/)
    .flatMap(part => chunk(part, 38))
    .filter(Boolean)
  const weights = pieces.map(p => Math.max(4, p.length))
  const total = weights.reduce((a, b) => a + b, 0)
  let cursor = 0
  const cues = pieces.map((line, i) => {
    const span = Math.round((weights[i] / total) * durationMs)
    const cue = { start: cursor, end: Math.min(durationMs, cursor + span), text: line }
    cursor += span
    return cue
  })
  return json({ cues })
})

function chunk(s: string, max: number): string[] {
  const words = s.split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w }
    else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
