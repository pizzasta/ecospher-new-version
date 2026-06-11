import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import EcosphereLandingScreen from './EcosphereLandingScreen'
import IntroSequence from './IntroSequence'
import { useEcosystemState } from '../hooks/useEcosystemState'
import type { EcosystemPage } from '../hooks/useEcosystemState'
import { migrateLocalDataToBackend, syncProfile } from '../lib'
import { usePointerParallax } from '../hooks/usePointerParallax'

const introSeenStorageKey = 'introSeen'
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
    if (!activeSignal || enteringDrift) return
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
          <div className="claim-orb-ripple claim-orb-ripple-three" />
          <div className="boot-orbit boot-orbit-one" />
          <div className="boot-orbit boot-orbit-two" />
          <div className="claim-signal-orb pink-core">
            <i />
            <b />
          </div>
        </div>

        <div className="identity-claim-panel">
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
          <div className={`identity-scanner identity-scanner--${scanState}`} aria-live="polite">
            {scanState === 'scanning' && <><i /> scanning the band…</>}
            {scanState === 'clear' && <>✓ frequency available · unclaimed</>}
            {scanState === 'idle' && <>⌖ awaiting signal</>}
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

          <button className="identity-enter-button" disabled={!activeSignal} onClick={enterDrift} type="button">
            ENTER THE DRIFT
          </button>

          <em>your signal is stored locally. only you carry it.</em>
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
        const label = readElementText(navButton.querySelector('.nav-label')).toLowerCase()
        const nextPage = navLabelToPage[label]
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
  const [landingEntered, setLandingEntered] = useState(false)
  const [introSeen, setIntroSeen] = useState(() => safeStorageGet(introSeenStorageKey) === 'true')
  const [signalIdentity, setSignalIdentity] = useState(() => safeStorageGet(signalIdentityStorageKey) ?? '')

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
    void syncProfile(nextSignalIdentity, signalCore)
  }

  const resetIntroForTesting = () => {
    safeStorageRemove(introSeenStorageKey)
    safeStorageRemove(signalIdentityStorageKey)
    safeStorageRemove(signalProfileStorageKey)
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

  return (
    <>
      <EcosystemLoopBridge />
      {children}
    </>
  )
}
