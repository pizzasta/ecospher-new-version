import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import './ProfileScene.css'

// 3D profile backgrounds — pure CSS perspective scenes tinted with the
// owner's colors. Three designs: a synthwave floor grid, a depth starfield,
// and a wormhole of receding rings. No WebGL, no libraries, reduced-motion
// safe — they have to run on a tired phone at 3am.

export type SceneDesign = 'grid' | 'stars' | 'tunnel'

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
