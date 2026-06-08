import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

type ObservatoryNode = {
  id: string; label: string; role: string; x: number; y: number; signal: number; delay: string
}
type DashboardCard = { label: string; value: string; detail: string; tone: 'mint' | 'cyan' | 'gold' }
type FeedItem = { id: string; source: string; region: string; time: string; title: string; body: string; signal: number; mood: 'Bloom' | 'Drift' | 'Warning'; metrics: string[] }
type DriftNodeData = { id: string; label: string; zone: string; x: number; y: number; intensity: number; delay: string }
type DriftDiscovery = { type: string; title: string; note: string; time: string }
type DriftMetric = { label: string; value: string; detail: string }
type PodCardData = { type: string; title: string; detail: string; time: string }
type VoiceCapsuleData = { title: string; duration: string; feeling: string }
type RelicData = { title: string; subtitle: string; glow: 'cyan' | 'pink' | 'violet' }
type ArchiveRelic = { id: string; name: string; type: string; rarity: 'Common' | 'Rare' | 'Unstable' | 'Mythic' | 'Forbidden' | 'Corrupted'; discovered: string; resonance: number; condition: string; origin: string; description: string }
type FrequencyChannel = { id: string; name: string; type: string; mood: string; strength: number; listeners: string; frequency: string; description: string }
type CapsuleData = { id: string; title: string; type: string; tag: string; duration: string; timestamp: string; source: string; status: 'Saved' | 'Archived' | 'Private' | 'New'; description: string }
type DeadZoneData = { id: string; name: string; type: string; corruption: number; lastDetected: string; condition: string; recovery: number; status: 'Dormant' | 'Corrupted' | 'Silent' | 'Recoverable'; description: string; x: number; y: number }
type ListeningRoomData = { id: string; name: string; type: string; mood: string; listeners: string; strength: number; status: 'Live' | 'Quiet' | 'Tuning' | 'Deep'; description: string }
type AnomalyData = { id: string; name: string; type: string; severity: 'Low' | 'Unstable' | 'Elevated' | 'Critical' | 'Unknown'; detected: string; origin: string; strength: number; distortion: number; description: string }
type SignalAlertData = { id: string; title: string; type: string; source: string; timestamp: string; priority: 'Passive' | 'Active' | 'Elevated' | 'Critical' | 'Unknown'; condition: string; glow: number; description: string }
type MemorySignal = { id: string; label: string; tone: string; x: number; y: number; strength: number }
type UnsentEcho = { id: string; title: string; caption: string; hue: 'cyan' | 'pink' | 'violet' | 'amber'; duration: string }
type SignalRoom = { label: string; type: string; status: string }
type SettingControl = { label: string; detail: string; value: number }
type SettingToggle = { label: string; detail: string; enabled: boolean }

const nodes: ObservatoryNode[] = [
  { id: 'canopy', label: 'Canopy Relay', role: 'growth field', x: 21, y: 28, signal: 91, delay: '12 ms' },
  { id: 'tide', label: 'Tide Memory', role: 'water layer', x: 76, y: 22, signal: 84, delay: '18 ms' },
  { id: 'mineral', label: 'Mineral Loop', role: 'substrate', x: 17, y: 68, signal: 72, delay: '31 ms' },
  { id: 'spore', label: 'Spore Band', role: 'exchange', x: 82, y: 67, signal: 96, delay: '9 ms' },
  { id: 'archive', label: 'Root Archive', role: 'dormant pattern', x: 50, y: 82, signal: 63, delay: '44 ms' },
]
const cards: DashboardCard[] = [
  { label: 'Ecosphere Heartbeat', value: '87%', detail: 'stable resonance', tone: 'mint' },
  { label: 'Signal Bloom', value: '1,248', detail: 'live threads', tone: 'cyan' },
  { label: 'Atmospheric Drift', value: '+14', detail: 'adaptive cycles', tone: 'gold' },
]
const navItems = ['Observatory', 'Signals', 'Drift', 'Dead Zones', 'Rooms', 'Anomalies', 'Frequencies', 'Capsules', 'Relics', 'Soul Pod', 'Settings']
const feedItems: FeedItem[] = [
  { id: 'bloom-01', source: 'Canopy Relay', region: 'upper habitat', time: '2m ago', title: 'New photosynthetic bloom detected', body: 'The canopy mesh is amplifying soft-green growth pulses across three neighboring nodes.', signal: 94, mood: 'Bloom', metrics: ['+18 growth', '4 nodes', 'clean sync'] },
  { id: 'water-02', source: 'Tide Memory', region: 'water layer', time: '8m ago', title: 'Moisture pattern shifted west', body: 'Atmospheric drift is rerouting replenishment flow toward the lower mineral corridor.', signal: 81, mood: 'Drift', metrics: ['12 ms lag', 'stable', 'soft flow'] },
  { id: 'mineral-03', source: 'Mineral Loop', region: 'substrate', time: '14m ago', title: 'Substrate load requires observation', body: 'The root archive is requesting a slower exchange cadence until pressure normalizes.', signal: 68, mood: 'Warning', metrics: ['watch', '31 ms', '2 loops'] },
]
const driftNodes: DriftNodeData[] = [
  { id: 'dead-zone', label: 'Dead Zones', zone: 'absent carrier', x: 18, y: 34, intensity: 42, delay: 'slow' },
  { id: 'echo-fields', label: 'Echo Fields', zone: 'returning memory', x: 72, y: 24, intensity: 77, delay: 'soft' },
  { id: 'quiet-frequencies', label: 'Quiet Frequencies', zone: 'low emotional band', x: 44, y: 58, intensity: 61, delay: 'thin' },
  { id: 'static-bloom', label: 'Static Bloom', zone: 'pink noise growth', x: 80, y: 68, intensity: 88, delay: 'alive' },
  { id: 'lost-orbit', label: 'Lost Orbit', zone: 'unclaimed signal', x: 27, y: 78, intensity: 54, delay: 'far' },
]
const driftDiscoveries: DriftDiscovery[] = [
  { type: 'Drift Discovery', title: 'A soft pulse is repeating under the fog', note: 'It feels old, almost personal, but the signal refuses a source.', time: '03:12' },
  { type: 'Signal Anomaly', title: 'Static Bloom opened near the eastern band', note: 'Cyan traces are bending around a warm pink interference field.', time: '03:18' },
  { type: 'Emotional Pulse', title: 'Lonely resonance detected in Quiet Frequencies', note: 'The ecosystem lowered its tempo and held the channel open.', time: '03:24' },
]
const driftMetrics: DriftMetric[] = [
  { label: 'Drift intensity', value: '72%', detail: 'deep ambient movement' },
  { label: 'Signal weather', value: 'Fog / Echo', detail: 'cyan haze with pink scatter' },
  { label: 'Unknown zones', value: '8', detail: 'three are emotionally active' },
]
const podCards: PodCardData[] = [
  { type: 'Saved Echo', title: 'Late Night Signal', detail: 'A soft thought preserved from the quiet hours.', time: '01:42' },
  { type: 'Memory Fragment', title: 'Static Bloom Memory', detail: 'Pink noise wrapped around an old feeling.', time: 'archived' },
  { type: 'Private Note', title: 'Quiet Frequency', detail: 'A small reminder to move gently today.', time: 'private' },
]
const voiceCapsules: VoiceCapsuleData[] = [
  { title: 'Recovered Echo', duration: '0:48', feeling: 'warm static' },
  { title: 'Pulse Fragment', duration: '1:12', feeling: 'low violet' },
  { title: 'Archived Feeling', duration: '0:33', feeling: 'soft blue' },
]
const relics: RelicData[] = [
  { title: 'Static Bloom', subtitle: 'relic / emotional signal', glow: 'pink' },
  { title: 'Quiet Frequency', subtitle: 'relic / saved echo', glow: 'cyan' },
  { title: 'Pulse Thread', subtitle: 'relic / memory trace', glow: 'violet' },
]
const archiveRelics: ArchiveRelic[] = [
  { id: 'echo-veil', name: 'Echo Veil', type: 'Echo Fragment', rarity: 'Mythic', discovered: '03:44 / deep archive', resonance: 94, condition: 'stable glow', origin: 'Echo Fields', description: 'A translucent memory layer that hums when other signals pass near it.' },
  { id: 'pulse-crystal', name: 'Pulse Crystal VII', type: 'Pulse Crystal', rarity: 'Rare', discovered: '01:18 / canopy vault', resonance: 82, condition: 'bright pulse', origin: 'Canopy Relay', description: 'A crystalline heartbeat recovered from a living branch of the ecosystem.' },
  { id: 'lost-carrier', name: 'Lost Carrier', type: 'Lost Transmission', rarity: 'Forbidden', discovered: '00:07 / dead zone', resonance: 67, condition: 'sealed', origin: 'Dead Zones', description: 'A sealed transmission that repeats a name the archive no longer recognizes.' },
  { id: 'static-bloom', name: 'Static Bloom', type: 'Static Bloom', rarity: 'Unstable', discovered: '02:31 / drift corridor', resonance: 89, condition: 'flickering', origin: 'Static Bloom', description: 'Pink interference folded into a rare flower-shaped signal artifact.' },
  { id: 'memory-shard', name: 'Violet Memory Shard', type: 'Memory Shard', rarity: 'Corrupted', discovered: '04:12 / root archive', resonance: 58, condition: 'fractured', origin: 'Root Archive', description: 'A broken emotional index with a soft violet afterimage.' },
  { id: 'signal-core', name: 'Small Signal Core', type: 'Signal Core', rarity: 'Common', discovered: '00:42 / observatory', resonance: 73, condition: 'clean', origin: 'Observatory', description: 'A quiet core used to stabilize newly discovered archive objects.' },
]
const archiveTimeline = ['Memory Shard recovered from Quiet Frequencies','Pulse Crystal moved into protected chamber','Static Bloom classified as unstable','Lost Transmission sealed for later review']
const frequencyChannels: FrequencyChannel[] = [
  { id: 'calm', name: 'Calm Frequency', type: 'Calm Frequency', mood: 'soft focus', strength: 88, listeners: '1.8k', frequency: '72.4 Hz', description: 'A low luminous channel for quiet emotional recalibration.' },
  { id: 'late-night', name: 'Late Night Signal', type: 'Late Night Signal', mood: 'nocturne', strength: 94, listeners: '842', frequency: '88.1 Hz', description: 'A warm violet broadcast carrying after-hours reflections.' },
  { id: 'static-bloom', name: 'Static Bloom', type: 'Static Bloom', mood: 'charged', strength: 79, listeners: '517', frequency: '101.6 Hz', description: 'A crackling bloom of restless signal energy.' },
  { id: 'deep-focus', name: 'Deep Focus', type: 'Deep Focus', mood: 'clear', strength: 91, listeners: '2.2k', frequency: '64.8 Hz', description: 'Steady resonance for long immersion and inward attention.' },
  { id: 'emotional-drift', name: 'Emotional Drift', type: 'Emotional Drift', mood: 'wandering', strength: 83, listeners: '1.1k', frequency: '93.7 Hz', description: 'Slow moving tones from the edges of the ecosystem.' },
  { id: 'memory-wave', name: 'Memory Wave', type: 'Memory Wave', mood: 'nostalgic', strength: 86, listeners: '703', frequency: '77.9 Hz', description: 'A soft wave of archived feeling and returning light.' },
]
const capsules: CapsuleData[] = [
  { id: 'late-night', title: 'Late Night Signal', type: 'Voice Capsule', tag: 'nocturne', duration: '0:42', timestamp: 'saved 12 min ago', source: 'Signal Stream', status: 'Saved', description: 'A soft voice fragment preserved from a midnight broadcast.' },
  { id: 'archived-feeling', title: 'Archived Feeling', type: 'Memory Capsule', tag: 'warm static', duration: '1:08', timestamp: 'yesterday', source: 'Soul Pod', status: 'Archived', description: 'A recovered emotional note wrapped in amber resonance.' },
  { id: 'private-transmission', title: 'Private Transmission', type: 'Echo Capsule', tag: 'quiet', duration: '0:36', timestamp: '2 days ago', source: 'Drift', status: 'Private', description: 'A hidden message that only opens inside the pod chamber.' },
  { id: 'lost-audio', title: 'Lost Audio Fragment', type: 'Drift Recording', tag: 'distant', duration: '0:55', timestamp: '3 days ago', source: 'Dead Zone', status: 'Archived', description: 'A beautiful broken signal from the abandoned edge.' },
]
const deadZones: DeadZoneData[] = [
  { id: 'faded-orbit', name: 'Faded Orbit', type: 'Lost Signal', corruption: 62, lastDetected: '04:17 / last cycle', condition: 'dim carrier', recovery: 41, status: 'Dormant', description: 'A quiet orbit where old transmissions slowly lose their shape.', x: 22, y: 34 },
  { id: 'blackout-memory', name: 'Blackout Memory', type: 'Memory Blackout', corruption: 81, lastDetected: 'unknown', condition: 'fragmented', recovery: 18, status: 'Corrupted', description: 'A sealed memory zone with intermittent emotional echoes.', x: 68, y: 28 },
  { id: 'static-field', name: 'Static Field 09', type: 'Static Field', corruption: 54, lastDetected: '22:08 / yesterday', condition: 'recoverable', recovery: 63, status: 'Recoverable', description: 'A field of soft interference hiding several weak signals.', x: 42, y: 62 },
  { id: 'silent-orbit', name: 'Silent Orbit', type: 'Abandoned Node', corruption: 39, lastDetected: '3 days ago', condition: 'quiet', recovery: 72, status: 'Silent', description: 'An abandoned node still carrying a faint cyan pulse.', x: 78, y: 68 },
]
const listeningRooms: ListeningRoomData[] = [
  { id: 'late-night', name: 'Late Night Room', type: 'Late Night Room', mood: 'nocturne', listeners: '128', strength: 94, status: 'Live', description: 'A warm after-hours chamber for low voices and soft signals.' },
  { id: 'calm-frequency', name: 'Calm Frequency Room', type: 'Calm Frequency Room', mood: 'soft focus', listeners: '246', strength: 88, status: 'Live', description: 'A steady room with quiet waveforms and gentle resonance.' },
  { id: 'static-bloom', name: 'Static Bloom Room', type: 'Static Bloom Room', mood: 'charged', listeners: '71', strength: 79, status: 'Tuning', description: 'A flickering chamber where restless signals become light.' },
  { id: 'memory-room', name: 'Memory Room', type: 'Memory Room', mood: 'nostalgic', listeners: '93', strength: 84, status: 'Quiet', description: 'A slow archive room filled with softened echo fragments.' },
]
const anomalies: AnomalyData[] = [
  { id: 'pulse-spike', name: 'Pulse Spike', type: 'Pulse Spike', severity: 'Critical', detected: 'now', origin: 'Pulse Rift', strength: 97, distortion: 74, description: 'A sudden resonance surge fractured the local signal layer.' },
  { id: 'unknown-transmission', name: 'Unknown Transmission', type: 'Unknown Transmission', severity: 'Unknown', detected: '03 min ago', origin: 'Lost Orbit', strength: 82, distortion: 61, description: 'An unidentified carrier is repeating beneath the observatory floor.' },
  { id: 'memory-flicker', name: 'Memory Flicker', type: 'Memory Flicker', severity: 'Elevated', detected: '11 min ago', origin: 'Memory Currents', strength: 69, distortion: 45, description: 'Recovered memories are blinking in and out of stable phase.' },
  { id: 'dead-zone-movement', name: 'Dead Zone Movement', type: 'Dead Zone Movement', severity: 'Unstable', detected: '26 min ago', origin: 'Faded Orbit', strength: 58, distortion: 52, description: 'A dormant zone drifted outside its mapped boundary.' },
  { id: 'echo-loop', name: 'Echo Loop', type: 'Echo Loop', severity: 'Low', detected: '44 min ago', origin: 'Echo Fields', strength: 44, distortion: 31, description: 'A repeating echo pattern softened into a low-priority cycle.' },
]
const signalAlerts: SignalAlertData[] = [
  { id: 'observatory-alert', title: 'Observatory Alert', type: 'Observatory Alert', source: 'Core Scanner', timestamp: 'now', priority: 'Elevated', condition: 'pulse variance', glow: 88, description: 'A new signal corridor is forming near the Drift edge.' },
  { id: 'relic-discovered', title: 'Relic Discovered', type: 'Relic Discovered', source: 'Archive Vault', timestamp: '04 min ago', priority: 'Active', condition: 'mythic trace', glow: 74, description: 'A protected artifact is emitting warm resonance from chamber two.' },
  { id: 'unknown-transmission', title: 'Unknown Transmission', type: 'Unknown Transmission', source: 'Dead Zones', timestamp: '11 min ago', priority: 'Unknown', condition: 'unclassified carrier', glow: 91, description: 'The ecosystem detected a repeating phrase beneath static fog.' },
  { id: 'capsule-opened', title: 'Capsule Opened', type: 'Capsule Opened', source: 'Soul Pod', timestamp: '32 min ago', priority: 'Passive', condition: 'memory stable', glow: 52, description: 'A saved voice capsule was previewed inside the private chamber.' },
]
const memorySignals: MemorySignal[] = [
  { id: 'late-night', label: 'late night signal', tone: 'nocturne', x: 18, y: 48, strength: 94 },
  { id: 'glass-tide', label: 'glass tide chamber', tone: 'oceanic', x: 43, y: 28, strength: 82 },
  { id: 'static-bloom', label: 'static bloom memory', tone: 'charged', x: 68, y: 54, strength: 76 },
  { id: 'quiet-orbit', label: 'quiet orbit', tone: 'soft', x: 81, y: 33, strength: 69 },
  { id: 'blackwater', label: 'blackwater pulse', tone: 'distant', x: 35, y: 72, strength: 88 },
]
const unsentEchoes: UnsentEcho[] = [
  { id: 'late-night', title: 'i almost said it', caption: 'a voice that stopped before it arrived', hue: 'pink', duration: '0:28' },
  { id: 'glass-tide', title: 'voice under the tide', caption: 'soft interference, still drifting', hue: 'cyan', duration: '0:41' },
  { id: 'static-bloom', title: 'the bloom came back', caption: 'warm signal, nowhere to land', hue: 'violet', duration: '0:19' },
]
const signalRooms: SignalRoom[] = [
  { label: 'Soul Pod', type: 'identity chamber', status: 'submerged' },
  { label: 'Signal Bloom', type: 'growth field', status: 'forming' },
  { label: 'Hidden Frequency', type: 'resonance room', status: 'faint carrier' },
  { label: 'Pairing Room', type: 'echo alignment', status: 'quietly awake' },
]
const settingControls: SettingControl[] = [
  { label: 'Glow Intensity', detail: 'Ambient bloom and neon edge strength', value: 78 },
  { label: 'Motion Level', detail: 'Environmental drift and pulse animation', value: 52 },
  { label: 'Audio Atmosphere', detail: 'Mock spatial ambience and room hum', value: 64 },
  { label: 'Drift Sensitivity', detail: 'How strongly unknown zones surface', value: 71 },
  { label: 'Resonance Level', detail: 'Personal signal amplification', value: 86 },
]
const settingToggles: SettingToggle[] = [
  { label: 'Signal Visibility', detail: 'Show your active energy in ecosystem rooms', enabled: true },
  { label: 'Privacy Mode', detail: 'Keep capsules, relics, and echoes quiet by default', enabled: true },
  { label: 'Priority Notifications', detail: 'Surface only important observatory transmissions', enabled: false },
  { label: 'Soft Scan Lines', detail: 'Keep subtle observatory overlays active', enabled: true },
]
function App() {
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0].id)
  const [activeNav, setActiveNav] = useState(navItems[0])
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0],[selectedNodeId])
  return (
    <main className="observatory-shell">
      <div className="atmosphere">
        <div className="video-wash" /><div className="aurora aurora-one" /><div className="aurora aurora-two" /><div className="star-grid" /><div className="scanline" />
      </div>
      <section className="observatory">
        <header className="topbar">
          <div><p className="kicker">Genesis Ecosphere</p><h1>{activeNav === 'Signals' ? 'Signals' : activeNav}</h1></div>
          <div className="live-chip"><span />Live signal</div>
        </header>
        {activeNav === 'Signals' ? <FeedPage /> : activeNav === 'Drift' ? <DriftPage /> : activeNav === 'Dead Zones' ? <DeadZonesPage /> : activeNav === 'Rooms' ? <ListeningRoomsPage /> : activeNav === 'Anomalies' ? <AnomaliesPage /> : activeNav === 'Frequencies' ? <FrequenciesPage /> : activeNav === 'Capsules' ? <CapsulesPage /> : activeNav === 'Relics' ? <RelicsPage /> : activeNav === 'Soul Pod' ? <SoulPodPage /> : activeNav === 'Settings' ? <SettingsPage /> : (
          <>
            <section className="hero-stage" aria-label="Observatory signal field">
              <div className="hero-copy">
                <p>sentient ecology interface</p>
                <h2>Watch the ecosystem breathe.</h2>
                <span>A cinematic command surface for living signals, habitat memory, and emergent balance.</span>
              </div>
              <div className="orb-wrap" aria-hidden="true">
                <div className="orbit orbit-wide" /><div className="orbit orbit-tight" />
                <div className="signal-orb"><div className="orb-core" /><div className="orb-ring" /></div>
              </div>
              <svg className="signal-web" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {nodes.map((node) => (<line key={node.id} x1="50" y1="50" x2={node.x} y2={node.y} />))}
              </svg>
              {nodes.map((node) => (
                <button className={`floating-node ${selectedNode.id === node.id ? 'selected' : ''}`} key={node.id} onClick={() => setSelectedNodeId(node.id)} style={{ left: `${node.x}%`, top: `${node.y}%`, '--signal': node.signal / 100 } as CSSProperties} type="button">
                  <span className="node-dot" /><span className="node-text"><strong>{node.label}</strong><small>{node.role}</small></span>
                </button>
              ))}
              <aside className="node-inspector">
                <span>selected node</span><strong>{selectedNode.label}</strong><p>{selectedNode.role}</p>
                <div><b>{selectedNode.signal}%</b><small>signal</small></div>
                <div><b>{selectedNode.delay}</b><small>delay</small></div>
              </aside>
            </section>
            <section className="dashboard-cards" aria-label="Observatory dashboard">
              {cards.map((card) => (
                <button className={`dash-card ${card.tone}`} key={card.label} type="button">
                  <span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small>
                </button>
              ))}
            </section>
          </>
        )}
        <nav className="bottom-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button className={activeNav === item ? 'active' : ''} key={item} onClick={() => setActiveNav(item)} type="button">
              <span />{item}
            </button>
          ))}
        </nav>
      </section>
    </main>
  )
}

function FeedPage() {
  return (
    <section className="feed-page" aria-label="Signals feed">
      <div className="feed-hero">
        <div><p className="feed-kicker">live ecosystem stream</p><h2>Signal feed</h2><span>Mock updates from the habitat mesh, sorted by newest activity.</span></div>
        <button className="compose-signal" type="button">New pulse</button>
      </div>
      <div className="feed-filters" aria-label="Feed filters">
        {['All', 'Blooms', 'Drift', 'Warnings'].map((filter) => (<button className={filter === 'All' ? 'active' : ''} key={filter} type="button">{filter}</button>))}
      </div>
      <SignalMemoryMap /><UnsentEchoStrip /><SignalRoomStrip />
      <div className="feed-layout">
        <section className="feed-stack">
          {feedItems.map((item) => (
            <article className={`feed-card mood-${item.mood.toLowerCase()}`} key={item.id}>
              <header>
                <div className="feed-avatar"><span /></div>
                <div><strong>{item.source}</strong><small>{item.region} · {item.time}</small></div>
                <b>{item.mood}</b>
              </header>
              <h3>{item.title}</h3><p>{item.body}</p>
              <div className="signal-strip" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <footer><strong>{item.signal}% resonance</strong><div>{item.metrics.map((metric) => (<span key={metric}>{metric}</span>))}</div></footer>
            </article>
          ))}
        </section>
        <aside className="feed-panel">
          <span>today's ecology</span><strong>3 active stories</strong>
          <p>Canopy bloom is leading the signal field while mineral load stays under watch.</p>
          <div className="mini-orb" />
        </aside>
      </div>
      <SignalAlertsCenter />
    </section>
  )
}

function SignalMemoryMap() {
  return (
    <section className="signal-memory-map" aria-label="Waveform Memory Map">
      <div className="memory-map-copy">
        <span>WAVEFORM MEMORY MAP</span>
        <h3>Audio-only signals drifting through the observatory.</h3>
        <p>Tap a constellation node to tune your attention toward an echo chain.</p>
      </div>
      <svg className="memory-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M18 35 C31 20, 52 18, 67 24 S84 47, 78 70 S48 88, 28 76" />
        <path d="M44 58 C52 42, 59 33, 67 24" />
        <path d="M18 35 C27 52, 33 67, 44 58 S65 58, 78 70" />
      </svg>
      <div className="memory-map-orbit" aria-hidden="true" />
      {memorySignals.map((signal) => (
        <button className="memory-node" id={`fragment-${signal.id}`} key={signal.id} style={{ left: `${signal.x}%`, top: `${signal.y}%`, '--memory-strength': signal.strength / 100 } as CSSProperties} type="button">
          <i /><span><strong>{signal.label}</strong><small>{signal.tone}</small></span>
        </button>
      ))}
    </section>
  )
}

function UnsentEchoStrip() {
  return (
    <section className="unsent-echo-strip" aria-label="The Unsent Room">
      <header><span>THE UNSENT ROOM</span><p>anonymous echoes / never delivered / softly preserved</p></header>
      <div>
        {unsentEchoes.map((echo) => (
          <article className={`unsent-echo-card hue-${echo.hue}`} key={echo.id}>
            <button type="button" aria-label={`Preview ${echo.title}`}><i /></button>
            <div><span>{echo.duration}</span><h3>{echo.title}</h3><p>{echo.caption}</p><Waveform bars={6} /></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function SignalRoomStrip() {
  return (
    <section className="signal-room-strip" aria-label="Signal rooms">
      <header><span>SIGNAL ROOMS</span><p>small chambers from the broader ecosystem, surfaced inside the stream</p></header>
      <div>
        {signalRooms.map((room) => (
          <button key={room.label} type="button"><i /><strong>{room.label}</strong><span>{room.type}</span><small>{room.status}</small></button>
        ))}
      </div>
    </section>
  )
}

function SignalAlertsCenter() {
  const priorityAlerts = signalAlerts.filter((alert) => ['Critical', 'Elevated', 'Unknown'].includes(alert.priority))
  return (
    <section className="signal-alerts" aria-label="Signal Alerts notification center">
      <div className="alerts-ambient" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} style={{ left: `${(index * 21 + 9) % 100}%`, top: `${(index * 17 + 16) % 100}%`, '--alert-delay': `${index * 180}ms` } as CSSProperties} />
        ))}
      </div>
      <header className="alerts-header">
        <div><p className="alerts-kicker">observatory transmissions</p><h2>The ecosystem is speaking.</h2><span>Signals, discoveries, broadcasts, and emotional events arrive as living transmissions.</span></div>
        <SystemStatusPanel />
      </header>
      <section className="alert-filters" aria-label="Alert Filters">
        {['All Signals', 'Priority', 'Drift', 'Relics', 'Capsules', 'Unknown'].map((filter) => (
          <button className={filter === 'All Signals' ? 'active' : ''} key={filter} type="button">{filter}</button>
        ))}
      </section>
      <section className="alerts-layout">
        <div className="alerts-main">
          <section className="priority-alerts" aria-label="Priority Alerts">{priorityAlerts.map((alert) => (<SignalAlertCard alert={alert} featured key={alert.id} />))}</section>
          <section className="observatory-feed" aria-label="Observatory Feed">{signalAlerts.map((alert) => (<SignalAlertCard alert={alert} key={alert.id} />))}</section>
        </div>
        <aside className="signal-intelligence" aria-label="Signal Intelligence">
          <section><span>signal intelligence</span><strong>6 transmissions</strong><p>Two alerts need observatory attention. One unknown carrier is still unresolved.</p></section>
          <section><span>recent ecosystem activity</span>{['Relic archive updated', 'Capsule vault opened', 'Listening room active'].map((item) => (<button key={item} type="button">{item}</button>))}</section>
        </aside>
      </section>
    </section>
  )
}

function SignalAlertCard({ alert, featured = false }: { alert: SignalAlertData; featured?: boolean }) {
  return (
    <article className={`signal-alert-card priority-${alert.priority.toLowerCase()} ${featured ? 'featured' : ''}`}>
      <header><LivePulseIndicator /><PriorityBadge priority={alert.priority} /></header>
      <span>{alert.type}</span><h3>{alert.title}</h3><p>{alert.description}</p>
      <dl>
        <div><dt>Source</dt><dd>{alert.source}</dd></div>
        <div><dt>Time</dt><dd>{alert.timestamp}</dd></div>
        <div><dt>Condition</dt><dd>{alert.condition}</dd></div>
      </dl>
      <GlowIntensityMeter value={alert.glow} />
      <button type="button">Open transmission</button>
    </article>
  )
}

function PriorityBadge({ priority }: { priority: SignalAlertData['priority'] }) {
  return <b className={`priority-badge priority-${priority.toLowerCase()}`}>{priority}</b>
}
function LivePulseIndicator() { return <i className="live-pulse-indicator" aria-hidden="true" /> }
function GlowIntensityMeter({ value }: { value: number }) {
  return (<div className="glow-intensity-meter" aria-label="Glow intensity"><div><span>glow intensity</span><strong>{value}%</strong></div><i><b style={{ width: `${value}%` }} /></i></div>)
}
function SystemStatusPanel() {
  return (<aside className="system-status-panel" aria-label="System Status"><span>system status</span><strong>awake</strong><small>live scan / soft priority</small></aside>)
}
function DriftPage() {
  return (
    <section className="drift-page" aria-label="Drift exploration space">
      <AtmosphericDriftLayer />
      <header className="drift-header">
        <div><p className="drift-kicker">abandoned digital frequencies</p><h2>Explore the living atmosphere.</h2><span>Move through quiet unknown zones and listen for hidden emotional signals.</span></div>
        <SignalPulse label="observatory scan" />
      </header>
      <section className="drift-map" aria-label="Large floating signal map area">
        <div className="scan-overlay" />
        <svg className="drift-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M18 34 C31 18, 54 18, 72 24 S87 47, 80 68 S48 92, 27 78" />
          <path d="M44 58 C53 45, 62 39, 72 24" />
          <path d="M18 34 C24 51, 31 65, 44 58 S65 59, 80 68" />
        </svg>
        {driftNodes.map((node) => (<DriftNode key={node.id} node={node} />))}
        <aside className="drift-status"><span>atmospheric status</span><strong>quiet but alive</strong><p>Signal Fog and Memory Currents are moving beneath the scan layer.</p></aside>
      </section>
      <section className="drift-zones" aria-label="Active Drift Zones">
        {['Dead Zones','Echo Fields','Quiet Frequencies','Static Bloom','Pulse Rift','Memory Currents','Signal Fog','Lost Orbit'].map((zone) => (<button key={zone} type="button">{zone}</button>))}
      </section>
      <section className="drift-lower-grid">
        <div className="discovery-feed" aria-label="Discovery Feed">
          {driftDiscoveries.map((item) => (<article key={item.title}><span>{item.type}</span><h3>{item.title}</h3><p>{item.note}</p><small>{item.time}</small></article>))}
        </div>
        <aside className="drift-metrics" aria-label="Atmospheric Metrics">
          {driftMetrics.map((metric) => (<DriftMetricCard key={metric.label} metric={metric} />))}
        </aside>
      </section>
    </section>
  )
}
function AtmosphericDriftLayer() {
  return (<div className="drift-atmosphere" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => (<span key={index} style={{ left: `${(index * 17 + 9) % 100}%`, top: `${(index * 23 + 12) % 100}%`, '--drift-delay': `${index * 180}ms` } as CSSProperties} />))}</div>)
}
function SignalPulse({ label }: { label: string }) { return (<div className="signal-pulse"><i /><span>{label}</span></div>) }
function DriftNode({ node }: { node: DriftNodeData }) {
  return (<button className="drift-node" style={{ left: `${node.x}%`, top: `${node.y}%`, '--node-intensity': node.intensity / 100 } as CSSProperties} type="button"><span className="drift-node-core" /><span className="drift-node-card"><strong>{node.label}</strong><small>{node.zone}</small><b>{node.intensity}% · {node.delay}</b></span></button>)
}
function DriftMetricCard({ metric }: { metric: DriftMetric }) {
  return (<article className="drift-metric-card"><span>{metric.label}</span><strong>{metric.value}</strong><p>{metric.detail}</p></article>)
}

function DeadZonesPage() {
  const featuredZone = deadZones[0]
  return (
    <section className="dead-page" aria-label="Dead Zones forbidden signal edge">
      <div className="dead-ambient" aria-hidden="true">{Array.from({ length: 13 }, (_, index) => (<span key={index} style={{ left: `${(index * 17 + 10) % 100}%`, top: `${(index * 31 + 8) % 100}%`, '--dead-delay': `${index * 210}ms` } as CSSProperties} />))}</div>
      <header className="dead-header">
        <div><p className="dead-kicker">forbidden signal map</p><h2>Enter the abandoned edge.</h2><span>Lost frequencies, corrupted transmissions, and silent emotional spaces wait under the scan fog.</span></div>
        <SignalRecoveryMeter value={featuredZone.recovery} label="signal recovery" />
      </header>
      <section className="dead-map" aria-label="Corrupted Signal Map">
        <div className="dead-scan" /><StaticInterference />
        <svg className="dead-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M22 32 C32 15, 58 16, 72 24 S89 51, 80 69 S50 90, 29 79" />
          <path d="M22 32 C25 48, 34 62, 44 58 S64 56, 80 69" />
          <path d="M44 58 C50 39, 61 29, 72 24" />
        </svg>
        {deadZones.map((zone) => (<button className={`dead-node status-${zone.status.toLowerCase()}`} key={zone.id} style={{ left: `${zone.x}%`, top: `${zone.y}%`, '--corruption': zone.corruption / 100 } as CSSProperties} type="button"><span /><strong>{zone.name}</strong></button>))}
        <aside className="dead-scan-panel"><span>observatory scan panel</span><strong>5 unstable zones</strong><p>Static interference is thin enough for rediscovery attempts, but Blackout Relay remains volatile.</p><button type="button">Begin soft scan</button></aside>
      </section>
      <section className="dead-filters" aria-label="Dead Zone Types">
        {['Lost Signal','Corrupted Frequency','Abandoned Node','Static Field','Silent Orbit','Broken Echo'].map((type) => (<button className={type === 'Lost Signal' ? 'active' : ''} key={type} type="button">{type}</button>))}
      </section>
      <section className="dead-layout">
        <div className="dead-grid" aria-label="Lost Frequencies">{deadZones.map((zone) => (<DeadZoneCard key={zone.id} zone={zone} />))}</div>
        <aside className="dead-side">
          <section className="dead-panel recovery-dashboard" aria-label="Recovery Dashboard"><span>recovery dashboard</span><strong>quiet window open</strong><p>Rediscovery chance is highest near Faded Capsule and weakest at the sealed transmission edge.</p><button type="button">Rediscover signals</button></section>
          <section className="dead-panel abandoned-list" aria-label="Abandoned Nodes"><span>abandoned nodes</span>{deadZones.slice(0, 4).map((zone) => (<p key={zone.id}>{zone.name} / {zone.condition}</p>))}</section>
          <section className="dead-panel hidden-transmissions" aria-label="Hidden Transmissions"><span>hidden transmissions</span>{['A voice cut short in violet noise.','A capsule pinging from below static.','A name repeating without source.'].map((t) => (<p key={t}>{t}</p>))}</section>
        </aside>
      </section>
    </section>
  )
}
function DeadZoneCard({ zone }: { zone: DeadZoneData }) {
  return (<article className={`dead-card status-${zone.status.toLowerCase()}`}><header><DeadZoneBadge status={zone.status} /><span>{zone.type}</span></header><h3>{zone.name}</h3><p>{zone.description}</p><dl><div><dt>Corruption</dt><dd>{zone.corruption}%</dd></div><div><dt>Last detected</dt><dd>{zone.lastDetected}</dd></div><div><dt>Condition</dt><dd>{zone.condition}</dd></div></dl><SignalRecoveryMeter value={zone.recovery} label="recovery chance" /><button type="button">Mock scan</button></article>)
}
function DeadZoneBadge({ status }: { status: DeadZoneData['status'] }) { return <b className={`dead-badge badge-${status.toLowerCase()}`}>{status}</b> }
function SignalRecoveryMeter({ value, label }: { value: number; label: string }) {
  return (<div className="dead-recovery-meter" aria-label={label}><div><span>{label}</span><strong>{value}%</strong></div><i><b style={{ width: `${value}%` }} /></i></div>)
}
function StaticInterference() {
  return (<div className="static-interference" aria-label="Static interference visual">{Array.from({ length: 18 }, (_, index) => (<i key={index} style={{ '--static-delay': `${index * 70}ms` } as CSSProperties} />))}</div>)
}

function ListeningRoomsPage() {
  const featuredRoom = listeningRooms[0]
  return (
    <section className="rooms-page" aria-label="Listening Rooms">
      <div className="rooms-ambient" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => (<span key={index} style={{ left: `${(index * 19 + 7) % 100}%`, top: `${(index * 23 + 12) % 100}%`, '--room-delay': `${index * 170}ms` } as CSSProperties} />))}</div>
      <header className="rooms-header">
        <div><p className="rooms-kicker">live emotional spaces</p><h2>Choose a sound world to enter.</h2><span>Step into signal chambers shaped by mood, frequency, energy, and quiet social presence.</span></div>
        <RoomSignalMeter value={featuredRoom.strength} />
      </header>
      <FeaturedListeningRoom room={featuredRoom} />
      <section className="room-categories" aria-label="Room Categories">
        {['All Rooms','Late Night','Calm','Focus','Drift','Memory','Lost'].map((category) => (<button className={category === 'All Rooms' ? 'active' : ''} key={category} type="button">{category}</button>))}
      </section>
      <section className="rooms-layout">
        <div className="room-grid" aria-label="Active Rooms">{listeningRooms.map((room) => (<ListeningRoomCard active={room.id === featuredRoom.id} key={room.id} room={room} />))}</div>
        <aside className="rooms-side"><RoomList title="recently active" items={['Echo Chamber','Memory Room','Pulse Room']} /><RoomList title="recommended rooms" items={['Calm Frequency Room','Static Bloom Room','Lost Transmission Room']} /></aside>
      </section>
    </section>
  )
}
function FeaturedListeningRoom({ room }: { room: ListeningRoomData }) {
  return (<section className="featured-room" aria-label="Featured active room"><div className="room-orb" aria-hidden="true"><i /></div><article className="featured-room-copy"><RoomStatusBadge status={room.status} /><h3>{room.name}</h3><p>{room.description}</p><Waveform bars={10} /><button type="button">Enter Room</button></article><aside className="room-live-panel"><span>live listeners</span><strong>{room.listeners}</strong><small>{room.mood} · {room.strength}% signal</small></aside></section>)
}
function ListeningRoomCard({ room, active }: { room: ListeningRoomData; active: boolean }) {
  return (<article className={`room-card ${active ? 'active' : ''}`}><header><div className="room-live-dot" aria-hidden="true" /><RoomStatusBadge status={room.status} /></header><span>{room.type}</span><h3>{room.name}</h3><p>{room.description}</p><Waveform bars={7} /><footer><b>{room.mood}</b><small>{room.listeners} listening · {room.strength}% signal</small></footer><button type="button">Enter Room</button></article>)
}
function RoomStatusBadge({ status }: { status: ListeningRoomData['status'] }) { return <b className={`room-status status-${status.toLowerCase()}`}>{status}</b> }
function RoomSignalMeter({ value }: { value: number }) { return (<div className="room-signal-meter" aria-label="Room signal strength"><span>featured signal</span><strong>{value}%</strong><i><b style={{ width: `${value}%` }} /></i></div>) }
function RoomList({ title, items }: { title: string; items: string[] }) { return (<section className="room-list"><span>{title}</span>{items.map((item) => (<button key={item} type="button">{item}</button>))}</section>) }
function AnomaliesPage() {
  const activeAnomaly = anomalies[0]
  return (
    <section className="anomalies-page" aria-label="Anomalies monitoring space">
      <div className="anomaly-ambient" aria-hidden="true">{Array.from({ length: 15 }, (_, index) => (<span key={index} style={{ left: `${(index * 23 + 8) % 100}%`, top: `${(index * 17 + 14) % 100}%`, '--anomaly-delay': `${index * 190}ms` } as CSSProperties} />))}</div>
      <header className="anomalies-header">
        <div><p className="anomalies-kicker">signal intelligence center</p><h2>The ecosystem detected something strange.</h2><span>Rare frequencies, unusual behavior, and unknown patterns surface inside the observatory scanner.</span></div>
        <DistortionMeter value={activeAnomaly.distortion} label="signal distortion" />
      </header>
      <section className="active-scanner" aria-label="Active Scanner">
        <RadarScanner anomaly={activeAnomaly} />
        <article className="scanner-brief"><SeverityBadge severity={activeAnomaly.severity} /><h3>{activeAnomaly.name}</h3><p>{activeAnomaly.description}</p><button type="button">Inspect anomaly</button></article>
        <aside className="observatory-alert"><span>observatory alert panel</span><strong>{activeAnomaly.origin}</strong><small>{activeAnomaly.detected} · {activeAnomaly.strength}% strength</small></aside>
      </section>
      <section className="anomaly-layout">
        <div className="anomaly-grid" aria-label="Recent Anomalies">{anomalies.map((anomaly) => (<AnomalyCard anomaly={anomaly} key={anomaly.id} />))}</div>
        <aside className="anomaly-side">
          <section className="investigation-panel" aria-label="Investigation Queue"><span>investigation queue</span>{['Trace unknown carrier','Compare dead-zone movement','Stabilize static bloom'].map((item) => (<button key={item} type="button">{item}</button>))}</section>
          <section className="anomaly-timeline" aria-label="Observatory Timeline"><span>observatory timeline</span>{anomalies.slice(0, 4).map((anomaly) => (<p key={anomaly.id}>{anomaly.detected} / {anomaly.type}</p>))}</section>
        </aside>
      </section>
    </section>
  )
}
function RadarScanner({ anomaly }: { anomaly: AnomalyData }) {
  return (<div className="radar-scanner" aria-label="Detection Radar"><div className="radar-ring radar-ring-one" /><div className="radar-ring radar-ring-two" /><div className="radar-sweep" /><div className="radar-core"><span>{anomaly.severity}</span><strong>{anomaly.distortion}%</strong></div>{Array.from({ length: 4 }, (_, index) => (<i key={index} style={{ '--radar-x': `${(index * 29 + 18) % 82}%`, '--radar-y': `${(index * 37 + 20) % 78}%`, '--radar-delay': `${index * 260}ms` } as CSSProperties} />))}</div>)
}
function AnomalyCard({ anomaly }: { anomaly: AnomalyData }) {
  return (<article className={`anomaly-card severity-${anomaly.severity.toLowerCase()}`}><header><SeverityBadge severity={anomaly.severity} /><span>{anomaly.type}</span></header><h3>{anomaly.name}</h3><p>{anomaly.description}</p><dl><div><dt>Detected</dt><dd>{anomaly.detected}</dd></div><div><dt>Origin</dt><dd>{anomaly.origin}</dd></div><div><dt>Strength</dt><dd>{anomaly.strength}%</dd></div></dl><DistortionMeter value={anomaly.distortion} label="distortion" /><button type="button">Scan event</button></article>)
}
function SeverityBadge({ severity }: { severity: AnomalyData['severity'] }) { return <b className={`severity-badge severity-${severity.toLowerCase()}`}>{severity}</b> }
function DistortionMeter({ value, label }: { value: number; label: string }) { return (<div className="distortion-meter" aria-label={label}><div><span>{label}</span><strong>{value}%</strong></div><i><b style={{ width: `${value}%` }} /></i></div>) }

function SoulPodPage() {
  return (
    <section className="soul-page" aria-label="Soul Pod personal capsule">
      <div className="soul-ambient" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => (<span key={index} style={{ left: `${(index * 19 + 7) % 100}%`, top: `${(index * 29 + 11) % 100}%`, '--soul-delay': `${index * 210}ms` } as CSSProperties} />))}</div>
      <header className="soul-header">
        <div><p className="soul-kicker">private emotional capsule</p><h2>Your saved echoes live here.</h2><span>A quiet signal chamber for relics, voice fragments, notes, and archived feelings.</span></div>
        <button className="pod-action" type="button">Enter Pod</button>
      </header>
      <section className="pod-chamber" aria-label="Central Pod Chamber"><PodOrb /><aside className="pod-status-panel"><span>personal signal status</span><strong>open / protected</strong><p>Pod health is stable. Emotional frequency is soft, clear, and responsive.</p><button type="button">Open Memory</button></aside></section>
      <section className="soul-grid"><EmotionalMeter /><section className="saved-relics" aria-label="Saved Relics">{relics.map((relic) => (<RelicPreview key={relic.title} relic={relic} />))}</section></section>
      <section className="voice-capsules" aria-label="Voice Capsules">{voiceCapsules.map((capsule) => (<VoiceCapsuleCard key={capsule.title} capsule={capsule} />))}</section>
      <section className="pod-card-grid" aria-label="Memory Fragments and Private Echoes">{podCards.map((card) => (<PodCard key={card.title} card={card} />))}</section>
    </section>
  )
}
function PodOrb() { return (<div className="pod-orb-wrap" aria-hidden="true"><div className="pod-orbit pod-orbit-one" /><div className="pod-orbit pod-orbit-two" /><div className="pod-orb"><div className="pod-orb-core" /><div className="pod-waveform"><i /><i /><i /><i /><i /><i /></div></div></div>) }
function PodCard({ card }: { card: PodCardData }) { return (<article className="pod-card"><span>{card.type}</span><h3>{card.title}</h3><p>{card.detail}</p><small>{card.time}</small></article>) }
function RelicPreview({ relic }: { relic: RelicData }) { return (<button className={`relic-preview ${relic.glow}`} type="button"><i /><strong>{relic.title}</strong><span>{relic.subtitle}</span></button>) }
function VoiceCapsuleCard({ capsule }: { capsule: VoiceCapsuleData }) { return (<article className="voice-card"><div><span>Voice Capsule</span><h3>{capsule.title}</h3><p>{capsule.feeling} · {capsule.duration}</p></div><div className="voice-wave" aria-hidden="true"><i /><i /><i /><i /><i /></div></article>) }
function EmotionalMeter() { return (<section className="emotional-meter" aria-label="Emotional Frequency"><span>emotional frequency</span><strong>68%</strong><p>calm violet resonance</p><div><i /></div></section>) }

function RelicsPage() {
  const featuredRelic = archiveRelics[0]
  return (
    <section className="relics-page" aria-label="Relics archive">
      <div className="relics-ambient" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => (<span key={index} style={{ left: `${(index * 13 + 8) % 100}%`, top: `${(index * 31 + 14) % 100}%`, '--archive-delay': `${index * 170}ms` } as CSSProperties} />))}</div>
      <header className="relics-header"><div><p className="relics-kicker">observatory collection chamber</p><h2>A hidden archive of living artifacts.</h2><span>Discover, preserve, and study rare ecosystem relics recovered from emotional signal fields.</span></div><ArchiveProgress /></header>
      <FeaturedRelicChamber relic={featuredRelic} />
      <section className="archive-categories" aria-label="Archive category selector">{['All Relics','Echo Fragment','Pulse Crystal','Memory Shard','Forbidden'].map((category) => (<button className={category === 'All Relics' ? 'active' : ''} key={category} type="button">{category}</button>))}</section>
      <section className="relics-layout">
        <div className="archive-grid" aria-label="Relic archive grid">{archiveRelics.map((relic) => (<RelicCard key={relic.id} relic={relic} />))}</div>
        <aside className="archive-side"><section className="archive-panel"><span>observatory records</span><strong>6 relics preserved</strong><p>Two artifacts are unstable. One forbidden transmission remains sealed.</p></section><section className="timeline-panel" aria-label="Discovery Timeline"><span>discovery timeline</span>{archiveTimeline.map((entry) => (<p key={entry}>{entry}</p>))}</section></aside>
      </section>
    </section>
  )
}
function FeaturedRelicChamber({ relic }: { relic: ArchiveRelic }) {
  return (<section className={`featured-relic rarity-${relic.rarity.toLowerCase()}`} aria-label="Featured Artifact"><div className="artifact-preview" aria-hidden="true"><i /></div><div className="featured-copy"><RarityBadge rarity={relic.rarity} /><h3>{relic.name}</h3><p>{relic.description}</p><button type="button">Open Relic</button></div><ResonanceMeter value={relic.resonance} label="featured resonance" /></section>)
}
function RelicCard({ relic }: { relic: ArchiveRelic }) {
  return (<article className={`archive-relic-card rarity-${relic.rarity.toLowerCase()}`}><div className="relic-hologram" aria-hidden="true"><i /></div><RarityBadge rarity={relic.rarity} /><h3>{relic.name}</h3><p>{relic.description}</p><dl><div><dt>Type</dt><dd>{relic.type}</dd></div><div><dt>Origin</dt><dd>{relic.origin}</dd></div><div><dt>Condition</dt><dd>{relic.condition}</dd></div><div><dt>Found</dt><dd>{relic.discovered}</dd></div></dl><ResonanceMeter value={relic.resonance} label="resonance" /></article>)
}
function RarityBadge({ rarity }: { rarity: ArchiveRelic['rarity'] }) { return <span className={`rarity-badge rarity-${rarity.toLowerCase()}`}>{rarity}</span> }
function ResonanceMeter({ value, label }: { value: number; label: string }) { return (<div className="resonance-meter" aria-label={label}><div><span>{label}</span><strong>{value}%</strong></div><i style={{ width: `${value}%` }} /></div>) }
function ArchiveProgress() { return (<div className="archive-progress" aria-label="Collection Progress"><span>collection progress</span><strong>42%</strong><i><b /></i></div>) }

function FrequenciesPage() {
  const activeFrequency = frequencyChannels[1]
  return (
    <section className="frequencies-page" aria-label="Frequencies tuning space">
      <div className="frequency-ambient" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => (<span key={index} style={{ left: `${(index * 23 + 5) % 100}%`, top: `${(index * 17 + 13) % 100}%`, '--frequency-delay': `${index * 160}ms` } as CSSProperties} />))}</div>
      <header className="frequencies-header"><div><p className="frequencies-kicker">emotional audio spectrum</p><h2>Tune into living signals.</h2><span>Explore moods, rooms, and broadcasts across the ecosystem frequency chamber.</span></div><SignalStrengthMeter value={activeFrequency.strength} /></header>
      <section className="frequency-control-room"><TunerVisual frequency={activeFrequency.frequency} /><ActiveBroadcast channel={activeFrequency} /></section>
      <section className="channel-selector" aria-label="Mood and channel selector">{['All','Calm','Focus','Night','Pulse','Lost'].map((channel) => (<button className={channel === 'All' ? 'active' : ''} key={channel} type="button">{channel}</button>))}</section>
      <SpectrumVisualizer />
      <section className="frequency-layout">
        <div className="frequency-card-grid" aria-label="Frequency Cards">{frequencyChannels.map((channel) => (<FrequencyCard active={channel.id === activeFrequency.id} channel={channel} key={channel.id} />))}</div>
        <aside className="frequency-side"><FrequencyList title="recently tuned" items={['Quiet Echo','Memory Wave','Pulse Room']} /><FrequencyList title="recommended signals" items={['Deep Focus','Static Bloom','High Energy']} /></aside>
      </section>
    </section>
  )
}
function TunerVisual({ frequency }: { frequency: string }) { return (<div className="tuner-visual" aria-label="Central Tuner"><div className="tuner-ring tuner-ring-one" /><div className="tuner-ring tuner-ring-two" /><div className="tuner-dial"><span>{frequency}</span><small>MHz</small></div><div className="tuner-needle" /></div>) }
function ActiveBroadcast({ channel }: { channel: FrequencyChannel }) { return (<article className="active-broadcast" aria-label="Active Frequency"><span>active broadcast</span><h3>{channel.name}</h3><p>{channel.description}</p><Waveform bars={9} /><div><b>{channel.mood}</b><b>{channel.listeners} tuned</b></div></article>) }
function FrequencyCard({ channel, active }: { channel: FrequencyChannel; active: boolean }) { return (<button className={`frequency-card ${active ? 'active' : ''}`} type="button"><span>{channel.type}</span><strong>{channel.name}</strong><p>{channel.description}</p><Waveform bars={6} /><footer><b>{channel.frequency} MHz</b><small>{channel.strength}% signal · {channel.listeners}</small></footer></button>) }
function Waveform({ bars }: { bars: number }) { return (<div className="frequency-waveform" aria-hidden="true">{Array.from({ length: bars }, (_, index) => (<i key={index} style={{ '--wave-delay': `${index * 90}ms` } as CSSProperties} />))}</div>) }
function SignalStrengthMeter({ value }: { value: number }) { return (<div className="signal-strength" aria-label="Signal strength meter"><span>signal strength</span><strong>{value}%</strong><i><b style={{ width: `${value}%` }} /></i></div>) }
function SpectrumVisualizer() { return (<section className="spectrum-visualizer" aria-label="Frequency spectrum visualization">{Array.from({ length: 28 }, (_, index) => (<i key={index} style={{ '--spectrum-delay': `${index * 45}ms` } as CSSProperties} />))}</section>) }
function FrequencyList({ title, items }: { title: string; items: string[] }) { return (<section className="frequency-list"><span>{title}</span>{items.map((item) => (<button key={item} type="button">{item}</button>))}</section>) }

function CapsulesPage() {
  const featuredCapsule = capsules[0]
  return (
    <section className="capsules-page" aria-label="Capsules audio memory vault">
      <div className="capsules-ambient" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => (<span key={index} style={{ left: `${(index * 21 + 6) % 100}%`, top: `${(index * 27 + 10) % 100}%`, '--capsule-delay': `${index * 180}ms` } as CSSProperties} />))}</div>
      <header className="capsules-header"><div><p className="capsules-kicker">audio memory vault</p><h2>Open the capsule chamber.</h2><span>Discover saved voice fragments, private transmissions, and emotional time capsules.</span></div><button className="record-button" type="button">Record mock</button></header>
      <FeaturedCapsule capsule={featuredCapsule} />
      <section className="capsule-filters" aria-label="Emotional Filters">{['All','Saved','Private','Echo','Drift','Archived'].map((filter) => (<button className={filter === 'All' ? 'active' : ''} key={filter} type="button">{filter}</button>))}</section>
      <section className="capsules-layout">
        <div className="capsule-grid" aria-label="Capsule Library">{capsules.map((capsule) => (<CapsuleCard capsule={capsule} key={capsule.id} />))}</div>
        <aside className="capsule-side"><CapsuleMiniPanel title="recent recordings" items={['Recovered Echo','Pulse Fragment','Quiet Frequency']} /><CapsuleMiniPanel title="archived capsules" items={['Archived Feeling','Static Bloom Memory','Lost Audio Fragment']} /><section className="capsule-timeline" aria-label="Timeline"><span>timeline</span><p>Late Night Signal saved from the feed.</p><p>Recovered Echo surfaced in Drift.</p><p>Private Transmission sealed in the vault.</p></section></aside>
      </section>
    </section>
  )
}
function FeaturedCapsule({ capsule }: { capsule: CapsuleData }) { return (<section className="featured-capsule" aria-label="Featured Capsule"><div className="capsule-orb" aria-hidden="true"><i /></div><div className="featured-capsule-copy"><CapsuleStatusBadge status={capsule.status} /><h3>{capsule.title}</h3><p>{capsule.description}</p><Waveform bars={10} /><button type="button">Preview Capsule</button></div><div className="capsule-source"><span>signal source</span><strong>{capsule.source}</strong><small>{capsule.duration} · {capsule.timestamp}</small></div></section>) }
function CapsuleCard({ capsule }: { capsule: CapsuleData }) { return (<article className="capsule-card"><header><button className="play-pulse" type="button" aria-label={`Preview ${capsule.title}`} /><CapsuleStatusBadge status={capsule.status} /></header><span>{capsule.type}</span><h3>{capsule.title}</h3><p>{capsule.description}</p><Waveform bars={7} /><footer><b>{capsule.tag}</b><small>{capsule.duration} · {capsule.source}</small></footer></article>) }
function CapsuleStatusBadge({ status }: { status: CapsuleData['status'] }) { return <b className={`capsule-status status-${status.toLowerCase()}`}>{status}</b> }
function CapsuleMiniPanel({ title, items }: { title: string; items: string[] }) { return (<section className="capsule-mini-panel"><span>{title}</span>{items.map((item) => (<button key={item} type="button">{item}</button>))}</section>) }

function SettingsPage() {
  return (
    <section className="settings-page" aria-label="Settings and Control Center">
      <div className="settings-ambient" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => (<span key={index} style={{ left: `${(index * 19 + 11) % 100}%`, top: `${(index * 27 + 9) % 100}%`, '--settings-delay': `${index * 190}ms` } as CSSProperties} />))}</div>
      <header className="settings-header"><div><p className="settings-kicker">personal signal calibration</p><h2>Tune your ecosystem experience.</h2><span>Adjust energy, privacy, notifications, motion, atmosphere, and glow intensity from one private observatory console.</span></div><AccountStatusPanel /></header>
      <section className="settings-hero" aria-label="Signal identity settings"><div className="settings-core" aria-hidden="true"><i /></div><article className="identity-settings"><span>signal identity</span><h3>@aurora.signal</h3><p>Profile energy is tuned to Static Bloom with a calm privacy envelope and elevated resonance.</p><button type="button">Edit profile mock</button></article></section>
      <section className="energy-selector" aria-label="Profile Energy Settings">{['Calm Signal','Drift Energy','Echo State','Pulse State','Quiet Orbit','Static Bloom','Observatory Mode','Deep Frequency'].map((energy) => (<button className={energy === 'Static Bloom' ? 'active' : ''} key={energy} type="button"><i />{energy}</button>))}</section>
      <section className="settings-layout">
        <div className="settings-control-grid">
          <SettingsCard title="Visual Intensity" detail="Calibrate glow, motion, and bloom lighting.">{settingControls.slice(0, 2).map((control) => (<SignalSlider control={control} key={control.label} />))}</SettingsCard>
          <SettingsCard title="Audio Atmosphere" detail="Tune mock ambience and room energy.">{settingControls.slice(2, 3).map((control) => (<SignalSlider control={control} key={control.label} />))}<GlowingToggle toggle={settingToggles[3]} /></SettingsCard>
          <SettingsCard title="Privacy Mode" detail="Shape how visible your signal feels across the ecosystem.">{settingToggles.slice(0, 2).map((toggle) => (<GlowingToggle toggle={toggle} key={toggle.label} />))}</SettingsCard>
          <SettingsCard title="Notification Preferences" detail="Control how observatory transmissions reach you."><GlowingToggle toggle={settingToggles[2]} /><SignalSlider control={{ label: 'Notification Frequency', detail: 'Mock alert cadence', value: 46 }} /></SettingsCard>
          <SettingsCard title="Theme & Resonance" detail="Set ecosystem theme, drift response, and signal strength.">{settingControls.slice(3).map((control) => (<SignalSlider control={control} key={control.label} />))}</SettingsCard>
        </div>
        <aside className="settings-side"><section className="settings-panel"><span>data / export</span><strong>archive ready</strong><p>Mock export is prepared for capsules, relics, echoes, and signal history.</p><button type="button">Export mock data</button></section><section className="settings-panel"><span>calibration actions</span><button type="button">Save calibration</button><button type="button">Reset calibration</button></section></aside>
      </section>
    </section>
  )
}
function SettingsCard({ title, detail, children }: { title: string; detail: string; children: ReactNode }) { return (<article className="settings-card"><header><span>{title}</span><p>{detail}</p></header><div>{children}</div></article>) }
function SignalSlider({ control }: { control: SettingControl }) { return (<label className="signal-slider"><span>{control.label}</span><small>{control.detail}</small><i><b style={{ width: `${control.value}%` }} /></i><strong>{control.value}%</strong></label>) }
function GlowingToggle({ toggle }: { toggle: SettingToggle }) { return (<button className={`glowing-toggle ${toggle.enabled ? 'enabled' : ''}`} type="button"><span><strong>{toggle.label}</strong><small>{toggle.detail}</small></span><i><b /></i></button>) }
function AccountStatusPanel() { return (<aside className="account-status-panel" aria-label="Account status panel"><span>account status</span><strong>demo signal</strong><small>private / unsynced / mock data</small></aside>) }

export default App
