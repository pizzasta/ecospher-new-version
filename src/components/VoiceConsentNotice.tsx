import './VoiceConsentNotice.css'

// Shown once, before a first recording. Plain-language, voice + anonymity —
// no health/wellness framing. Acknowledging it starts the recording.

export default function VoiceConsentNotice({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  return (
    <div className="vcn-overlay" role="dialog" aria-modal="true" aria-label="Before your first recording">
      <div className="vcn-card atmo-soft-panel atmo-grain">
        <span className="vcn-kicker">before your first recording</span>
        <h2>your voice is yours</h2>
        <ul className="vcn-points">
          <li><i aria-hidden="true">◌</i> it stays private until you choose to share one.</li>
          <li><i aria-hidden="true">⬡</i> we never make a voiceprint or use your voice to identify you.</li>
          <li><i aria-hidden="true">∿</i> anything you share is screened before others can hear it.</li>
          <li><i aria-hidden="true">✕</i> you can delete any recording — and everything — anytime.</li>
        </ul>
        <div className="vcn-actions">
          <button type="button" className="vcn-skip" onClick={onClose}>not now</button>
          <button type="button" className="vcn-go" onClick={onAccept}>got it — record</button>
        </div>
        <p className="vcn-fine">more in our <a href="/privacy.html" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>
      </div>
    </div>
  )
}
