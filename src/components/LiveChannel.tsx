import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { joinLiveChannel, createLiveIdentity, supabaseBus, localBus, LIVE_TURN_CAP_MS, LIVE_ROOM_LIMIT } from '../lib/liveChannel'
import type { LiveSession, LiveState, LivePeerMeta, LiveChannelInfo } from '../lib/liveChannel'
import { readAvatar, sigilGlyph } from '../lib/avatar'
import { mirrorActivity } from '../lib/backendBridge'
import './LiveChannel.css'

// A live voice channel: real people, real time, one voice holds the mic.
// Listen-only on arrival. Push-to-talk once you hold the mic. Nothing is
// recorded. The keeper (longest in the room) can cut the mic or remove
// someone; anyone can mute or report a voice for themselves.

const CONSENT_KEY = 'ecosphere:liveVoiceConsent:v2'
const COLORS = ['#9ae8ff', '#ff6fae', '#b78bff', '#7dffc4', '#ffd36f', '#ff9a6f']
const REACTIONS = ['∿', '◉', '✦', '↺']
const REPORT_REASONS = ['harassment', 'sexual content', 'child safety', 'hate', 'spam', 'other']

function hasConsented(): boolean {
  try { return window.localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false }
}

interface Floater { id: number; glyph: string; left: number }

export default function LiveChannel({ channel, mode, onLeave }: {
  channel: LiveChannelInfo
  mode: 'on' | 'local'
  onLeave: () => void
}) {
  const me = useMemo<LivePeerMeta>(() => ({
    key: `v_${Math.random().toString(36).slice(2, 10)}`,
    sigil: sigilGlyph(readAvatar()) || '◉',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    joinedAt: Date.now(),
  }), [])

  const [consented, setConsented] = useState(hasConsented)
  const [peers, setPeers] = useState<LivePeerMeta[]>([me])
  const [live, setLive] = useState<LiveState | null>(null)
  const [keeperKey, setKeeperKey] = useState<string | null>(me.key)
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [mutedForMe, setMutedForMe] = useState<string[]>([])
  const [talking, setTalking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [now, setNow] = useState(() => Date.now())
  const sessionRef = useRef<LiveSession | null>(null)
  // the parent may pass a new callback every render; don't rejoin because of it
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave

  const flash = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote(n => (n === text ? null : n)), 4200)
  }
  const float = (glyph: string) => {
    const f = { id: Date.now() + Math.random(), glyph, left: 20 + Math.random() * 60 }
    setFloaters(prev => [...prev, f])
    window.setTimeout(() => setFloaters(prev => prev.filter(x => x.id !== f.id)), 1800)
  }

  useEffect(() => {
    if (!consented) return undefined
    let cancelled = false
    let session: LiveSession | null = null
    const tick = window.setInterval(() => setNow(Date.now()), 500)
    // a fresh signing key per visit; its public half rides in presence
    void createLiveIdentity(me).then(identity => {
      if (cancelled) return
      const bus = mode === 'local' ? localBus(channel.id, identity.meta) : supabaseBus(channel.id, identity.meta)
      if (!bus) { flash('live voice needs the backend — not configured here'); return }
      session = joinLiveChannel(bus, identity, {
        onState: (s, k) => { setLive(s); setKeeperKey(k) },
        onPeers: list => setPeers(list),
        onAudio: (key, stream) => setStreams(prev => {
          const next = { ...prev }
          if (stream) next[key] = stream
          else delete next[key]
          return next
        }),
        onReaction: glyph => float(glyph),
        onRemoved: () => { flash('the keeper removed you from this channel'); window.setTimeout(() => onLeaveRef.current(), 1800) },
        onNotice: text => flash(text),
        onEnded: () => { window.setTimeout(() => onLeaveRef.current(), 2400) },
      })
      sessionRef.current = session
    }).catch(() => flash('this browser cannot start a secure live session'))
    return () => {
      cancelled = true
      window.clearInterval(tick)
      session?.leave()
      sessionRef.current = null
    }
  }, [consented, channel.id, me, mode])

  // release push-to-talk if the window loses focus mid-hold
  useEffect(() => {
    const stop = () => { setTalking(false); sessionRef.current?.setTalking(false) }
    window.addEventListener('blur', stop)
    return () => window.removeEventListener('blur', stop)
  }, [])

  const room = live?.room
  const carrier = room?.carrier ?? null
  const iAmCarrier = carrier === me.key
  const iAmKeeper = keeperKey === me.key
  const queuePos = room ? room.queue.indexOf(me.key) : -1
  const secondsLeft = live?.turnStartedAt ? Math.max(0, Math.ceil((LIVE_TURN_CAP_MS - (now - live.turnStartedAt)) / 1000)) : null
  const carrierPeer = peers.find(p => p.key === carrier)

  const hold = (on: boolean) => {
    if (!iAmCarrier && on) return
    setTalking(on)
    sessionRef.current?.setTalking(on)
  }

  const toggleMuteForMe = (key: string) => {
    setMutedForMe(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
    setSelected(null)
  }

  const report = (key: string, reason: string) => {
    mirrorActivity('signal_reported', `live voice report: ${reason}`, { channel: channel.id, reportedKey: key, reason, live: true })
    setMutedForMe(prev => (prev.includes(key) ? prev : [...prev, key]))
    setReporting(null)
    setSelected(null)
    flash('report logged · that voice is muted for you')
  }

  if (!consented) {
    return (
      <div className="lv lv--gate">
        <div className="lv-gate glass">
          <span className="lv-kicker">LIVE VOICE · BETA</span>
          <h2 className="lv-gate-title">before you go live</h2>
          <ul className="lv-rules">
            <li>these are <strong>real people, live</strong>. nothing here is pre-screened.</li>
            <li>you join <strong>listen-only</strong>. to talk, request the mic, then hold to talk.</li>
            <li><strong>nothing is recorded</strong>. voices go straight between devices — which means others in the channel can see your device's network (IP) address, and that can reveal your rough area. skip live voice if that matters to you.</li>
            <li>never share your name, location, socials or anything that identifies you.</li>
            <li>mute or report any voice in one tap. the keeper can cut the mic or remove someone.</li>
            <li>18+ only. not a crisis service — if you're in danger, call your local emergency number (U.S.: 988).</li>
          </ul>
          <div className="lv-gate-actions">
            <button type="button" className="lv-btn lv-btn--primary" onClick={() => {
              try { window.localStorage.setItem(CONSENT_KEY, 'yes') } catch { /* this session only */ }
              setConsented(true)
            }}>got it — enter listen-only</button>
            <button type="button" className="lv-btn" onClick={onLeave}>back</button>
          </div>
        </div>
      </div>
    )
  }

  const others = peers.filter(p => p.key !== me.key)

  return (
    <div className="lv" style={{ '--lv-color': carrierPeer?.color ?? '#9ae8ff' } as CSSProperties}>
      {Object.entries(streams).map(([key, stream]) => (
        <RemoteAudio key={key} stream={stream} muted={mutedForMe.includes(key)} />
      ))}

      <header className="lv-head">
        <div>
          <span className="lv-kicker">LIVE CHANNEL · {mode === 'local' ? 'LOCAL TEST' : 'BETA'}</span>
          <h2 className="lv-title">{channel.name} <span className="lv-hz">{channel.hz}</span></h2>
          <p className="lv-topic">{channel.topic}</p>
        </div>
        <button type="button" className="lv-btn lv-btn--ghost" onClick={onLeave}>leave</button>
      </header>

      <div className="lv-status" role="status" aria-live="polite">
        {carrier
          ? <>
              <span className="lv-live-dot" />
              {iAmCarrier ? 'you have the mic' : `${carrierPeer?.sigil ?? '◌'} has the mic`}
              {secondsLeft !== null && <span className="lv-timer"> · {secondsLeft}s</span>}
              {carrier && mutedForMe.includes(carrier) && <span className="lv-timer"> · muted for you</span>}
            </>
          : 'open mic · nobody is talking'}
        <span className="lv-count"> · {peers.length}/{LIVE_ROOM_LIMIT} in channel</span>
      </div>

      <div className="lv-ring">
        {[me, ...others].map(p => {
          const isCarrier = p.key === carrier
          const queued = room?.queue.indexOf(p.key) ?? -1
          return (
            <button
              type="button"
              key={p.key}
              className={`lv-peer${isCarrier ? ' lv-peer--carrier' : ''}${isCarrier && (iAmCarrier ? talking : Boolean(streams[p.key])) ? ' lv-peer--speaking' : ''}${mutedForMe.includes(p.key) ? ' lv-peer--muted' : ''}`}
              style={{ '--peer-color': p.color } as CSSProperties}
              onClick={() => setSelected(p.key === me.key ? null : (selected === p.key ? null : p.key))}
              aria-label={p.key === me.key ? 'you' : `voice ${p.sigil}`}
            >
              <span className="lv-sigil">{p.sigil}</span>
              <span className="lv-peer-label">
                {p.key === me.key ? 'you' : isCarrier ? 'live' : queued >= 0 ? `#${queued + 1} in line` : 'listening'}
                {p.key === keeperKey ? ' · keeper' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="lv-menu glass" role="group" aria-label="voice actions">
          <button type="button" className="lv-btn" onClick={() => toggleMuteForMe(selected)}>
            {mutedForMe.includes(selected) ? '◉ unmute for me' : '◌ mute for me'}
          </button>
          <button type="button" className="lv-btn lv-btn--warn" onClick={() => setReporting(selected)}>⚑ report</button>
          {iAmKeeper && (
            <button type="button" className="lv-btn lv-btn--warn" onClick={() => {
              sessionRef.current?.remove(selected)
              setSelected(null)
              flash('removed from this channel')
            }}>⊘ remove from channel</button>
          )}
        </div>
      )}

      {reporting && (
        <div className="lv-menu glass" role="group" aria-label="report reason">
          {REPORT_REASONS.map(r => (
            <button key={r} type="button" className="lv-btn lv-btn--warn" onClick={() => report(reporting, r)}>{r}</button>
          ))}
          <button type="button" className="lv-btn" onClick={() => setReporting(null)}>cancel</button>
        </div>
      )}

      <div className="lv-controls">
        {iAmCarrier ? (
          <>
            <button
              type="button"
              className={`lv-talk${talking ? ' lv-talk--on' : ''}`}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); hold(true) }}
              onPointerUp={() => hold(false)}
              onPointerCancel={() => hold(false)}
              onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); hold(true) } }}
              onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') hold(false) }}
              aria-pressed={talking}
            >
              {talking ? '● transmitting' : 'hold to talk'}
            </button>
            <button type="button" className="lv-btn" onClick={() => { hold(false); sessionRef.current?.passMic() }}>pass the mic</button>
          </>
        ) : queuePos >= 0 ? (
          <button type="button" className="lv-btn" onClick={() => sessionRef.current?.passMic()}>
            #{queuePos + 1} in line · cancel
          </button>
        ) : (
          <button type="button" className="lv-btn lv-btn--primary" onClick={() => sessionRef.current?.requestMic()}>● request the mic</button>
        )}
        {iAmKeeper && carrier && !iAmCarrier && (
          <button type="button" className="lv-btn lv-btn--warn" onClick={() => sessionRef.current?.cut()}>cut the mic</button>
        )}
      </div>

      <div className="lv-reactions" aria-label="react">
        {REACTIONS.map(g => (
          <button key={g} type="button" className="lv-react" onClick={() => { sessionRef.current?.react(g); float(g) }}>{g}</button>
        ))}
      </div>

      <div className="lv-floaters" aria-hidden="true">
        {floaters.map(f => <span key={f.id} className="lv-floater" style={{ left: `${f.left}%` }}>{f.glyph}</span>)}
      </div>

      {note && <div className="lv-note" role="status">{note}</div>}

      <p className="lv-foot">not recorded · push-to-talk · {Math.round(LIVE_TURN_CAP_MS / 1000)}s per turn · 18+ · not a crisis service</p>
    </div>
  )
}

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => { /* autoplay blocked until the next tap */ })
  }, [stream])
  useEffect(() => { if (ref.current) ref.current.muted = muted }, [muted])
  return <audio ref={ref} autoPlay playsInline className="lv-audio" data-live-audio="1" />
}
