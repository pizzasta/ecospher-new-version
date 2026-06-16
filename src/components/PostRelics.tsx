import { useEffect, useState } from 'react'
import { agedPostRelics, maturingPosts, daysUntilRelic } from '../lib/postRelics'
import type { StoredPost } from '../lib/postRelics'
import { listLocalRecordings } from '../lib/localAudioStore'
import { formatRelativeTime } from '../lib/notifications'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import './PostRelics.css'

// Two views of one thing: a public post and the relic it becomes after the
// aging delay. The relics shelf shows the matured ones; the hub shows the link
// (what's still maturing, with a countdown, + what already crossed over).

async function blobFor(audioId: string): Promise<Blob | null> {
  try { return (await listLocalRecordings()).find(r => r.id === audioId)?.blob ?? null } catch { return null }
}

const preview = (text: string) => (text.length > 70 ? `${text.slice(0, 70)}…` : text)

export default function PostRelics({ view }: { view: 'relics' | 'hub' }) {
  const audio = useGlobalAudio()
  const [aged, setAged] = useState<StoredPost[]>([])
  const [maturing, setMaturing] = useState<StoredPost[]>([])

  useEffect(() => {
    setAged(agedPostRelics())
    setMaturing(maturingPosts())
  }, [])

  const play = (p: StoredPost) => {
    const meta = { id: p.id, label: 'a signal you kept', source: 'relics' as const }
    if (p.audioId) {
      void blobFor(p.audioId).then(b => { if (b) audio.playBlob(b, meta); else if (p.audioUrl) audio.playUrl(p.audioUrl, meta) })
      return
    }
    if (p.audioUrl) audio.playUrl(p.audioUrl, meta)
  }

  if (view === 'relics') {
    if (aged.length === 0) return null
    return (
      <div className="post-relics">
        <span className="post-relics-kicker">YOUR SIGNALS, KEPT · matured into relics</span>
        {aged.map(p => (
          <div key={p.id} className="post-relic">
            {(p.audioId || p.audioUrl) && (
              <button type="button" className="post-relic-play" aria-label="replay this relic" onClick={() => play(p)}>▸</button>
            )}
            <div className="post-relic-body">
              <strong>“{preview(p.content) || 'a voice signal you released'}”</strong>
              <em>released {formatRelativeTime(p.postedAt)} · the network kept it</em>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // hub view: the visible link between your public posts and their relics
  if (aged.length === 0 && maturing.length === 0) return null
  return (
    <div className="post-relics post-relics--hub">
      <span className="post-relics-kicker">SIGNALS BECOMING RELICS</span>
      {maturing.map(p => {
        const days = daysUntilRelic(p)
        return (
          <div key={p.id} className="post-relic post-relic--pending">
            <span className="post-relic-mark" aria-hidden="true">◌</span>
            <div className="post-relic-body">
              <strong>“{preview(p.content) || 'a voice signal'}”</strong>
              <em>becomes a relic in {days} {days === 1 ? 'day' : 'days'}</em>
            </div>
          </div>
        )
      })}
      {aged.map(p => (
        <div key={p.id} className="post-relic">
          <span className="post-relic-mark post-relic-mark--done" aria-hidden="true">◈</span>
          <div className="post-relic-body">
            <strong>“{preview(p.content) || 'a voice signal'}”</strong>
            <em>now a relic · on the relics shelf</em>
          </div>
        </div>
      ))}
    </div>
  )
}
