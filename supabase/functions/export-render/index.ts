// Export rendering — server-side 1080x1920 story card as SVG (fast, zero
// native deps; clients rasterize or share directly).
// POST { handle, caption, duration, typeLabel, seed } → image/svg+xml
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { serve(h: (r: Request) => Promise<Response> | Response): void }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let body: { handle?: string; caption?: string; duration?: string; typeLabel?: string; seed?: number } = {}
  try { body = await req.json() } catch { return new Response('invalid body', { status: 400 }) }
  const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c))
  const handle = esc((body.handle ?? 'anonymous').slice(0, 40))
  const caption = esc((body.caption ?? 'a voice from the band.').slice(0, 120))
  const duration = esc((body.duration ?? '0:30').slice(0, 12))
  const typeLabel = esc((body.typeLabel ?? 'signal').slice(0, 30))
  const seed = Math.abs(Math.floor(body.seed ?? 42)) || 42

  const bars = Array.from({ length: 48 }, (_, i) => {
    const h = 30 + ((seed * (i + 3) * 131) % 220)
    const x = 120 + i * 18
    return `<rect x="${x}" y="${1000 - h / 2}" width="9" height="${h}" rx="4" fill="url(#wave)" opacity="${0.55 + ((i * 17) % 40) / 100}"/>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a18"/><stop offset="1" stop-color="#02030c"/></linearGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00d4ff"/><stop offset="1" stop-color="#ff2d78"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#21123a"/><stop offset="1" stop-color="#02030c" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/><rect width="1080" height="1920" fill="url(#glow)"/>
  <text x="540" y="380" text-anchor="middle" font-family="monospace" font-size="34" letter-spacing="14" fill="#ff7aa8">ECOSPHERE</text>
  <text x="540" y="560" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="58" fill="#f0f4ff">${handle}</text>
  <text x="540" y="640" text-anchor="middle" font-family="monospace" font-size="30" letter-spacing="6" fill="#9ae8ff">${typeLabel} · ${duration}</text>
  ${bars}
  <text x="540" y="1280" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="40" fill="#cdd6f0">“${caption}”</text>
  <text x="540" y="1720" text-anchor="middle" font-family="monospace" font-size="26" letter-spacing="8" fill="#5d6a8a">the band keeps what people replay</text>
</svg>`
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } })
})
