import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGlobalAudio } from '../hooks/useGlobalAudio';
import { useEcosystemState } from '../hooks/useEcosystemState';
import { deleteLocalRecording, listLocalRecordings, saveRecordingLocally } from '../lib/localAudioStore';
import { downloadBlob, exportFilename, renderStoryImage } from '../lib/storyExport';
import { fetchRemoteRecordings, mirrorRecordingDelete, mirrorRecordingUpload, remotePlaybackUrl } from '../lib/backendBridge';
import { playSample } from '../lib/sampleAudio';
import VoiceReactionStack from './VoiceReactions';
import EcosphereVRPanel from './EcosphereVRPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'processing';
type ResonanceState = 'unresolved' | 'drift' | 'static-bloom' | 'replaying' | 'nocturne' | 'fracture';

interface UnsentSignal {
  id: string;
  signalId: string;
  duration: number;
  timestamp: Date;
  emotionalTag: ResonanceState;
  replayCount: number;
  blob?: Blob;
  remote?: { audioId: string; bucket: string; path: string };
  waveformData: number[];
  decayLevel: number; // 0–1, higher = more decayed
  isDrifted: boolean;
  isArchived: boolean;
}

interface WhisperMessage {
  id: string;
  text: string;
  visible: boolean;
}

const WHISPER_POOL: string[] = [
  'someone almost heard this.',
  "you've played this 11 times now.",
  'someone replayed this in a parking lot.',
  'heard at 3:47am. no reason given.',
  'this one gets replayed after arguments.',
  'someone stayed 47 minutes and said nothing.',
  'the background fan noise makes this worse somehow.',
  'someone typed a reply and deleted it.',
  'this sounds like driving home after saying the wrong thing.',
  'somebody muted it halfway. came back an hour later.',
  'feels like checking your phone after an argument.',
  'someone said "same" out loud to nobody.',
  'this was somebody\'s third replay tonight.',
  'the pause in the middle is the worst part.',
];

const SIGNAL_TAGS: ResonanceState[] = [
  'unresolved', 'drift', 'static-bloom', 'replaying', 'nocturne', 'fracture'
];

function generateSignalId(): string {
  const prefix = 'SIG';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = prefix + '-';
  for (let i = 0; i < 8; i++) {
    if (i === 4) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateWaveform(length = 32): number[] {
  return Array.from({ length }, () => 0.15 + Math.random() * 0.85);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Atmospheric Particle Field ───────────────────────────────────────────────

const ParticleField: React.FC<{ recording: boolean }> = ({ recording }) => {
  const particles = Array.from({ length: recording ? 28 : 18 }, (_, i) => i);
  return (
    <div className="ur-particle-field" aria-hidden>
      {particles.map(i => (
        <span
          key={i}
          className="ur-particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${(i * 0.37) % 4}s`,
            animationDuration: `${5 + (i % 4)}s`,
            opacity: recording ? 0.7 : 0.35,
          }}
        />
      ))}
    </div>
  );
};

// ─── Waveform Preview ─────────────────────────────────────────────────────────

const WaveformPreview: React.FC<{
  data: number[];
  playing?: boolean;
  decayed?: boolean;
  height?: number;
}> = ({ data, playing = false, decayed = false, height = 48 }) => (
  <div
    className={`ur-waveform-preview ${playing ? 'playing' : ''} ${decayed ? 'decayed' : ''}`}
    style={{ height }}
    aria-hidden
  >
    {data.map((v, i) => (
      <i
        key={i}
        style={{
          height: `${v * 100}%`,
          animationDelay: `${(i * 60) % 800}ms`,
          opacity: decayed ? 0.35 + v * 0.3 : 0.55 + v * 0.45,
        }}
      />
    ))}
  </div>
);

// ─── Live Recording Waveform ──────────────────────────────────────────────────

const LiveWaveform: React.FC<{ analyser: AnalyserNode | null; active: boolean }> = ({
  analyser, active
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const stage = canvas.closest('.ur-orb-stage') as HTMLElement | null;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!analyser || !active) {
        stage?.style.setProperty('--mic-level', '0');
        // Idle breathing waveform
        const t = Date.now() / 1200;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,42,116,0.38)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / 22 + t) * 8 * Math.sin(t * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      const sliceW = W / buf.length;

      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i] - 128);
      const level = Math.min(1, (sum / buf.length) / 28);
      stage?.style.setProperty('--mic-level', level.toFixed(3));

      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, 'rgba(0,240,255,0.7)');
      gradient.addColorStop(0.5, 'rgba(255,42,116,0.9)');
      gradient.addColorStop(1, 'rgba(0,240,255,0.7)');

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255,42,116,0.6)';

      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] / 128.0;
        const y = (v * H) / 2;
        if (i === 0) ctx.moveTo(i * sliceW, y);
        else ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      className="ur-live-waveform"
      width={480}
      height={80}
      aria-hidden
    />
  );
};

// ─── Recording Orb ────────────────────────────────────────────────────────────

const RecordingOrb: React.FC<{
  state: RecordingState;
  analyser: AnalyserNode | null;
  onClick: () => void;
}> = ({ state, analyser, onClick }) => (
  <div className={`ur-orb-stage ur-orb-stage--${state}`}>
    <div className="ur-orb-aura" aria-hidden />
    <div className="ur-orb-resonance-rings" aria-hidden>
      <span /><span /><span />
    </div>
    <button
      className={`ur-orb ${state === 'recording' ? 'ur-orb--recording' : ''}`}
      onClick={onClick}
      aria-label={state === 'recording' ? 'End transmission' : 'Record signal'}
    >
      <div className="ur-orb-core" aria-hidden>
        <div className="ur-orb-inner" />
      </div>
      <span className="ur-orb-label">
        {state === 'idle' && 'RECORD SIGNAL'}
        {state === 'recording' && 'END TRANSMISSION'}
        {state === 'processing' && 'PROCESSING...'}
      </span>
    </button>
    <LiveWaveform analyser={analyser} active={state === 'recording'} />
  </div>
);

// ─── Signal Card ──────────────────────────────────────────────────────────────

const SignalCard: React.FC<{
  signal: UnsentSignal;
  onPlay: (id: string) => void;
  onSave: (id: string) => void;
  onDrift: (id: string) => void;
  onExport: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isPlaying: boolean;
}> = ({ signal, onPlay, onSave, onDrift, onExport, onArchive, onDelete, isPlaying }) => {
  const decay = signal.decayLevel;
  const glowIntensity = Math.min(1, signal.replayCount / 5);

  return (
    <article
      className={`ur-signal-card ${decay > 0.6 ? 'ur-signal-card--decayed' : ''} ${isPlaying ? 'ur-signal-card--playing' : ''} ${signal.isDrifted ? 'ur-signal-card--drifted' : ''}`}
      style={{
        '--decay': decay,
        '--glow': glowIntensity,
      } as React.CSSProperties}
    >
      <div className="ur-signal-card-bg" aria-hidden />

      <header className="ur-signal-card-header">
        <div className="ur-signal-id">
          <span className="ur-signal-id-label">SIGNAL</span>
          <code className="ur-signal-id-code">{signal.signalId}</code>
        </div>
        <span className={`ur-signal-tag ur-signal-tag--${signal.emotionalTag}`}>
          {signal.emotionalTag.replace('-', ' ')}
        </span>
      </header>

      <div className="ur-signal-waveform-row">
        <WaveformPreview
          data={signal.waveformData}
          playing={isPlaying}
          decayed={decay > 0.5}
        />
        {signal.replayCount >= 3 && (
          <div className="ur-resonance-artifact" aria-hidden>
            {Array.from({ length: Math.min(signal.replayCount, 6) }, (_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="ur-signal-meta">
        <span className="ur-signal-duration">{formatDuration(signal.duration)}</span>
        <span className="ur-signal-timestamp">{formatTimestamp(signal.timestamp)}</span>
        {signal.replayCount > 0 && (
          <span className="ur-signal-replays">
            ↺ {signal.replayCount}
          </span>
        )}
        {signal.isDrifted && (
          <span className="ur-signal-drifted-badge">DRIFTED</span>
        )}
      </div>

      <footer className="ur-signal-card-footer">
        <button
          className={`ur-signal-btn ur-signal-btn--play ${isPlaying ? 'active' : ''}`}
          onClick={() => onPlay(signal.id)}
          aria-label={isPlaying ? 'Stop' : 'Replay signal'}
        >
          {isPlaying ? '■ STOP' : '▶ REPLAY'}
        </button>
        {!signal.isArchived && (
          <button className="ur-signal-btn ur-signal-btn--save" onClick={() => onSave(signal.id)}>
            SAVE
          </button>
        )}
        {!signal.isDrifted && (
          <button className="ur-signal-btn ur-signal-btn--drift" onClick={() => onDrift(signal.id)}>
            DRIFT
          </button>
        )}
        <button className="ur-signal-btn ur-signal-btn--export" onClick={() => onExport(signal.id)}>
          EXPORT
        </button>
        <button className="ur-signal-btn ur-signal-btn--archive" onClick={() => onArchive(signal.id)}>
          ARCHIVE
        </button>
        {(signal.blob || signal.remote) && (
          <button className="ur-signal-btn ur-signal-btn--delete" onClick={() => onDelete(signal.id)} aria-label="Delete recording">
            ✕
          </button>
        )}
      </footer>
    </article>
  );
};

// ─── Whisper Message ─────────────────────────────────────────────────────────

const WhisperDisplay: React.FC<{ whispers: WhisperMessage[] }> = ({ whispers }) => (
  <div className="ur-whisper-layer" aria-live="polite" aria-label="Hidden transmissions">
    {whispers.filter(w => w.visible).map(w => (
      <div key={w.id} className="ur-whisper">
        <span className="ur-whisper-signal" aria-hidden>⬡</span>
        {w.text}
      </div>
    ))}
  </div>
);

// ─── Export Preview Overlay ───────────────────────────────────────────────────

const ExportOverlay: React.FC<{
  signal: UnsentSignal | null;
  onClose: () => void;
  onDownload: () => void;
}> = ({ signal, onClose, onDownload }) => {
  if (!signal) return null;
  return (
    <div className="ur-export-overlay" role="dialog" aria-label="Export signal">
      <div className="ur-export-backdrop" onClick={onClose} aria-hidden />
      <div className="ur-export-panel">
        <div className="ur-export-preview">
          <div className="ur-export-preview-bg" aria-hidden>
            <span /><span /><span />
          </div>
          <div className="ur-export-preview-content">
            <div className="ur-export-branding">
              <span className="ur-export-logo">ECOSPHERE</span>
              <span className="ur-export-subtitle">unsent room</span>
            </div>
            <WaveformPreview data={signal.waveformData} height={72} />
            <div className="ur-export-signal-info">
              <code>{signal.signalId}</code>
              <span className={`ur-signal-tag ur-signal-tag--${signal.emotionalTag}`}>
                {signal.emotionalTag.replace('-', ' ')}
              </span>
            </div>
            <p className="ur-export-tagline">"messages that never found a destination."</p>
          </div>
          <div className="ur-export-particles" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
        <div className="ur-export-actions">
          <p className="ur-export-note">vertical 9:16 · cinematic format</p>
          <button className="ur-export-download-btn" onClick={onDownload}>
            EXPORT SIGNAL CLIP
          </button>
          <button className="ur-export-close-btn" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'saved' | 'drifted' | 'archived';

const FilterBar: React.FC<{
  active: FilterMode;
  counts: Record<FilterMode, number>;
  onChange: (f: FilterMode) => void;
}> = ({ active, counts, onChange }) => (
  <nav className="ur-filter-bar" aria-label="Signal filters">
    {(['all', 'saved', 'drifted', 'archived'] as FilterMode[]).map(f => (
      <button
        key={f}
        className={`ur-filter-btn ${active === f ? 'active' : ''}`}
        onClick={() => onChange(f)}
        aria-pressed={active === f}
      >
        {f.toUpperCase()}
        <span className="ur-filter-count">{counts[f]}</span>
      </button>
    ))}
  </nav>
);

// ─── Recording Timer ─────────────────────────────────────────────────────────

const RecordingTimer: React.FC<{ startTime: number | null; active: boolean }> = ({
  startTime, active
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || !startTime) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [active, startTime]);

  if (!active) return null;

  const s = Math.floor(elapsed / 1000);
  const ms = Math.floor((elapsed % 1000) / 10);
  const m = Math.floor(s / 60);

  return (
    <div className="ur-recording-timer" role="timer" aria-label="Recording duration">
      <span className="ur-recording-dot" aria-hidden />
      <span className="ur-recording-time">
        {m}:{String(s % 60).padStart(2, '0')}
        <small>.{String(ms).padStart(2, '0')}</small>
      </span>
      <span className="ur-recording-label">TRANSMITTING</span>
    </div>
  );
};

// ─── Infinite anonymous voice feed ───────────────────────────────────────────

const FEED_OPENERS = [
  'i still think about that conversation sometimes.',
  'i typed this whole thing out and never sent it.',
  "you'd laugh at how often i check if you're online.",
  'i drove past your street again. on purpose.',
  "i'm doing fine. that's the part that feels wrong.",
  'i kept the voicemail. i know. i know.',
  'nobody asked how i was today and i almost told someone anyway.',
  'i practiced saying it in the shower. perfect delivery. no audience.',
  "we're strangers now and that's the weirdest thing in the world.",
  'i heard our song at the grocery store and just stood there.',
  'i almost called you when it happened. old habit.',
  "it's been a year. i still draft texts i'll never send.",
]

const FEED_CLOSERS = [
  'anyway. goodnight.',
  "that's it. that's the whole thing.",
  'i just needed to say it somewhere.',
  "don't tell anyone.",
  'maybe the internet can hold this one.',
  'ok. deleting this in my head now.',
  'if you ever hear this, you know.',
  'this app is the only one awake.',
  'same time tomorrow probably.',
  "i feel lighter already. that's embarrassing.",
  'whatever. it counts as closure.',
  'someone out there gets it.',
]

const FEED_SOCIAL = [
  (n: number) => `${n} listening now`,
  (n: number) => `saved ${n + 9} times`,
  () => 'resurfaced tonight',
  (n: number) => `replayed ${n + 4}× today`,
  () => 'voice chain growing',
  () => 'someone echoed this',
]

type FeedFragment = {
  id: string
  text: string
  seed: number
  socialIdx: number
  socialN: number
  hot: boolean
}

function makeFeedFragment(i: number): FeedFragment {
  const opener = FEED_OPENERS[i % FEED_OPENERS.length]
  const closer = FEED_CLOSERS[(i * 7 + Math.floor(i / FEED_OPENERS.length)) % FEED_CLOSERS.length]
  return {
    id: `unsent-feed-${i}`,
    text: `${opener} ${closer}`,
    seed: i * 73 + 29,
    socialIdx: (i * 5) % FEED_SOCIAL.length,
    socialN: 3 + ((i * 11) % 24),
    hot: i % 5 === 2,
  }
}

const UnsentFeed: React.FC = () => {
  const feedAudio = useGlobalAudio();
  const [count, setCount] = useState(6);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // infinite scroll: load more fragments as the sentinel approaches
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setCount(c => Math.min(c + 6, 240));
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fragments = Array.from({ length: count }, (_, i) => makeFeedFragment(i));
  const isPlaying = (id: string) => feedAudio.current?.id === id && feedAudio.playing;

  return (
    <section className="ur-feed" aria-label="Anonymous unsent voices">
      <div className="ur-archive-header">
        <div className="ur-archive-title-row">
          <h2 className="ur-archive-title">UNSENT VOICES</h2>
          <span className="ur-archive-count">anonymous · endless · tonight</span>
        </div>
      </div>
      <div className="ur-feed-list">
        {fragments.map(f => (
          <article key={f.id} className={`ur-feed-card${f.hot ? ' ur-feed-card--hot' : ''}${isPlaying(f.id) ? ' ur-feed-card--playing' : ''}`}>
            <div className="ur-feed-social">
              <i aria-hidden="true" />
              {FEED_SOCIAL[f.socialIdx](f.socialN)}
            </div>
            <p className="ur-feed-text">"{f.text}"</p>
            <div className="ur-feed-controls">
              <button
                type="button"
                className="ur-feed-play"
                onClick={() => {
                  if (isPlaying(f.id)) feedAudio.stop();
                  else void playSample(feedAudio, { id: f.id, label: 'an unsent voice', source: 'unsent' }, 'voice', f.seed, 8000);
                }}
              >
                {isPlaying(f.id) ? '■ stop' : '▶ hear it'}
              </button>
            </div>
            <VoiceReactionStack signalId={f.id} moodColor="#ff1493" />
          </article>
        ))}
      </div>
      <div ref={sentinelRef} className="ur-feed-sentinel" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  );
};

// ─── Sound Engine ─────────────────────────────────────────────────────────────

class AtmosphericSound {
  private ctx: AudioContext | null = null;
  private hissNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  init() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 0.04;
      this.gainNode.connect(this.ctx.destination);
    } catch { /* audio unavailable */ }
  }

  startHiss() {
    if (!this.ctx || !this.gainNode) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      this.hissNode = this.ctx.createBufferSource();
      this.hissNode.buffer = buffer;
      this.hissNode.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 4200;
      filter.Q.value = 0.4;
      this.hissNode.connect(filter);
      filter.connect(this.gainNode);
      this.hissNode.start();
    } catch { /* audio unavailable */ }
  }

  stopHiss() {
    try { this.hissNode?.stop(); this.hissNode = null; } catch { /* audio unavailable */ }
  }

  playResonancePulse() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
    } catch { /* audio unavailable */ }
  }

  setVolume(v: number) {
    if (this.gainNode) this.gainNode.gain.value = v;
  }

  resume() {
    this.ctx?.resume();
  }
}

const soundEngine = new AtmosphericSound();

// ─── Main Component ───────────────────────────────────────────────────────────

export const UnsentRoom: React.FC = () => {
  const globalAudio = useGlobalAudio();
  const { archiveEntry, saveToLibrary } = useEcosystemState();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [signals, setSignals] = useState<UnsentSignal[]>([]);
  const playingId = globalAudio.current?.source === 'unsent' && globalAudio.playing ? globalAudio.current.id : null;
  const [whispers, setWhispers] = useState<WhisperMessage[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [exportTarget, setExportTarget] = useState<UnsentSignal | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const whisperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Seed demo signals ────────────────────────────────────────────────────────
  useEffect(() => {
    const demo: UnsentSignal[] = [
      {
        id: 'demo-1',
        signalId: generateSignalId(),
        duration: 47000,
        timestamp: new Date(Date.now() - 1000 * 60 * 14),
        emotionalTag: 'nocturne',
        replayCount: 7,
        waveformData: generateWaveform(),
        decayLevel: 0.08,
        isDrifted: false,
        isArchived: false,
      },
      {
        id: 'demo-2',
        signalId: generateSignalId(),
        duration: 23000,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        emotionalTag: 'unresolved',
        replayCount: 2,
        waveformData: generateWaveform(),
        decayLevel: 0.22,
        isDrifted: false,
        isArchived: false,
      },
      {
        id: 'demo-3',
        signalId: generateSignalId(),
        duration: 91000,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28),
        emotionalTag: 'fracture',
        replayCount: 11,
        waveformData: generateWaveform(),
        decayLevel: 0.64,
        isDrifted: true,
        isArchived: false,
      },
      {
        id: 'demo-4',
        signalId: generateSignalId(),
        duration: 34000,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
        emotionalTag: 'static-bloom',
        replayCount: 0,
        waveformData: generateWaveform(),
        decayLevel: 0.85,
        isDrifted: false,
        isArchived: true,
      },
    ];
    setSignals(demo);

    // restore real recordings persisted in IndexedDB
    let cancelled = false;
    void listLocalRecordings().then(stored => {
      if (cancelled || stored.length === 0) return;
      const restored: UnsentSignal[] = stored.map(r => ({
        id: r.id,
        signalId: r.label,
        duration: r.durationMs,
        timestamp: new Date(r.createdAt),
        emotionalTag: (SIGNAL_TAGS.includes(r.emotionalTag as ResonanceState) ? r.emotionalTag : 'unresolved') as ResonanceState,
        replayCount: 0,
        blob: r.blob,
        waveformData: generateWaveform(),
        decayLevel: Math.min(0.9, (Date.now() - r.createdAt) / (1000 * 60 * 60 * 24 * 14)),
        isDrifted: false,
        isArchived: false,
      }));
      setSignals(prev => [...restored, ...prev.filter(p => !restored.some(r => r.id === p.id))]);
    });

    // merge recordings synced to the backend audio library
    void fetchRemoteRecordings().then(remote => {
      if (cancelled || remote.length === 0) return;
      setSignals(prev => {
        const localLabels = new Set(prev.map(p => p.signalId));
        const merged: UnsentSignal[] = remote
          .filter(r => !localLabels.has(r.title))
          .map(r => ({
            id: `remote-${r.audioId}`,
            signalId: r.title,
            duration: r.durationMs,
            timestamp: new Date(r.createdAt),
            emotionalTag: 'replaying' as ResonanceState,
            replayCount: 0,
            remote: { audioId: r.audioId, bucket: r.bucket, path: r.path },
            waveformData: generateWaveform(),
            decayLevel: Math.min(0.9, (Date.now() - r.createdAt) / (1000 * 60 * 60 * 24 * 14)),
            isDrifted: false,
            isArchived: false,
          }));
        return merged.length ? [...merged, ...prev] : prev;
      });
    });
    return () => { cancelled = true; };
  }, []);

  // ── Whisper engine ───────────────────────────────────────────────────────────
  const showWhisper = useCallback(() => {
    const text = WHISPER_POOL[Math.floor(Math.random() * WHISPER_POOL.length)];
    const id = crypto.randomUUID?.() || String(Date.now());
    setWhispers(w => [...w.slice(-2), { id, text, visible: true }]);
    setTimeout(() => {
      setWhispers(w => w.map(x => x.id === id ? { ...x, visible: false } : x));
    }, 6000);
  }, []);

  useEffect(() => {
    const schedule = () => {
      const delay = 18000 + Math.random() * 24000;
      whisperTimerRef.current = setTimeout(() => { showWhisper(); schedule(); }, delay);
    };
    schedule();
    return () => { if (whisperTimerRef.current) clearTimeout(whisperTimerRef.current); };
  }, [showWhisper]);

  // ── Cleanup on unmount: stop mic, playback, and ambient audio ────────────────
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        }
      } catch { /* already stopped */ }
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => { /* already closed */ });
      soundEngine.stopHiss();
    };
  }, []);

  // ── Signal decay ─────────────────────────────────────────────────────────────
  useEffect(() => {
    decayTimerRef.current = setInterval(() => {
      setSignals(prev => prev.map(s => ({
        ...s,
        decayLevel: Math.min(1, s.decayLevel + 0.001),
      })));
    }, 10000);
    return () => { if (decayTimerRef.current) clearInterval(decayTimerRef.current); };
  }, []);

  // ── Recording ────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Web Audio analyser
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      analyserRef.current = an;
      setAnalyser(an);

      // MediaRecorder
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100);

      setRecordStart(Date.now());
      setRecordingState('recording');

      if (soundEnabled) { soundEngine.resume(); soundEngine.startHiss(); }
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setPermissionError(/denied|permission/i.test(message)
        ? 'Microphone access denied. Enable in browser settings.'
        : 'Could not access microphone.');
    }
  };

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || recordingState !== 'recording') return;
    setRecordingState('processing');

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const duration = Date.now() - (recordStart ?? Date.now());
      const tag = SIGNAL_TAGS[Math.floor(Math.random() * SIGNAL_TAGS.length)];

      const newSignal: UnsentSignal = {
        id: crypto.randomUUID?.() || String(Date.now()),
        signalId: generateSignalId(),
        duration,
        timestamp: new Date(),
        emotionalTag: tag,
        replayCount: 0,
        blob,
        waveformData: generateWaveform(),
        decayLevel: 0,
        isDrifted: false,
        isArchived: false,
      };

      setSignals(prev => [newSignal, ...prev]);
      void saveRecordingLocally({
        id: newSignal.id,
        label: newSignal.signalId,
        durationMs: duration,
        emotionalTag: tag,
        createdAt: Date.now(),
        blob,
      });
      mirrorRecordingUpload(blob, newSignal.signalId, duration);
      setRecordingState('idle');
      setAnalyser(null);

      if (soundEnabled) { soundEngine.stopHiss(); soundEngine.playResonancePulse(); }
      setTimeout(showWhisper, 1400);
    };

    mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
  }, [recordingState, recordStart, soundEnabled, showWhisper]);

  // ── Playback (one global audio source) ──────────────────────────────────────
  const handlePlay = useCallback((id: string) => {
    if (playingId === id) {
      globalAudio.stop();
      return;
    }

    const signal = signals.find(s => s.id === id);
    if (!signal) return;

    setSignals(prev => prev.map(s => s.id === id ? { ...s, replayCount: s.replayCount + 1 } : s));
    if (soundEnabled) soundEngine.playResonancePulse();

    const meta = { id, label: `signal ${signal.signalId}`, source: 'unsent' as const };
    if (signal.blob) {
      void globalAudio.playBlob(signal.blob, meta);
      return;
    }
    if (signal.remote) {
      void remotePlaybackUrl(signal.remote).then(url => {
        if (url) void globalAudio.playUrl(url, meta);
        else void playSample(globalAudio, meta, 'voice', signal.signalId.split('').reduce((a, c) => a + c.charCodeAt(0), 5), Math.min(signal.duration || 3000, 15000));
      });
      return;
    }
    // demo fragments murmur with a seeded synthetic voice
    void playSample(globalAudio, meta, 'voice', signal.signalId.split('').reduce((a, c) => a + c.charCodeAt(0), 5), Math.min(signal.duration || 3000, 15000));
  }, [playingId, signals, soundEnabled, globalAudio]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback((id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, isArchived: false } : s));
    const signal = signals.find(s => s.id === id);
    if (signal) saveToLibrary('audio', id, `unsent ${signal.signalId.toLowerCase()}`);
  }, [signals, saveToLibrary]);

  const handleDrift = useCallback((id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, isDrifted: true } : s));
    setTimeout(showWhisper, 800);
  }, [showWhisper]);

  const handleExport = useCallback((id: string) => {
    const signal = signals.find(s => s.id === id);
    if (signal) setExportTarget(signal);
  }, [signals]);

  const handleArchive = useCallback((id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, isArchived: true } : s));
    const signal = signals.find(s => s.id === id);
    if (signal) archiveEntry('audio', `unsent ${signal.signalId}`);
  }, [signals, archiveEntry]);

  const handleDelete = useCallback((id: string) => {
    if (playingId === id) globalAudio.stop();
    const signal = signals.find(s => s.id === id);
    if (signal?.remote) mirrorRecordingDelete({ id: signal.remote.audioId, bucket: signal.remote.bucket, path: signal.remote.path });
    setSignals(prev => prev.filter(s => s.id !== id));
    void deleteLocalRecording(id);
  }, [playingId, globalAudio, signals]);

  const handleExportDownload = useCallback(async () => {
    if (!exportTarget) return;
    const blob = await renderStoryImage({
      handle: exportTarget.signalId.toLowerCase(),
      caption: 'messages that never found a destination.',
      duration: formatDuration(exportTarget.duration),
      typeLabel: `unsent room · ${exportTarget.emotionalTag.replace('-', ' ')}`,
      accentColor: '#ff1493',
      waveformSeed: Math.round((exportTarget.waveformData[0] ?? 0.5) * 9973),
    });
    if (blob) downloadBlob(blob, exportFilename(exportTarget.signalId, 'image'));
    setExportTarget(null);
  }, [exportTarget]);

  // ── Toggle recording ─────────────────────────────────────────────────────────
  const handleOrbClick = () => {
    if (recordingState === 'idle') startRecording();
    else if (recordingState === 'recording') stopRecording();
  };

  // ── Filtered signals ─────────────────────────────────────────────────────────
  const filteredSignals = signals.filter(s => {
    if (filter === 'all') return !s.isArchived;
    if (filter === 'saved') return !s.isArchived && !s.isDrifted;
    if (filter === 'drifted') return s.isDrifted;
    if (filter === 'archived') return s.isArchived;
    return true;
  });

  const counts: Record<FilterMode, number> = {
    all: signals.filter(s => !s.isArchived).length,
    saved: signals.filter(s => !s.isArchived && !s.isDrifted).length,
    drifted: signals.filter(s => s.isDrifted).length,
    archived: signals.filter(s => s.isArchived).length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="ur-shell">
      {/* Atmospheric background */}
      <div className="ur-atmosphere" aria-hidden>
        <div className="ur-fog-layer" />
        <div className="ur-crt-texture" />
        <div className="ur-scanline" />
        <div className="ur-vignette" />
      </div>

      <ParticleField recording={recordingState === 'recording'} />
      <WhisperDisplay whispers={whispers} />

      {/* Page header */}
      <header className="ur-header">
        <div className="ur-header-copy">
          <p className="ur-header-eyebrow">ECOSPHERE / PRIVATE CHANNEL</p>
          <h1 className="ur-title">UNSENT ROOM</h1>
          <p className="ur-subtitle">"messages that never found a destination."</p>
          <p className="ur-ambient-text">some signals were never meant to arrive.</p>
        </div>
        <div className="ur-header-controls">
          <button
            className={`ur-sound-toggle ${soundEnabled ? 'active' : ''}`}
            onClick={() => {
              if (!soundEnabled) { soundEngine.init(); soundEngine.resume(); }
              setSoundEnabled(s => !s);
            }}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'Disable atmospheric sound' : 'Enable atmospheric sound'}
          >
            {soundEnabled ? '◉ SOUND ON' : '○ SOUND OFF'}
          </button>
          <div className="ur-signal-count">
            <span>{signals.length}</span>
            <small>signals stored</small>
          </div>
        </div>
      </header>

      {/* Recording section */}
      <section className="ur-recording-section" aria-label="Recording interface">
        <RecordingOrb
          state={recordingState}
          analyser={analyser}
          onClick={handleOrbClick}
        />
        <RecordingTimer startTime={recordStart} active={recordingState === 'recording'} />
        {permissionError && (
          <p className="ur-permission-error" role="alert">{permissionError}</p>
        )}
        <p className="ur-record-hint">
          {recordingState === 'idle' && 'press to begin your transmission'}
          {recordingState === 'recording' && 'recording… speak into the void'}
          {recordingState === 'processing' && 'processing signal…'}
        </p>
      </section>

      {/* EcosphereVR v4 voice reactions system */}
      <section className="ur-archive-section ur-vr-section" aria-label="Voice reactions system">
        <div className="ur-archive-header">
          <div className="ur-archive-title-row">
            <h2 className="ur-archive-title">VOICE REACTIONS</h2>
            <span className="ur-archive-count">live system</span>
          </div>
        </div>
        <EcosphereVRPanel />
      </section>

      {/* Infinite anonymous feed */}
      <UnsentFeed />

      {/* Signal archive */}
      <section className="ur-archive-section" aria-label="Signal archive">
        <div className="ur-archive-header">
          <div className="ur-archive-title-row">
            <h2 className="ur-archive-title">SIGNAL ARCHIVE</h2>
            <span className="ur-archive-count">{filteredSignals.length} fragments</span>
          </div>
          <FilterBar active={filter} counts={counts} onChange={setFilter} />
        </div>

        {filteredSignals.length === 0 ? (
          <div className="ur-empty-state">
            <div className="ur-empty-orb" aria-hidden />
            <p>no signals in this channel.</p>
            <small>record something. leave it unsent.</small>
          </div>
        ) : (
          <div className="ur-signal-grid">
            {filteredSignals.map(signal => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onPlay={handlePlay}
                onSave={handleSave}
                onDrift={handleDrift}
                onExport={handleExport}
                onArchive={handleArchive}
                onDelete={handleDelete}
                isPlaying={playingId === signal.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Export overlay */}
      {exportTarget && (
        <ExportOverlay
          signal={exportTarget}
          onClose={() => setExportTarget(null)}
          onDownload={handleExportDownload}
        />
      )}
    </div>
  );
};

export default UnsentRoom;
