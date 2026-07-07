import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { GradientStyle } from '../lib/frequencyGradient'
import './ProfileScene.css'

// 3D profile backgrounds — pure CSS perspective scenes tinted with the
// owner's colors: a synthwave floor grid, a depth starfield, a wormhole of
// receding rings, flowing aurora, rain on glass, and a rotating mesh. No WebGL,
// no libraries, reduced-motion safe — they have to run on a tired phone at 3am.

export type SceneDesign = Exclude<GradientStyle, 'gradient' | 'wave'>

interface ProfileSceneProps {
  design: SceneDesign
  /** [start, end, accent] — gradient colors + hz signature color */
  colors: [string, string, string]
}

function seededRandom(seed: number) {
  let state = (seed * 2654435761) % 0x7fffffff || 7
  return () => {
    state = (state * 1103515245 + 12345) % 0x7fffffff
    return state / 0x7fffffff
  }
}

export default function ProfileScene({ design, colors }: ProfileSceneProps) {
  const [c1, c2, c3] = colors

  const stars = useMemo(() => {
    const rand = seededRandom(design === 'stars' ? 97 : 31)
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: 1 + rand() * 2.4,
      dur: 5 + rand() * 9,
      delay: -rand() * 14,
      tint: i % 3,
    }))
  }, [design])

  const vars = { '--ps-c1': c1, '--ps-c2': c2, '--ps-c3': c3 } as CSSProperties

  if (design === 'grid') {
    return (
      <div className="ph-scene ph-scene--grid" style={vars} aria-hidden="true">
        <div className="ps-grid-sky" />
        <div className="ps-grid-sun" />
        <div className="ps-grid-floor"><i /></div>
        <div className="ps-grid-horizon" />
      </div>
    )
  }

  if (design === 'tunnel') {
    return (
      <div className="ph-scene ph-scene--tunnel" style={vars} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className={`ps-ring ps-ring--${i % 3}`}
            style={{ animationDelay: `${-(i * 1.4)}s` }}
          />
        ))}
        <div className="ps-tunnel-core" />
      </div>
    )
  }

  if (design === 'aurora') {
    return (
      <div className="ph-scene ph-scene--aurora" style={vars} aria-hidden="true">
        <span className="ps-aurora ps-aurora--a" />
        <span className="ps-aurora ps-aurora--b" />
        <span className="ps-aurora ps-aurora--c" />
        <div className="ps-aurora-stars">
          {stars.slice(0, 30).map(star => (
            <i key={star.id} style={{ left: `${star.x}%`, top: `${star.y * 0.5}%`, animationDelay: `${star.delay}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (design === 'rain') {
    const drops = Array.from({ length: 44 }, (_, i) => ({
      id: i,
      left: (i * 37 + 7) % 100,
      dur: 0.7 + ((i * 13) % 9) * 0.12,
      delay: -((i * 17) % 30) * 0.1,
      len: 14 + ((i * 7) % 5) * 6,
    }))
    return (
      <div className="ph-scene ph-scene--rain" style={vars} aria-hidden="true">
        <div className="ps-rain-glass" />
        {drops.map(d => (
          <span
            key={d.id}
            className="ps-raindrop"
            style={{ left: `${d.left}%`, height: `${d.len}px`, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }}
          />
        ))}
      </div>
    )
  }

  if (design === 'mesh') {
    return (
      <div className="ph-scene ph-scene--mesh" style={vars} aria-hidden="true">
        <div className="ps-mesh-plane">
          {Array.from({ length: 64 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${-((i * 11) % 40) * 0.1}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (design === 'nebula') {
    return (
      <div className="ph-scene ph-scene--nebula" style={vars} aria-hidden="true">
        <span className="ps-nebula-cloud ps-nebula-cloud--a" />
        <span className="ps-nebula-cloud ps-nebula-cloud--b" />
        <span className="ps-nebula-cloud ps-nebula-cloud--c" />
        {stars.slice(0, 40).map(star => (
          <i
            key={star.id}
            className="ps-nebula-mote"
            style={{ left: `${star.x}%`, top: `${star.y}%`, animationDuration: `${star.dur}s`, animationDelay: `${star.delay}s` }}
          />
        ))}
      </div>
    )
  }

  if (design === 'pulse') {
    return (
      <div className="ph-scene ph-scene--pulse" style={vars} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="ps-pulse-ring" style={{ animationDelay: `${-(i * 1.6)}s` }} />
        ))}
        <span className="ps-pulse-core" />
      </div>
    )
  }

  return (
    <div className="ph-scene ph-scene--stars" style={vars} aria-hidden="true">
      {stars.map(star => (
        <span
          key={star.id}
          className={`ps-star ps-star--${star.tint}`}
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: `${star.dur}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
      <div className="ps-star-nebula" />
    </div>
  )
}
