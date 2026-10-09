import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  NOTIFICATION_GLYPHS,
  formatBadge,
  formatRelativeTime,
  groupNotifications,
  groupText,
  inQuietHours,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  matchesFilter,
  notificationTarget,
  readQuietHours,
  saveQuietHours,
  subscribeToNotifications,
} from '../lib/notifications'
import type { EcoNotification, InboxFilter, InboxGroup, QuietHours } from '../lib/notifications'
import { useWavelength } from '../hooks/useWavelength'
import { describePeer } from '../lib/wavelength'
import type { WaveMatch } from '../lib/wavelength'
import { LIVE_CHANNELS, OPEN_LIVE_KEY, liveVoiceMode } from '../lib/liveChannel'
import { isSupabaseConfigured } from '../lib/supabase-env'
import Toast from './Toast'
import HzBadge from './HzBadge'
import { PHANTOM_HZ } from '../lib/hzSignature'
import './NotificationBell.css'

const PAGE_SIZE = 30

const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'everything' },
  { id: 'you', label: 'your signals' },
  { id: 'wavelength', label: 'wavelength' },
]

const hourLabel = (h: number) => (h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`)

/**
 * The signal inbox: a bell with an unread badge that opens a full-screen,
 * live-updating hub — who's on your wavelength right now, live channels you
 * can drop into, and everything that happened to your signals, grouped so a
 * busy night reads at a glance. Quiet hours silence the toasts, not the count.
 */
export default function NotificationBell({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<EcoNotification[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [quiet, setQuiet] = useState<QuietHours>(() => readQuietHours())
  const [arrived, setArrived] = useState<string | null>(null)
  const wl = useWavelength()

  const refresh = useCallback((nextLimit = limit) => {
    void listNotifications(nextLimit).then(setItems)
  }, [limit])

  useEffect(() => { refresh() }, [refresh])

  // live arrivals: prepend, badge follows, toast announces (unless quiet hours)
  useEffect(() => {
    return subscribeToNotifications(notification => {
      setItems(prev => (prev.some(p => p.id === notification.id) ? prev : [notification, ...prev]))
      setArrived(notification.id)
      if (!inQuietHours(readQuietHours())) setToast(notification.text)
    })
  }, [])

  // other surfaces (the hub's wavelength strip) can open the inbox
  useEffect(() => {
    const onOpen = () => { setOpen(true); refresh() }
    window.addEventListener('ecosphere:open-inbox', onOpen)
    return () => window.removeEventListener('ecosphere:open-inbox', onOpen)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const unread = items.filter(i => !i.read)
  const groups = useMemo(() => groupNotifications(items.filter(n => matchesFilter(n, filter))), [items, filter])
  const liveMode = liveVoiceMode()

  const readGroup = (g: InboxGroup) => {
    const ids = new Set(g.items.map(i => i.id))
    setItems(prev => prev.map(p => (ids.has(p.id) ? { ...p, read: true } : p)))
    for (const n of g.items) if (!n.read) void markNotificationRead(n)
  }

  const openGroup = (g: InboxGroup) => {
    readGroup(g)
    const target = notificationTarget(g.type)
    if (target && onNavigate) { onNavigate(target); setOpen(false) }
  }

  const readAll = () => {
    setItems(prev => prev.map(p => ({ ...p, read: true })))
    void markAllNotificationsRead()
  }

  const loadMore = () => {
    const next = limit + PAGE_SIZE
    setLimit(next)
    refresh(next)
  }

  const joinLive = (id: string) => {
    try { window.sessionStorage.setItem(OPEN_LIVE_KEY, id) } catch { /* handled by the event below */ }
    onNavigate?.('rooms')
    window.dispatchEvent(new CustomEvent('ecosphere:open-live', { detail: { id } }))
    setOpen(false)
  }

  const toggleQuiet = () => {
    const next = { ...quiet, on: !quiet.on }
    setQuiet(next)
    saveQuietHours(next)
  }

  const showWavelength = isSupabaseConfigured || wl.live

  const inbox = open && createPortal(
    <div className="inbox-overlay" role="dialog" aria-modal="true" aria-label="Signal inbox" onClick={() => setOpen(false)}>
      <div className="inbox-panel" onClick={e => e.stopPropagation()}>
        <header className="inbox-head">
          <div>
            <span className="inbox-kicker">SIGNAL INBOX</span>
            <h2>{unread.length > 0 ? `${unread.length} new on your frequency` : 'you’re all caught up'}</h2>
          </div>
          <button type="button" className="inbox-close" onClick={() => setOpen(false)} aria-label="close inbox">✕</button>
        </header>

        <div className="inbox-status">
          <span className={`inbox-live-dot${wl.live ? ' on' : ''}`} aria-hidden="true" />
          <span>{wl.live ? (wl.online > 0 ? `on the grid · ${wl.online} on the band` : 'on the grid · just you so far') : wl.enabled ? 'offline' : 'wavelength off'}</span>
          <button type="button" className={`inbox-quiet${quiet.on ? ' on' : ''}`} onClick={toggleQuiet} aria-pressed={quiet.on}>
            ☾ quiet {hourLabel(quiet.from)}–{hourLabel(quiet.to)} · {quiet.on ? 'on' : 'off'}
          </button>
        </div>

        {showWavelength && (
          <section className="inbox-section" aria-label="On your wavelength">
            <div className="inbox-section-head">
              <span>ON YOUR WAVELENGTH · NOW</span>
              <button type="button" className="inbox-link" onClick={() => wl.setEnabled(!wl.enabled)}>
                {wl.enabled ? 'go unmatched' : 'turn on'}
              </button>
            </div>
            {!wl.enabled ? (
              <p className="inbox-empty">you’re off the wavelength. nobody can match with you, and you won’t see matches.</p>
            ) : wl.matches.length === 0 ? (
              <p className="inbox-empty">nobody close to your wavelength is up right now. stay on, and you’ll get pinged when someone is.</p>
            ) : (
              <div className="inbox-matches">
                {wl.matches.map(m => <MatchCard key={m.peer.key} match={m} sent={wl.sent[m.peer.key]} onWave={() => wl.wave(m.peer)} onTune={() => wl.tune(m.peer)} />)}
              </div>
            )}
          </section>
        )}

        {liveMode !== 'off' && (
          <section className="inbox-section" aria-label="Live channels">
            <div className="inbox-section-head"><span>LIVE VOICE · DROP IN</span></div>
            <div className="inbox-live-row">
              {LIVE_CHANNELS.map(c => (
                <button key={c.id} type="button" className="inbox-live-chip" onClick={() => joinLive(c.id)}>
                  <b aria-hidden="true">◉</b> {c.name} <em>{c.hz}</em>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="inbox-filters" role="tablist" aria-label="Filter">
          {FILTERS.map(f => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
          {unread.length > 0 && <button type="button" className="inbox-link inbox-readall" onClick={readAll}>mark all read</button>}
        </div>

        {groups.length === 0 && <p className="inbox-empty">the band is quiet here. post something and it’ll start talking back.</p>}
        <ul className="inbox-list">
          {groups.map(g => (
            <InboxRow key={g.key} group={g} fresh={g.items.some(i => i.id === arrived)} onOpen={() => openGroup(g)} onRead={() => readGroup(g)} />
          ))}
        </ul>
        {items.length >= limit && <button type="button" className="inbox-more" onClick={loadMore}>load older</button>}
      </div>
    </div>,
    document.body,
  )

  return (
    <div className="notif-root">
      <button
        type="button"
        className={`notif-bell${unread.length > 0 ? ' has-unread' : ''}${wl.matches.length > 0 ? ' has-match' : ''}`}
        aria-label={`signal inbox, ${unread.length} unread`}
        aria-haspopup="dialog"
        onClick={() => { setOpen(true); refresh() }}
      >
        <span aria-hidden="true">◔</span>
        {unread.length > 0 && <em className="notif-badge">{formatBadge(unread.length)}</em>}
      </button>
      {inbox}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  )
}

function MatchCard({ match, sent, onWave, onTune }: { match: WaveMatch; sent?: 'wave' | 'tune'; onWave: () => void; onTune: () => void }) {
  const { peer, score, reasons } = match
  return (
    <div className="inbox-match" style={{ '--peer': peer.color } as React.CSSProperties}>
      <span className="inbox-match-sigil" aria-hidden="true">{peer.sigil}</span>
      <div className="inbox-match-body">
        <strong>{describePeer(peer)}</strong>
        <span className="inbox-match-score">{score}% on your wavelength</span>
        {reasons.length > 0 && <span className="inbox-match-why">{reasons.join(' · ')}</span>}
      </div>
      <div className="inbox-match-actions">
        <button type="button" onClick={onWave} disabled={Boolean(sent)}>{sent === 'wave' ? 'waved ✓' : '◠ wave'}</button>
        <button type="button" onClick={onTune} disabled={Boolean(sent)}>{sent === 'tune' ? 'tuned ✓' : '⌖ tune in'}</button>
      </div>
    </div>
  )
}

function InboxRow({ group, fresh, onOpen, onRead }: { group: InboxGroup; fresh: boolean; onOpen: () => void; onRead: () => void }) {
  const wl = useWavelength()
  const n = group.latest
  const peerOnline = n.peer ? wl.peers.find(p => p.key === n.peer?.key) ?? null : null
  const canWaveBack = (n.type === 'wave' || n.type === 'tuned_in' || n.type === 'wavelength_match') && peerOnline
  const color = n.peer?.color
  return (
    <li className={`inbox-row inbox-row--${n.type}${group.unread === 0 ? ' read' : ''}${fresh ? ' fresh' : ''}`}>
      <button type="button" className="inbox-row-main" onClick={onOpen}>
        <span className="inbox-glyph" aria-hidden="true" style={color ? { color, borderColor: color } : undefined}>
          {n.peer?.sigil ?? NOTIFICATION_GLYPHS[n.type]}
        </span>
        <span className="inbox-row-text">
          <span>{groupText(group)}</span>
          <small>
            {formatRelativeTime(n.createdAt)}
            {group.items.length > 1 && ` · ${group.items.length} signals`}
            {n.type === 'phantom_interaction' && <>{' '}<HzBadge compact {...PHANTOM_HZ} /></>}
          </small>
        </span>
      </button>
      {canWaveBack && peerOnline && (
        <button
          type="button"
          className="inbox-row-action"
          disabled={Boolean(wl.sent[peerOnline.key])}
          onClick={() => { wl.wave(peerOnline); onRead() }}
        >
          {wl.sent[peerOnline.key] ? 'sent ✓' : '◠ wave back'}
        </button>
      )}
      {group.unread > 0 && (
        <button type="button" className="notif-read-dot" title="mark as read" aria-label="mark as read" onClick={onRead} />
      )}
    </li>
  )
}
