import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { playChainBlend, stopChainPlayback } from '../lib/sampleAudio'
import type { SampleKind, ChainLayerSource } from '../lib/sampleAudio'
import { listLocalRecordings } from '../lib/localAudioStore'
import { renderStoryImage, downloadBlob, exportFilename } from '../lib/storyExport'
import AudioRecorder from './AudioRecorder'
import { useEcoPref } from '../hooks/useEcoPrefs'
import { sendLive } from '../lib/liveBus'
import type { LiveEvent } from '../lib/liveBus'
import '../chains.css'

// ═══════════════════════════════════════════════════════════════
// SIGNAL CHAINS — strangers building one sound together.
// The choir around you is simulated locally (like every ambient
// presence in the app); your own layers are real recordings that
// blend into the playback. The mess is the point.
// ═══════════════════════════════════════════════════════════════

type ChainState = 'forming' | 'growing louder' | 'harmonizing' | 'unstable' | 'replay storm' | 'almost legendary' | 'archived'

interface SimLayer {
  id: string
  label: string
  kind: SampleKind
  seed: number
}

interface Chain {
  id: string
  starter: string
  type: string
  state: ChainState
  contributors: number
  closesAt: number
  layers: SimLayer[]
}

interface MyLayer {
  id: string
  chainId: string
  durationMs: number
  recordedAt: number
}

const CHAIN_TYPES = [
  'insomnia chain', 'breakup chain', 'driving at night', 'songs we never sent',
  'unfinished confessions', 'quiet room harmonies', 'background comfort chain',
  'anonymous choir', 'soft voice pileups',
]

const CHAIN_STARTERS = [
  'someone hummed four notes and stopped',
  'a whisper: "okay so honestly—"',
  'two seconds of rain, then a breath',
  'somebody singing the wrong lyrics on purpose',
  'a sentence that ends in "anyway"',
  'one held note, slightly flat, perfect',
  'a confession that starts mid-thought',
  '"goodnight" said like a question',
  'someone tapping a rhythm on a steering wheel',
  'half a chorus nobody can place',
  'a laugh that decides to become a melody',
  'breathing, in time with nothing',
]

const LAYER_LABELS: Array<{ label: string; kind: SampleKind }> = [
  { label: 'a harmony two notes under', kind: 'tone' },
  { label: 'someone breathing in time', kind: 'whisper' },
  { label: 'a whisper agreeing', kind: 'whisper' },
  { label: 'an adlib from far away', kind: 'voice' },
  { label: 'room tone from an open window', kind: 'static' },
  { label: 'a voice crack, kept on purpose', kind: 'voice' },
  { label: 'the same line, but softer', kind: 'voice' },
  { label: 'humming that joins late', kind: 'tone' },
  { label: 'a held note that almost lands', kind: 'tone' },
  { label: 'someone saying "keep going"', kind: 'whisper' },
]

const CHAIN_STATES: ChainState[] = ['forming', 'growing louder', 'harmonizing', 'unstable', 'replay storm', 'almost legendary']

const ENERGY_LINES = [
  '14 people listening quietly',
  '3 layering vocals right now',
  'replay storm forming two chains down',
  'everyone is replaying the ending',
  'emotional spike detected',
  'someone harmonized unexpectedly',
  'a chain went unstable a minute ago',
  '6 strangers breathing on the same beat',
]

const REACTIONS = [
  'keep this layer', 'louder', 'needed this', 'leave it raw',
  "don't cut this", 'stayed for this part', 'the whisper worked', 'the silence after mattered',
]

const DISCOVERY_FILTERS: Array<{ id: string; label: string; test: (c: Chain) => boolean }> = [
  { id: 'all', label: 'every chain', test: () => true },
  { id: 'fast', label: 'growing fast', test: c => c.state === 'growing louder' || c.contributors >= 14 },
  { id: 'unstable', label: 'unstable', test: c => c.state === 'unstable' || c.state === 'replay storm' },
  { id: 'voices', label: 'needs voices', test: c => c.contributors < 8 && c.state !== 'archived' },
  { id: 'legendary', label: 'almost legendary', test: c => c.state === 'almost legendary' },
]

function dayIndex(): number {
  return Math.floor(Date.now() / 86400000)
}

// six chains a day, each sealing on its own 4-hour clock
function buildChains(now: number): Chain[] {
  const day = dayIndex()
  return Array.from({ length: 6 }, (_, i) => {
    const seed = day * 31 + i * 17
    const closesAt = (Math.floor(now / 14400000) + 1) * 14400000 + i * 1320000
    const contributors = 3 + ((seed * 7) % 15)
    const layerCount = Math.min(6, 2 + (seed % 5))
    return {
      id: `chain-${day}-${i}`,
      starter: CHAIN_STARTERS[(seed * 3) % CHAIN_STARTERS.length],
      type: CHAIN_TYPES[(seed * 5) % CHAIN_TYPES.length],
      state: CHAIN_STATES[(seed * 11) % CHAIN_STATES.length],
      contributors,
      closesAt,
      layers: Array.from({ length: layerCount }, (_, n) => {
        const pick = LAYER_LABELS[(seed * (n + 2) + n * 13) % LAYER_LABELS.length]
        return { id: `${day}-${i}-${n}`, label: pick.label, kind: pick.kind, seed: seed * 101 + n * 37 }
      }),
    }
  })
}

function timeLeft(closesAt: number, now: number): string {
  const ms = Math.max(0, closesAt - now)
  if (ms === 0) return 'sealed'
  const h = Math.floor(ms / 3600000)
  const m = Math.ceil((ms % 3600000) / 60000)
  return h > 0 ? `seals in ${h}h ${m}m` : `seals in ${m}m`
}

export default function SignalChainsScreen() {
  const [now, setNow] = useState(() => Date.now())
  const [chains, setChains] = useState<Chain[]>(() => buildChains(Date.now()))
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [energyIdx, setEnergyIdx] = useState(0)
  const [pops, setPops] = useState<Array<{ id: number; text: string; left: number }>>([])
  const popIdRef = useRef(0)
  const lurker = useEcoPref('lurker', false)

  // your real layers, stored on-device
  const [myLayers, setMyLayers] = useState<MyLayer[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('ecosphere:chainLayers') ?? '[]') } catch { return [] }
  })
  const [myBlobs, setMyBlobs] = useState<Record<string, Blob>>({})
  useEffect(() => {
    void listLocalRecordings().then(recordings => {
      const map: Record<string, Blob> = {}
      for (const layer of myLayers) {
        const rec = recordings.find(r => r.id === layer.id)
        if (rec) map[layer.id] = rec.blob
      }
      setMyBlobs(map)
    })
  }, [myLayers])

  const saveMyLayer = (layer: MyLayer) => {
    const next = [...myLayers, layer]
    setMyLayers(next)
    try { window.localStorage.setItem('ecosphere:chainLayers', JSON.stringify(next)) } catch { /* session only */ }
  }

  // chain reactions: emotional tallies per chain, on-device
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>(() => {
    try { return JSON.parse(window.localStorage.getItem('ecosphere:chainReactions') ?? '{}') } catch { return {} }
  })

  const say = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote(null), 4500)
  }

  // the ecosystem breathes: clock ticks, contributors drift, states mutate
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    const drift = window.setInterval(() => {
      setChains(prev => prev.map(c => {
        if (now >= c.closesAt) return { ...c, state: 'archived' }
        const bump = Math.random() < 0.4 ? 1 : 0
        const mutate = Math.random() < 0.18
        return {
          ...c,
          contributors: Math.min(20, c.contributors + bump),
          state: mutate ? CHAIN_STATES[Math.floor(Math.random() * CHAIN_STATES.length)] : c.state,
        }
      }))
    }, 12000)
    const energy = window.setInterval(() => setEnergyIdx(n => n + 1), 9000)
    return () => { window.clearInterval(tick); window.clearInterval(drift); window.clearInterval(energy) }
  }, [now])

  useEffect(() => () => stopChainPlayback(), [])

  // real carriers joining chains, live — soft bump, no feed
  useEffect(() => {
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveEvent>).detail
      if (detail?.type !== 'chain_layer' || !detail.id) return
      setChains(prev => prev.map(c => (c.id === detail.id && c.state !== 'archived'
        ? { ...c, contributors: Math.min(20, c.contributors + 1) }
        : c)))
      say('a stranger just layered into a chain — live')
    }
    window.addEventListener('ecosphere:live', onLive)
    return () => window.removeEventListener('ecosphere:live', onLive)
     
  }, [])

  const listenToChain = async (chain: Chain) => {
    if (playingId === chain.id) {
      stopChainPlayback()
      setPlayingId(null)
      return
    }
    const mine = myLayers.filter(l => l.chainId === chain.id && myBlobs[l.id])
    const sources: ChainLayerSource[] = [
      ...chain.layers.map((layer, i) => ({
        kind: layer.kind,
        seed: layer.seed,
        durationMs: 4200 + (layer.seed % 2600),
        volume: 0.1 + ((layer.seed % 4) * 0.035),
        delayMs: i * (420 + (layer.seed % 600)),
      })),
      ...mine.map((l, i) => ({ blob: myBlobs[l.id], volume: 0.42, delayMs: 300 + i * 500 })),
    ]
    setPlayingId(chain.id)
    const ok = await playChainBlend(sources)
    if (!ok) {
      say("the chain couldn't reach your speakers — tap anywhere first, then try again")
      setPlayingId(null)
      return
    }
    window.setTimeout(() => setPlayingId(current => (current === chain.id ? null : current)), 9500)
  }

  const react = (chain: Chain, reaction: string) => {
    const next = {
      ...reactions,
      [chain.id]: { ...(reactions[chain.id] ?? {}), [reaction]: ((reactions[chain.id] ?? {})[reaction] ?? 0) + 1 },
    }
    setReactions(next)
    sendLive({ type: 'reaction', id: chain.id })
    try { window.localStorage.setItem('ecosphere:chainReactions', JSON.stringify(next)) } catch { /* session only */ }
    const id = ++popIdRef.current
    setPops(prev => [...prev.slice(-7), { id, text: reaction, left: 14 + Math.random() * 70 }])
    window.setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 2400)
  }

  const exportChain = (chain: Chain) => {
    void renderStoryImage({
      handle: chain.type,
      caption: `${chain.starter} — ${chain.contributors} strangers piled on.`,
      duration: `${chain.contributors}/20 voices`,
      typeLabel: 'signal chain',
      waveformSeed: chain.id.length * 211 + chain.contributors * 7,
    }).then(blob => {
      if (blob) {
        downloadBlob(blob, exportFilename(chain.type, 'image'))
        say('chain exported — let it drift beyond the band')
      }
    })
  }

  const visible = chains.filter(c => (DISCOVERY_FILTERS.find(f => f.id === filter) ?? DISCOVERY_FILTERS[0]).test(c))

  return (
    <div className="screen chains-screen">
      {/* ambient: dust + drifting fragments */}
      <div className="chains-atmo" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 89 + 5) % 100}%`, animationDuration: `${12 + (i % 5) * 4}s`, animationDelay: `${-(i * 2.3)}s` }} />
        ))}
      </div>

      <div className="screen-header">
        <div className="screen-kicker">SIGNAL CHAINS</div>
        <h2 className="screen-title">Chains</h2>
        <p className="screen-sub">
          strangers building one sound together. somebody starts with ten seconds; nineteen more can pile on before it seals. nothing gets cleaned up — the mess is the point.
        </p>
      </div>

      <div className="chains-energy" role="status">
        <i aria-hidden="true" />
        {ENERGY_LINES[energyIdx % ENERGY_LINES.length]}
      </div>

      <nav className="chains-filters" aria-label="Discover chains">
        {DISCOVERY_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`chains-filter${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <div className="chains-list">
        {visible.length === 0 && <p className="chains-empty">nothing on this band right now. chains re-form every few hours.</p>}
        {visible.map((chain, idx) => {
          const open = openId === chain.id
          const sealed = now >= chain.closesAt || chain.state === 'archived'
          const mine = myLayers.filter(l => l.chainId === chain.id)
          const joined = mine.length > 0
          const orbCount = Math.min(10, chain.contributors)
          const chainReactions = reactions[chain.id] ?? {}
          return (
            <article
              key={chain.id}
              className={`chain-card chain-card--${chain.state.replace(/\s/g, '-')}${open ? ' open' : ''}${playingId === chain.id ? ' playing' : ''}`}
              style={{ '--chain-idx': idx, '--chain-heat': (chain.contributors / 20).toFixed(2) } as CSSProperties}
            >
              {/* the organism */}
              <button type="button" className="chain-organism" onClick={() => setOpenId(open ? null : chain.id)} aria-label={open ? 'collapse chain' : 'open chain'}>
                <span className="chain-core" aria-hidden="true" />
                <span className="chain-ring chain-ring-a" aria-hidden="true" />
                <span className="chain-ring chain-ring-b" aria-hidden="true" />
                {Array.from({ length: orbCount }, (_, n) => (
                  <span
                    key={n}
                    className={`chain-orb chain-orb--${n % 3}`}
                    aria-hidden="true"
                    style={{
                      '--orb-radius': `${26 + (n % 4) * 9}px`,
                      '--orb-dur': `${9 + (n % 5) * 4}s`,
                      '--orb-delay': `${-(n * 2.7)}s`,
                    } as CSSProperties}
                  />
                ))}
              </button>

              <div className="chain-body">
                <div className="chain-head">
                  <span className={`chain-state chain-state--${chain.state.replace(/\s/g, '-')}`}>{chain.state}</span>
                  <span className="chain-clock">{sealed ? 'sealed · every crack kept' : timeLeft(chain.closesAt, now)}</span>
                </div>
                <h3 className="chain-title">{chain.starter}</h3>
                <div className="chain-meta">
                  <em>{chain.type}</em>
                  <span>{chain.contributors}/20 voices{joined ? ' · yours is in there' : ''}</span>
                </div>

                <div className="chain-actions">
                  <button type="button" className="chain-btn chain-btn--listen" onClick={() => { void listenToChain(chain) }}>
                    {playingId === chain.id ? '◼ let it settle' : '▶ hear the chain'}
                  </button>
                  {!sealed && (
                    lurker ? (
                      <span className="chain-lurking">◌ just listening tonight</span>
                    ) : (
                      <button type="button" className="chain-btn chain-btn--join" disabled={chain.contributors >= 20} onClick={() => setJoiningId(joiningId === chain.id ? null : chain.id)}>
                        {chain.contributors >= 20 ? 'chain is full' : joiningId === chain.id ? 'not tonight' : '● join the chain'}
                      </button>
                    )
                  )}
                  <button type="button" className="chain-btn" onClick={() => exportChain(chain)}>⬡ export</button>
                </div>

                {joiningId === chain.id && !sealed && (
                  <div className="chain-recorder">
                    <AudioRecorder
                      kind="signal"
                      context="chain layer"
                      prompt="up to ten seconds. harmonize, whisper, breathe, miss the note — it all stays."
                      minSeconds={2}
                      maxSeconds={10}
                      onComplete={({ durationMs, uploadId }) => {
                        saveMyLayer({ id: uploadId, chainId: chain.id, durationMs, recordedAt: Date.now() })
                        setChains(prev => prev.map(c => (c.id === chain.id ? { ...c, contributors: Math.min(20, c.contributors + 1) } : c)))
                        setJoiningId(null)
                        sendLive({ type: 'chain_layer', id: chain.id })
                        say('blended in — rough edges kept, exactly as recorded')
                      }}
                    />
                  </div>
                )}

                {open && (
                  <div className="chain-layers">
                    <span className="chain-layers-label">inside this chain</span>
                    <ul>
                      {chain.layers.map(layer => (
                        <li key={layer.id}>
                          <span className="chain-layer-wave" aria-hidden="true">
                            {Array.from({ length: 7 }, (_, b) => (
                              <b key={b} style={{ height: `${22 + ((layer.seed * (b + 2)) % 64)}%` }} />
                            ))}
                          </span>
                          {layer.label}
                        </li>
                      ))}
                      {mine.map((layer, n) => (
                        <li key={layer.id} className="chain-layer-mine">
                          <span className="chain-layer-wave" aria-hidden="true">
                            {Array.from({ length: 7 }, (_, b) => (
                              <b key={b} style={{ height: `${24 + ((layer.recordedAt * (b + 2)) % 60)}%` }} />
                            ))}
                          </span>
                          your layer {n + 1} · {Math.max(1, Math.round(layer.durationMs / 1000))}s · kept raw
                        </li>
                      ))}
                    </ul>
                    <div className="chain-reactions">
                      {REACTIONS.slice(0, 6).map(reaction => (
                        <button key={reaction} type="button" className="chain-rx" onClick={() => react(chain, reaction)}>
                          {reaction}{chainReactions[reaction] ? ` · ${chainReactions[reaction]}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* floating emotional reactions */}
      <div className="chain-pops" aria-hidden="true">
        {pops.map(p => (
          <span key={p.id} style={{ left: `${p.left}%` }}>{p.text}</span>
        ))}
      </div>

      {note && <div className="chains-note" role="status">{note}</div>}

      <footer className="chains-foot">
        <p>chains seal on their own clocks. the choir around you is the band's pulse — your layers are real, recorded on this device, and blend into everything you hear.</p>
      </footer>
    </div>
  )
}
