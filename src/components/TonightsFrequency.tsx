import { useEffect, useState } from 'react'
import AudioRecorder from './AudioRecorder'
import { playChainBlend, stopChainPlayback } from '../lib/sampleAudio'
import { listLocalRecordings } from '../lib/localAudioStore'
import {
  tonightsFrequency, lastNightsFrequency, contributedTonight, recordContribution,
  lastNightUploadId, weaveSources,
} from '../lib/tonightsFrequency'
import './TonightsFrequency.css'

// One shared station per night. Leave a ten-second signal on it; come back
// tomorrow to hear the band's woven echo of what was left there — your own
// voice from last night included.

export default function TonightsFrequency() {
  const tonight = tonightsFrequency()
  const lastNight = lastNightsFrequency()
  const [contributed, setContributed] = useState(() => contributedTonight())
  const [myYesterdayBlob, setMyYesterdayBlob] = useState<Blob | null>(null)
  const [weaving, setWeaving] = useState(false)

  useEffect(() => {
    const id = lastNightUploadId()
    if (!id) return
    let cancelled = false
    void listLocalRecordings().then(rows => {
      if (cancelled) return
      const mine = rows.find(r => r.id === id)
      if (mine) setMyYesterdayBlob(mine.blob)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => { stopChainPlayback() }, [])

  const playWeave = () => {
    setWeaving(true)
    void playChainBlend(weaveSources(Date.now(), myYesterdayBlob))
    window.setTimeout(() => setWeaving(false), 7000)
  }

  return (
    <section className="tf-card glass" aria-label="Tonight's frequency">
      <div className="tf-head">
        <span className="tf-kicker">TONIGHT'S FREQUENCY</span>
        <span className="tf-hz">{tonight.hz} Hz</span>
      </div>
      <h3 className="tf-title">{tonight.label}</h3>
      <p className="tf-line">{tonight.line}</p>

      {contributed ? (
        <div className="tf-done">
          <span className="tf-done-dot" aria-hidden="true" />
          you're on tonight's frequency. come back tomorrow to hear it woven.
        </div>
      ) : (
        <div className="tf-record">
          <AudioRecorder
            kind="signal"
            context={`frequency · ${tonight.label}`}
            prompt="ten seconds, one take. leave it on the frequency."
            minSeconds={3}
            maxSeconds={10}
            onComplete={({ uploadId }) => { recordContribution(uploadId); setContributed(true) }}
          />
        </div>
      )}

      <button type="button" className="tf-weave" onClick={playWeave} disabled={weaving}>
        <span className="tf-weave-glyph" aria-hidden="true">≋</span>
        {weaving ? "playing last night's weave…" : `hear last night's weave · ${lastNight.label}`}
      </button>
    </section>
  )
}
