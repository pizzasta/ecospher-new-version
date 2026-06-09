import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import EcosphereLandingScreen from './EcosphereLandingScreen'
import IntroSequence from './IntroSequence'

const introSeenStorageKey = 'introSeen'
const signalIdentityStorageKey = 'signalIdentity'
const signalProfileStorageKey = 'ecosphereSignalProfile'
const suggestedSignalNames = ['static_radio', 'halo_07', 'noctiswave', 'relicform', 'signal_veil']
const signalNamePool = [
  'static_radio',
  'halo_07',
  'noctiswave',
  'relicform',
  'signal_veil',
  'halo_void',
  'lost_carrier',
  'echo_bloom',
  'driftmemory',
  'nova_07',
  'ghost_frequency',
  'pink_carrier',
  'violet_replay',
  'afterglow_02',
  'silent_bloom',
  'midnight_relic',
]

function normalizeSignalName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
}

function createSignalSuggestions(offset: number) {
  return Array.from({ length: 5 }, (_, index) => signalNamePool[(index + offset) % signalNamePool.length])
}

function DevOnboardingReset({ onReset }: { onReset: () => void }) {
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <button className="dev-onboarding-reset" onClick={onReset} type="button">
      reset intro flow
    </button>
  )
}

function ClaimSignalIdentityStep({ onComplete }: { onComplete: (signal: string, signalCore: string) => void }) {
  const [offset, setOffset] = useState(0)
  const [selectedSignal, setSelectedSignal] = useState(suggestedSignalNames[0])
  const [manualSignal, setManualSignal] = useState('')
  const [enteringDrift, setEnteringDrift] = useState(false)
  const suggestions = useMemo(() => createSignalSuggestions(offset), [offset])
  const activeSignal = normalizeSignalName(manualSignal || selectedSignal)
  const orbEnergy = Math.min(1, Math.max(0.35, activeSignal.length / 18))

  const regenerateSignals = () => {
    const nextOffset = (offset + 3) % signalNamePool.length
    const nextSuggestions = createSignalSuggestions(nextOffset)
    setOffset(nextOffset)
    setSelectedSignal(nextSuggestions[0])
    setManualSignal('')
  }

  const enterDrift = () => {
    if (!activeSignal || enteringDrift) return
    setEnteringDrift(true)
    window.setTimeout(() => onComplete(activeSignal, 'pink-core'), 680)
  }

  return (
    <main className={`claim-signal-shell identity-claim-shell ${enteringDrift ? 'entering-drift' : ''}`} style={{ '--claim-energy': orbEnergy } as CSSProperties}>
      <div className="claim-atmosphere" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="boot-static-field" aria-hidden="true" />
      <div className="boot-fog-field" aria-hidden="true" />

      <section className="identity-claim-screen" aria-label="Claim your signal">
        <div className="identity-claim-copy">
          <p>STEP 02 // IDENTITY</p>
          <h1>CLAIM YOUR SIGNAL</h1>
          <span>no photo. no bio. just a frequency.</span>
        </div>

        <div className="claim-orb-field identity-orb-field" aria-hidden="true">
          <div className="boot-resonance-rings">
            <span />
            <span />
            <span />
          </div>
          <div className="claim-orb-ripple" />
          <div className="claim-orb-ripple claim-orb-ripple-two" />
          <div className="boot-orbit boot-orbit-one" />
          <div className="boot-orbit boot-orbit-two" />
          <div className="claim-signal-orb pink-core">
            <i />
            <b />
          </div>
        </div>

        <div className="identity-claim-panel">
          <div className="identity-suggestion-header">
            <p>SUGGESTED SIGNAL</p>
            <button onClick={regenerateSignals} type="button">
              regenerate
            </button>
          </div>
          <strong>{activeSignal || 'waiting_for_signal'}</strong>

          <div className="identity-suggestion-grid" aria-label="Suggested signal identities">
            {suggestions.map((signal) => (
              <button
                className={!manualSignal && selectedSignal === signal ? 'active' : ''}
                key={signal}
                onClick={() => {
                  setSelectedSignal(signal)
                  setManualSignal('')
                }}
                type="button"
              >
                {signal}
              </button>
            ))}
          </div>

          <label className="identity-manual-label">
            <span>OR TUNE MANUALLY</span>
            <input
              onChange={(event) => setManualSignal(event.target.value)}
              placeholder="type your signal..."
              type="text"
              value={manualSignal}
            />
          </label>

          <button className="identity-enter-button" disabled={!activeSignal} onClick={enterDrift} type="button">
            ENTER THE DRIFT
          </button>

          <em>your signal is stored locally. only you carry it.</em>
        </div>
      </section>
    </main>
  )
}

export default function IntroGate({ children }: { children: ReactNode }) {
  const [landingEntered, setLandingEntered] = useState(false)
  const [introSeen, setIntroSeen] = useState(() => window.localStorage.getItem(introSeenStorageKey) === 'true')
  const [signalIdentity, setSignalIdentity] = useState(() => window.localStorage.getItem(signalIdentityStorageKey) ?? '')

  const completeIntro = () => {
    window.localStorage.setItem(introSeenStorageKey, 'true')
    setIntroSeen(true)
  }

  const completeSignalClaim = (signal: string, signalCore: string) => {
    const nextSignalIdentity = normalizeSignalName(signal)
    const nextProfile = {
      username: nextSignalIdentity,
      signalCore,
      onboardingComplete: true,
    }

    window.localStorage.setItem(signalIdentityStorageKey, nextSignalIdentity)
    window.localStorage.setItem(signalProfileStorageKey, JSON.stringify(nextProfile))
    setSignalIdentity(nextSignalIdentity)
  }

  const resetIntroForTesting = () => {
    window.localStorage.removeItem(introSeenStorageKey)
    window.localStorage.removeItem(signalIdentityStorageKey)
    window.localStorage.removeItem(signalProfileStorageKey)
    window.location.reload()
  }

  if (!introSeen && !landingEntered) {
    return (
      <>
        <EcosphereLandingScreen onEnterComplete={() => setLandingEntered(true)} />
        <DevOnboardingReset onReset={resetIntroForTesting} />
      </>
    )
  }

  if (!introSeen) {
    return (
      <>
        <IntroSequence onComplete={completeIntro} onSkip={completeIntro} />
        <DevOnboardingReset onReset={resetIntroForTesting} />
      </>
    )
  }

  if (!signalIdentity) {
    return (
      <>
        <ClaimSignalIdentityStep onComplete={completeSignalClaim} />
        <DevOnboardingReset onReset={resetIntroForTesting} />
      </>
    )
  }

  return <>{children}</>
}
