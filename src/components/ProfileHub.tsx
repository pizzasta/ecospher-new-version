import { useEffect, useMemo, useState } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { playSample } from '../lib/sampleAudio'
import { deleteLocalRecording, listLocalRecordings } from '../lib/localAudioStore'
import type { StoredRecording } from '../lib/localAudioStore'
import { getListenCounts, getProfile, updateBio } from '../lib'
import { isSupabaseConfigured } from '../lib/supabase-env'
import { generateLocalBio, requestAiBio } from '../lib/aiBio'
import { getHzProfile } from '../lib/hzSignature'
import type { HzProfile } from '../lib/hzSignature'
import AudioPlayer from './AudioPlayer'
import HzBadge from './HzBadge'
import HzSettingsModal from './HzSettingsModal'
import './ProfileHub.css'

const BIO_KEY = 'ecosphere:bio'
const FIRST_SEEN_KEY = 'ecosphere:firstSeenAt'
const TUNED_TO_KEY = 'ecosphere:tunedTo'
const ECHO_PAGE = 10

function readLocal(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeLocal(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* session only */ }
}

export function readTunedTo(): string[] {
  try { return JSON.parse(window.localStorage.getItem(TUNED_TO_KEY) ?? '[]') } catch { return [] }
}

/**
 * Profile Hub: the user's own page inside the Soul Pod. Header with editable
 * bio + AI bio, echo archive, 7-day listening history, capsule vault counts,
 * and listener / tuned-to stats. Two columns on desktop, one on mobile.
 */
export default function ProfileHub({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const { ecosystemState } = useEcosystemState()
  const globalAudio = useGlobalAudio()

  // ── header data ──
  const username = ecosystemState.userSignalIdentity ?? 'unclaimed frequency'
  const [joined, setJoined] = useState<string | null>(null)
  const [bio, setBio] = useState(() => readLocal(BIO_KEY) ?? '')
  const [editingBio, setEditingBio] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [aiBioOpen, setAiBioOpen] = useState(false)
  const [aiBioDraft, setAiBioDraft] = useState('')
  const [aiBioSeed, setAiBioSeed] = useState(0)
  const [aiBioBusy, setAiBioBusy] = useState(false)
  const [hzProfile, setHzProfile] = useState<HzProfile | null>(null)
  const [hzSettingsOpen, setHzSettingsOpen] = useState(false)

  useEffect(() => {
    void getHzProfile(username).then(setHzProfile)
  }, [username])

  useEffect(() => {
    // join date: backend profile when available, else first local visit
    if (!readLocal(FIRST_SEEN_KEY)) writeLocal(FIRST_SEEN_KEY, String(Date.now()))
    void getProfile().then(profile => {
      if (profile) {
        setJoined(new Date(profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' }))
        if (profile.bio) setBio(profile.bio)
        return
      }
      const local = Number(readLocal(FIRST_SEEN_KEY))
      if (Number.isFinite(local) && local > 0) {
        setJoined(new Date(local).toLocaleDateString([], { month: 'short', year: 'numeric' }))
      }
    })
  }, [])

  const saveBio = (next: string) => {
    const trimmed = next.trim().slice(0, 200)
    setBio(trimmed)
    writeLocal(BIO_KEY, trimmed)
    void updateBio(trimmed)
    setEditingBio(false)
  }

  // ── echo archive ──
  const [echoes, setEchoes] = useState<StoredRecording[]>([])
  const [echoLimit, setEchoLimit] = useState(ECHO_PAGE)

  const generateBio = async (seed: number) => {
    setAiBioBusy(true)
    const remote = await requestAiBio(ecosystemState.listeningHistory.slice(0, 10).map(e => e.label))
    setAiBioDraft(remote ?? generateLocalBio({
      username,
      recordingCount: echoes.length,
      topPage: ecosystemState.recentInteractions.find(i => i.page && i.page !== 'pod')?.page ?? null,
      streak: ecosystemState.streak.count,
      joinedLabel: joined,
    }, seed))
    setAiBioBusy(false)
  }
  useEffect(() => {
    void listLocalRecordings().then(rows => setEchoes(rows.sort((a, b) => b.createdAt - a.createdAt)))
  }, [])

  const deleteEcho = (id: string) => {
    void deleteLocalRecording(id).then(() => setEchoes(prev => prev.filter(e => e.id !== id)))
  }

  // ── listening history (last 7 days) ──
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const history = ecosystemState.listeningHistory.filter(entry => new Date(entry.playedAt).getTime() >= weekAgo).slice(0, 12)

  const relisten = (entry: { id: string; label: string }) => {
    void playSample(globalAudio, { id: `relisten-${entry.id}`, label: entry.label, source: 'pod' }, 'voice', entry.label.length * 31, 5000)
  }

  // ── capsule vault counts ──
  const personalCapsules = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('ecosphere:personalCapsules') ?? '[]') as unknown[]).length } catch { return 0 }
  }, [])
  const forming = useMemo(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem('ecosphere:capsuleForming') ?? '{}') as { readyAt?: number }
      return raw.readyAt != null && raw.readyAt > Date.now() ? 1 : 0
    } catch { return 0 }
  }, [])

  // ── social stats: listeners / tuned to ──
  const [counts, setCounts] = useState<{ listeners: number; tunedTo: number }>({ listeners: 0, tunedTo: readTunedTo().length })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    void getListenCounts().then(remote => {
      setCounts({ listeners: remote.listeners, tunedTo: Math.max(remote.tunedTo, readTunedTo().length) })
    })
  }, [])

  return (
    <section className="profile-hub" aria-label="Profile hub">
      <div className="ph-col">
        {/* header */}
        <div className="ph-card glass">
          <div className="ph-header-row">
            <h3 className="ph-username">◈ {username}</h3>
            {hzProfile && (
              <span className="ph-header-hz">
                <HzBadge hz={hzProfile.hz} displayName={hzProfile.displayName} color={hzProfile.color} />
                <button type="button" className="ph-hz-cog" title="hz signature settings" aria-label="hz signature settings" onClick={() => setHzSettingsOpen(true)}>⚙</button>
              </span>
            )}
          </div>
          {joined && <p className="ph-joined">on the band since {joined}</p>}
          {hzSettingsOpen && hzProfile && (
            <HzSettingsModal profile={hzProfile} onChange={setHzProfile} onClose={() => setHzSettingsOpen(false)} />
          )}

          {!editingBio ? (
            <div className="ph-bio-row">
              <p className="ph-bio">{bio || 'no bio yet — the static speaks for you.'}</p>
              <button type="button" className="ph-icon-btn" title="edit bio" onClick={() => { setBioDraft(bio); setEditingBio(true) }}>✎</button>
            </div>
          ) : (
            <div className="ph-bio-edit">
              <textarea value={bioDraft} maxLength={200} rows={2} onChange={e => setBioDraft(e.target.value)} />
              <div className="ph-bio-edit-actions">
                <span>{bioDraft.length}/200</span>
                <button type="button" onClick={() => saveBio(bioDraft)}>save</button>
                <button type="button" onClick={() => setEditingBio(false)}>cancel</button>
              </div>
            </div>
          )}

          <button type="button" className="ph-ai-bio-btn" onClick={() => { setAiBioOpen(true); void generateBio(aiBioSeed) }}>
            ✦ ai bio
          </button>

          {aiBioOpen && (
            <div className="ph-ai-modal" role="dialog" aria-label="AI bio">
              <p className="ph-ai-draft">{aiBioBusy ? 'reading your frequency…' : aiBioDraft}</p>
              <div className="ph-ai-actions">
                <button type="button" disabled={aiBioBusy || !aiBioDraft} onClick={() => { saveBio(aiBioDraft); setAiBioOpen(false) }}>accept</button>
                <button type="button" disabled={aiBioBusy} onClick={() => { const next = aiBioSeed + 1; setAiBioSeed(next); void generateBio(next) }}>regenerate</button>
                <button type="button" onClick={() => setAiBioOpen(false)}>close</button>
              </div>
            </div>
          )}
        </div>

        {/* echo archive */}
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">ECHO ARCHIVE</span>
            <span className="ph-card-count">{echoes.length}</span>
          </div>
          {echoes.length === 0 && <p className="ph-empty">no echoes yet. your recordings gather here.</p>}
          <div className="ph-echo-list">
            {echoes.slice(0, echoLimit).map(echo => (
              <div key={echo.id} className="ph-echo">
                <div className="ph-echo-meta">
                  <span>{new Date(echo.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  <span>{Math.max(1, Math.round(echo.durationMs / 1000))}s</span>
                  <button type="button" className="ph-icon-btn ph-icon-btn--danger" title="delete echo" onClick={() => deleteEcho(echo.id)}>✕</button>
                </div>
                <AudioPlayer src={echo.blob} title={echo.label} seed={echo.createdAt % 9973} durationSeconds={echo.durationMs / 1000} />
              </div>
            ))}
          </div>
          {echoes.length > echoLimit && (
            <button type="button" className="ph-load-more" onClick={() => setEchoLimit(n => n + ECHO_PAGE)}>load more</button>
          )}
        </div>
      </div>

      <div className="ph-col">
        {/* listening history */}
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">LISTENING HISTORY</span>
            <span className="ph-card-count">7 days</span>
          </div>
          {history.length === 0 && <p className="ph-empty">nothing replayed this week. the band waits.</p>}
          <ul className="ph-history">
            {history.map(entry => (
              <li key={entry.id}>
                <span className="ph-history-label">{entry.label}</span>
                <span className="ph-history-date">{new Date(entry.playedAt).toLocaleDateString([], { weekday: 'short' })}</span>
                <button type="button" onClick={() => relisten(entry)}>↻ relisten</button>
              </li>
            ))}
          </ul>
        </div>

        {/* capsule vault */}
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">CAPSULE VAULT</span>
          </div>
          <div className="ph-vault-row">
            <button type="button" className="ph-vault-stat" onClick={() => onNavigate?.('capsules')}>
              <strong>{personalCapsules}</strong>
              <span>sealed transmissions</span>
            </button>
            <button type="button" className="ph-vault-stat" onClick={() => onNavigate?.('capsules')}>
              <strong>{forming}</strong>
              <span>still forming</span>
            </button>
          </div>
        </div>

        {/* social stats — listeners / tuned to */}
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">SIGNAL REACH</span>
          </div>
          <div className="ph-vault-row">
            <div className="ph-vault-stat ph-vault-stat--static">
              <strong>{counts.listeners}</strong>
              <span>listeners</span>
            </div>
            <div className="ph-vault-stat ph-vault-stat--static">
              <strong>{counts.tunedTo}</strong>
              <span>tuned to</span>
            </div>
          </div>
          <p className="ph-hint">tune to carriers from the observatory's active carriers panel.</p>
        </div>

        {/* settings links */}
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">TUNING</span>
          </div>
          <div className="ph-settings-links">
            <button type="button" onClick={() => onNavigate?.('settings')}>profile visibility</button>
            <button type="button" onClick={() => onNavigate?.('settings')}>lurker mode</button>
            <button type="button" onClick={() => onNavigate?.('settings')}>erase account data</button>
          </div>
        </div>
      </div>
    </section>
  )
}
