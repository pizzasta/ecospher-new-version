import type { CSSProperties } from 'react'
import './EcosphereAmbience.css'

type ColorWaveProps = {
  /** up to three wave colors; defaults to the app palette */
  colors?: [string, string?, string?]
  /** 'fixed' covers the viewport (ambience); 'local' fills the parent */
  variant?: 'fixed' | 'local'
}

/**
 * Flowing gradient: three blurred blobs crossing on different clocks,
 * screen-blended so colors melt where they meet. Transform-only.
 */
export default function ColorWave({ colors, variant = 'fixed' }: ColorWaveProps) {
  const style = colors
    ? ({
        '--wave-c1': colors[0],
        '--wave-c2': colors[1] ?? colors[0],
        '--wave-c3': colors[2] ?? colors[1] ?? colors[0],
      } as CSSProperties)
    : undefined

  return (
    <div className={`eco-color-wave${variant === 'local' ? ' eco-color-wave--local' : ''}`} aria-hidden="true" style={style}>
      <span /><span /><span />
    </div>
  )
}
