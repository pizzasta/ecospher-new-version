import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import EcosphereLandingScreen from './EcosphereLandingScreen'
import IntroSequence from './IntroSequence'
import SignalLockIn from './SignalLockIn'
import { useEcosystemState } from '../hooks/useEcosystemState'
import type { EcosystemPage } from '../hooks/useEcosystemState'
import { migrateLocalDataToBackend, syncProfile } from '../lib'
import { usePointerParallax } from '../hooks/usePointerParallax'
import AudioRecorder from './AudioRecorder'
import ColorWave from './ColorWave'

const introSeenStorageKey = 'introSeen'
const ageGateStorageKey = 'ecosphere:ageGate'
const rulesAcceptedStorageKey = 'ecosphere:rulesAccepted'
const RULES_VERSION = 'v1'
const signalIdentityStorageKey = 'signalIdentity'
const signalProfileStorageKey = 'ecosphereSignalProfile'

// localStorage can throw in some privacy modes — never let that break boot
function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

const maxSignalNameLength = 24

const mundaneObjects = [
  'microwave',
  'vendingmachine',
  'plasticfork',
  'deadbattery',
  'hotpocket',
  'shoelace',
  'receipt',
  'ashtray',
  'sodacan',
  'hoodie',
  'voicemail',
  'lawnchair',
  'ceilingfan',
  'screendoor',
  'tupperware',
  'nightlight',
  'crockpot',
  'dialtone',
  'freezerburn',
  'couchcushion',
  'garagesale',
  'cassettetape',
  'mothball',
  'spraycheese',
  'bananapeel',
  'juicebox',
  'lavalamp',
  'doorbell',
  'keychain',
  'grocerylist',
  'windchime',
  'porchlight',
  'minivan',
  'trampoline',
  'expiredcoupon',
]

const mundanePlaces = [
  'gasstation',
  'parkinglot',
  'wafflehouse',
  'laundromat',
  'motelhallway',
  'walmartparkinglot',
  'checkoutlane',
  'breakroom',
  'stairwell',
  'drivethru',
  'foodcourt',
  'reststop',
  'cerealaisle',
  'basement',
  'culdesac',
  'busstop',
  'frozenfoodaisle',
  'mallfountain',
]

const mundaneAdjectives = [
  'blurry',
  'overcooked',
  'lukewarm',
  'haunted',
  'expired',
  'unplugged',
  'leftover',
  'offbrand',
  'flickering',
  'crooked',
  'halfeaten',
  'misplaced',
  'sleepy',
  'damp',
  'untitled',
  'secondhand',
  'microwaved',
]

const wistfulTails = [
  'oracle',
  'cathedral',
  'sermon',
  'prophecy',
  'hymn',
  'angel',
  'theory',
  'philosophy',
  'confession',
  'apology',
  'lullaby',
  'museum',
  'miracle',
  'paradox',
  'eulogy',
  'daydream',
  'amnesia',
  'limbo',
  'seance',
  'gospel',
  'epiphany',
]

const driftTails = [
  'fog',
  'echo',
  'collapse',
  'energy',
  'incident',
  'aftermath',
  'feeling',
  'syndrome',
  'situation',
  'rerun',
]

const whereabouts = [
  'bythelake',
  'inthewind',
  'at3am',
  'inthedryer',
  'underthebed',
  'onthecurb',
  'atdusk',
  'intheglovebox',
  'nooneclaimed',
]

const latenightLeads = ['voicemail', 'textback', 'lastcall', 'dialtone', 'rerun', 'leftovers']
const latenightHours = ['2', '3', '4', '11', 'midnight', 'closing']

const phraseNames = [
  'somebodyleftthetvon',
  'sinkfullofdishes',
  'cryingincheckoutlane',
  'voicemailafter2',
  'receiptinthewind',
  'hoodiebythelake',
  'blurrywafflehouse',
  'overcookedhotpocket',
  'motelhallwayecho',
  'deadbatteryangel',
  'shoelacecollapse',
  'walmartparkinglotfog',
  'lowbatteryphilosophy',
  'plasticforktheory',
  'vendingmachinehymn',
  'bananapeelprophecy',
  'gasstationoracle',
  'microwavecathedral',
  'parkinglotsermon',
  'sodaashtray',
  'fridgehumat3am',
  'cerealfordinneragain',
  'forgotwhyiwalkedin',
  'icecreamtruckatdusk',
  'halfdeflatedballoon',
  'doorbellnobodyanswered',
  'sprinklersatmidnight',
  'wrongnumberbutstayed',
  'leftoneearbudin',
  'grandmasashtray',
]

const softLeads = ['soft', 'tender', 'blurry', 'frozen', 'stale', 'fluorescent', 'lost', 'midnight', 'static']
const noiseTails = ['static', 'noise', 'radio', 'ghost', 'memory', 'receipt', 'laundry', 'goldfish', 'headphones', 'calendar', 'oracle', 'poet', 'club', 'checkout']

const atmosphericNames = [
  'porchlightorbit',
  'peachstreetlight',
  'rainonthecarport',
  'mothsinthelamplight',
  'tvglowthroughcurtains',
  'powerlinesatdusk',
  'heatlightningseason',
  'carradiobaptism',
  'airconditionerchoir',
  'glowinthedarkceiling',
]

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

const signalPatterns: Array<() => string> = [
  () => pick(softLeads) + pick(noiseTails),
  () => `3am${pick(mundanePlaces)}`,
  () => `${pick(mundaneObjects)}club`,
  () => pick(mundaneObjects) + pick(wistfulTails),
  () => pick(mundanePlaces) + pick(wistfulTails),
  () => pick(mundaneAdjectives) + pick(mundaneObjects),
  () => pick(mundaneAdjectives) + pick(mundanePlaces),
  () => pick(mundanePlaces) + pick(driftTails),
  () => pick(mundaneObjects) + pick(driftTails),
  () => `cryingin${pick(mundanePlaces)}`,
  () => pick(mundaneObjects) + pick(whereabouts),
  () => `${pick(latenightLeads)}after${pick(latenightHours)}`,
  () => pick(phraseNames),
  () => pick(phraseNames),
  () => pick(atmosphericNames),
]

function normalizeSignalName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxSignalNameLength)
}

function generateSignalBatch(exclude: readonly string[] = [], count = 5) {
  const batch: string[] = []
  const seen = new Set(exclude)
  let attempts = 0

  while (batch.length < count && attempts < 120) {
    attempts += 1
    const raw = pick(signalPatterns)()
    if (raw.length > maxSignalNameLength) continue
    const name = normalizeSignalName(raw)
    if (!name || seen.has(name)) continue
    seen.add(name)
    batch.push(name)
  }

  return batch
}

/**
 * Age gate: this space is for adults. Self-attestation is the strongest
 * check a client can run, and the answer is remembered either way —
 * declining is sticky, not a retry prompt.
 */
function AgeGateStep({ onAdult }: { onAdult: () => void }) {
  const [declined, setDeclined] = useState(() => safeStorageGet(ageGateStorageKey) === 'minor')

  if (declined) {
    return (
      <main className="claim-signal-shell age-gate-shell">
        <section className="identity-claim-screen age-gate-screen" aria-label="Age restriction">
          <div className="identity-claim-copy">
            <p>FREQUENCY RESTRICTED</p>
            <h1>this band is for adults.</h1>
            <span>ecosphere is an 18+ space. the frequency will still be here later.</span>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="claim-signal-shell age-gate-shell">
      <ColorWave />
      <section className="identity-claim-screen age-gate-screen" aria-label="Age check">
        <div className="identity-claim-copy">
          <p>BEFORE THE GATE</p>
          <h1>this space is for adults.</h1>
          <span>anonymous voices, late-night frequencies. you need to be 18 or older to enter.</span>
        </div>
        <div className="age-gate-actions">
          <button
            type="button"
            className="identity-enter-button"
            onClick={() => { safeStorageSet(ageGateStorageKey, 'adult'); onAdult() }}
          >
            I AM 18 OR OLDER
          </button>
          <button
            type="button"
            className="age-gate-decline"
            onClick={() => { safeStorageSet(ageGateStorageKey, 'minor'); setDeclined(true) }}
          >
            i'm under 18
          </button>
        </div>
      </section>
    </main>
  )
}

/** The band's rules: community guidelines + legal acceptance, one screen. */
function RulesStep({ onAccept }: { onAccept: () => void }) {
  return (
    <main className="claim-signal-shell rules-shell">
      <ColorWave />
      <section className="identity-claim-screen rules-screen" aria-label="Community rules">
        <div className="identity-claim-copy">
          <p>BEFORE YOU TUNE IN</p>
          <h1>the rules of the band.</h1>
          <span>short, serious, enforced automatically.</span>
        </div>
        <ul className="rules-list">
          <li><b>everyone here is anonymous.</b> keep it that way — no real names, no contact info, yours or anyone else's.</li>
          <li><b>18+ only.</b> anything involving minors is removed automatically and instantly.</li>
          <li><b>no harassment, threats, or sexual content</b> on the public band. an automated guardian screens everything public — no humans read your signals, and there's no appeals desk.</li>
          <li><b>what you record is yours.</b> private by default. delete everything, any time, in settings.</li>
          <li><b>if tonight feels heavier than usual, you deserve more than strangers on a band.</b> we're glad you're here, and we want you safe more than we want you tuned in — a real person is ready at 988 (US, call or text), 116 123 (samaritans, UK & ROI), or findahelpline.com anywhere. the band will still be here after.</li>
        </ul>
        <div className="rules-actions">
          <button
            type="button"
            className="identity-enter-button"
            onClick={() => { safeStorageSet(rulesAcceptedStorageKey, RULES_VERSION); onAccept() }}
          >
            I AGREE — TUNE ME IN
          </button>
          <p className="rules-legal">
            by entering you accept the{' '}
            <a href="/terms.html" target="_blank" rel="noreferrer">terms</a> and{' '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">privacy</a> notes.
          </p>
        </div>
      </section>
    </main>
  )
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
  const parallaxRef = usePointerParallax<HTMLElement>()
  const [suggestions, setSuggestions] = useState(() => generateSignalBatch())
  const [selectedSignal, setSelectedSignal] = useState(() => suggestions[0] ?? '')
  const [manualSignal, setManualSignal] = useState('')
  const [enteringDrift, setEnteringDrift] = useState(false)
  const [keyPulse, setKeyPulse] = useState(0)
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'clear'>('idle')
  const activeSignal = normalizeSignalName(manualSignal || selectedSignal)
  const signalTooShort = activeSignal.length > 0 && activeSignal.length < 3
  const orbEnergy = Math.min(1, Math.max(0.35, activeSignal.length / 18))

  // signal scanner: every identity change sweeps the band before clearing it
  useEffect(() => {
    if (!activeSignal) {
      setScanState('idle')
      return
    }
    setScanState('scanning')
    const t = window.setTimeout(() => setScanState('clear'), 650 + Math.random() * 500)
    return () => window.clearTimeout(t)
  }, [activeSignal])

  const regenerateSignals = () => {
    const nextSuggestions = generateSignalBatch(suggestions)
    setSuggestions(nextSuggestions)
    setSelectedSignal(nextSuggestions[0] ?? '')
    setManualSignal('')
  }

  const enterDrift = () => {
    if (!activeSignal || activeSignal.length < 3 || enteringDrift) return
    setEnteringDrift(true)
    window.setTimeout(() => onComplete(activeSignal, 'pink-core'), 680)
  }

  return (
    <main
      className={`claim-signal-shell identity-claim-shell ${enteringDrift ? 'entering-drift' : ''} ${keyPulse % 2 === 1 ? 'key-pulse-a' : 'key-pulse-b'}`}
      ref={parallaxRef}
      style={{ '--claim-energy': orbEnergy } as CSSProperties}
    >
      <div className="claim-atmosphere" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="boot-static-field" aria-hidden="true" />
      <div className="boot-fog-field" aria-hidden="true" />
      <ColorWave />
      <div className="identity-frequency-field" aria-hidden="true">
        <div className="identity-frequency-lines" />
        {Array.from({ length: 10 }, (_, index) => (
          <span
            className="identity-signal-mote"
            key={index}
            style={{
              '--mote-left': `${(index * 23 + 7) % 100}%`,
              '--mote-delay': `${index * 1.7}s`,
              '--mote-duration': `${14 + (index % 5) * 3}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      <section className="identity-claim-screen" aria-label="Claim your signal">
        <div className="identity-claim-copy">
          <p>find your frequency</p>
          <h1>pick a signal people remember</h1>
          <span>no photo, no bio — just a frequency that's yours.</span>
        </div>

        <div className="claim-orb-field identity-orb-field" aria-hidden="true">
          <div className="boot-resonance-rings">
            <span />
            <span />
            <span />
          </div>
          <div className="claim-orb-ripple" />
          <div className="claim-orb-ripple claim-orb-ripple-two" />
          <div className="claim-orb-ripple claim-orb-ripple-three" />
          <div className="boot-orbit boot-orbit-one" />
          <div className="boot-orbit boot-orbit-two" />
          <div className="claim-signal-orb pink-core">
            <i />
            <b />
          </div>
        </div>

        <div className="identity-claim-panel">
          <div className="identity-panel-scanline" aria-hidden="true" />
          <div className="identity-visualizer" aria-hidden="true"><span /><span /><span /></div>
          <div className="identity-suggestion-header">
            <p>SUGGESTED SIGNAL</p>
            <button onClick={regenerateSignals} type="button">
              regenerate
            </button>
          </div>
          <strong aria-label={activeSignal || 'waiting for signal'}>
            {(activeSignal || 'waiting_for_signal').split('').map((ch, i) => (
              <span className="identity-letter" key={`${i}-${ch}`} style={{ '--ci': i } as CSSProperties}>{ch}</span>
            ))}
          </strong>
          <div className={`identity-scanner identity-scanner--${signalTooShort ? 'scanning' : scanState}`} aria-live="polite">
            {signalTooShort && <>signal too faint — 3 characters minimum</>}
            {!signalTooShort && scanState === 'scanning' && <><i /> scanning the band…</>}
            {!signalTooShort && scanState === 'clear' && <>✓ frequency available · unclaimed</>}
            {!signalTooShort && scanState === 'idle' && <>⌖ awaiting signal</>}
          </div>

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
              onChange={(event) => {
                setManualSignal(event.target.value)
                setKeyPulse(n => n + 1)
              }}
              placeholder="type your signal..."
              type="text"
              value={manualSignal}
            />
          </label>

          <button className="identity-enter-button" disabled={!activeSignal || activeSignal.length < 3} onClick={enterDrift} type="button">
            ENTER THE DRIFT
          </button>

          <em>your signal is stored locally. only you carry it.</em>
        </div>
      </section>
    </main>
  )
}

const firstSignalStorageKey = 'ecosphere:firstSignalDone'

/**
 * The first-signal ritual: before entering, every new carrier leaves a
 * ten-second voice note answering "what's a sound you miss?". It plays back
 * once with a faint reverb — proof the ecosystem heard them.
 */
function FirstSignalRitualStep({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'recording' | 'echo'>('recording')
  const [micBlocked, setMicBlocked] = useState(false)
  const echoCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => () => {
    if (echoCtxRef.current) void echoCtxRef.current.close()
  }, [])

  const playWithReverb = async (blob: Blob) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return
      const ctx = new AudioContextCtor()
      echoCtxRef.current = ctx
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
      const source = ctx.createBufferSource()
      source.buffer = buffer

      const dry = ctx.createGain()
      dry.gain.value = 0.85
      const delay = ctx.createDelay(1)
      delay.delayTime.value = 0.17
      const feedback = ctx.createGain()
      feedback.gain.value = 0.32
      const wet = ctx.createGain()
      wet.gain.value = 0.28

      source.connect(dry)
      dry.connect(ctx.destination)
      source.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wet)
      wet.connect(ctx.destination)
      source.start()
    } catch {
      /* echo playback is a gift, not a requirement */
    }
  }

  return (
    <main className="claim-signal-shell identity-claim-shell first-signal-shell">
      <div className="claim-atmosphere" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>
      <div className="boot-static-field" aria-hidden="true" />
      <div className="boot-fog-field" aria-hidden="true" />
      <ColorWave />

      <section className="identity-claim-screen" aria-label="Record your first signal">
        <div className="identity-claim-copy">
          <p>STEP 03 // FIRST TRANSMISSION</p>
          <h1>{phase === 'echo' ? 'THE ECOSYSTEM HEARD YOU' : "WHAT'S A SOUND YOU MISS?"}</h1>
          <span>
            {phase === 'echo'
              ? 'your first signal is out there now, echoing.'
              : "ten seconds. say it like you're leaving it on a machine."}
          </span>
        </div>

        <div className="identity-claim-panel first-signal-panel">
          {phase === 'recording' && (
            <>
              <AudioRecorder
                kind="signal"
                context="first signal"
                prompt="a kettle. a dial tone. someone's laugh from another room. whatever it is — describe it, or do the impression."
                minSeconds={3}
                maxSeconds={12}
                onComplete={({ blob }) => {
                  setPhase('echo')
                  void playWithReverb(blob)
                }}
                onDenied={() => setMicBlocked(true)}
              />
              {micBlocked && (
                <button type="button" className="first-signal-silent" onClick={onComplete}>
                  enter in silence — the ecosystem will wait for your voice
                </button>
              )}
            </>
          )}
          {phase === 'echo' && (
            <button type="button" className="identity-enter-button" onClick={onComplete}>
              ENTER THE ECOSPHERE
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

const navLabelToPage: Record<string, EcosystemPage> = {
  anomalies: 'anomalies',
  capsules: 'capsules',
  'dead zones': 'zones',
  drift: 'drift',
  frequencies: 'frequencies',
  observatory: 'home',
  relics: 'relics',
  rooms: 'rooms',
  settings: 'settings',
  signals: 'signals',
  'soul pod': 'pod',
  unsent: 'unsent',
}

function readElementText(element: Element | null) {
  return element?.textContent?.trim().replace(/\s+/g, ' ') || ''
}

function EcosystemLoopBridge() {
  const { enterRoom, exploreDrift, saveCapsule, unlockRelic, visitPage } = useEcosystemState()

  useEffect(() => {
    visitPage('home')
  }, [visitPage])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const navButton = target.closest('.nav-item')
      if (navButton) {
        // data-page survives translation; the label-text map is the legacy fallback
        const pageAttr = navButton.getAttribute('data-page') as EcosystemPage | null
        const label = readElementText(navButton.querySelector('.nav-label')).toLowerCase()
        const nextPage = pageAttr ?? navLabelToPage[label]
        if (nextPage) {
          visitPage(nextPage)
          if (nextPage === 'drift') exploreDrift('opened drift field')
          if (nextPage === 'rooms') enterRoom('resonance-chambers')
        }
        return
      }

      const driftNode = target.closest('.drift-node')
      if (driftNode) {
        exploreDrift(`${readElementText(driftNode) || 'drift node'} explored`)
        return
      }

      const capsuleCard = target.closest('.capsule-card')
      if (capsuleCard) {
        saveCapsule(normalizeSignalName(readElementText(capsuleCard.querySelector('.capsule-title'))) || 'capsule')
        return
      }

      const relicCard = target.closest('.relic-card')
      if (relicCard) {
        unlockRelic(normalizeSignalName(readElementText(relicCard.querySelector('.relic-name'))) || 'relic')
        return
      }

      const roomCard = target.closest('.room-card')
      if (roomCard) {
        enterRoom(normalizeSignalName(readElementText(roomCard.querySelector('.room-name'))) || 'room')
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [enterRoom, exploreDrift, saveCapsule, unlockRelic, visitPage])

  return null
}

export default function IntroGate({ children }: { children: ReactNode }) {
  const [isAdult, setIsAdult] = useState(() => safeStorageGet(ageGateStorageKey) === 'adult')
  const [rulesAccepted, setRulesAccepted] = useState(() => safeStorageGet(rulesAcceptedStorageKey) === RULES_VERSION)
  const [landingEntered, setLandingEntered] = useState(false)
  const [introSeen, setIntroSeen] = useState(() => safeStorageGet(introSeenStorageKey) === 'true')
  const [signalIdentity, setSignalIdentity] = useState(() => safeStorageGet(signalIdentityStorageKey) ?? '')
  // the ritual only gates identities claimed in this session — existing carriers pass through
  const [needsFirstSignal, setNeedsFirstSignal] = useState(false)
  // the lock-in moment only plays for a signal just claimed this session
  const [lockInPending, setLockInPending] = useState(false)

  useEffect(() => {
    if (signalIdentity) {
      void migrateLocalDataToBackend()
    }
  }, [signalIdentity])

  const completeIntro = () => {
    safeStorageSet(introSeenStorageKey, 'true')
    setIntroSeen(true)
  }

  const completeSignalClaim = (signal: string, signalCore: string) => {
    const nextSignalIdentity = normalizeSignalName(signal)
    const nextProfile = {
      username: nextSignalIdentity,
      signalCore,
      onboardingComplete: true,
    }

    safeStorageSet(signalIdentityStorageKey, nextSignalIdentity)
    safeStorageSet(signalProfileStorageKey, JSON.stringify(nextProfile))
    setSignalIdentity(nextSignalIdentity)
    setLockInPending(true)
    if (safeStorageGet(firstSignalStorageKey) !== 'true') {
      setNeedsFirstSignal(true)
    }
    void syncProfile(nextSignalIdentity, signalCore)
  }

  const completeFirstSignal = () => {
    safeStorageSet(firstSignalStorageKey, 'true')
    setNeedsFirstSignal(false)
  }

  const resetIntroForTesting = () => {
    safeStorageRemove(introSeenStorageKey)
    safeStorageRemove(signalIdentityStorageKey)
    safeStorageRemove(signalProfileStorageKey)
    safeStorageRemove(firstSignalStorageKey)
    safeStorageRemove(ageGateStorageKey)
    safeStorageRemove(rulesAcceptedStorageKey)
    try { window.localStorage.removeItem('ecosphere:tourDone') } catch { /* storage unavailable */ }
    window.location.reload()
  }

  if (!isAdult) {
    return <AgeGateStep onAdult={() => setIsAdult(true)} />
  }

  if (!rulesAccepted) {
    return <RulesStep onAccept={() => setRulesAccepted(true)} />
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

  if (lockInPending) {
    return (
      <>
        <SignalLockIn signalName={signalIdentity} onComplete={() => setLockInPending(false)} />
        <DevOnboardingReset onReset={resetIntroForTesting} />
      </>
    )
  }

  if (needsFirstSignal) {
    return (
      <>
        <FirstSignalRitualStep onComplete={completeFirstSignal} />
        <DevOnboardingReset onReset={resetIntroForTesting} />
      </>
    )
  }

  return (
    <>
      <EcosystemLoopBridge />
      {children}
    </>
  )
}
