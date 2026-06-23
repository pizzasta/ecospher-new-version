import './CalibrationScreen.css'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

const waveformBars = 34
const particles = 18

export default function CalibrationScreen() {
  const [isRecording, setIsRecording] = useState(false)
  const [answer, setAnswer] = useState('')

  const waveform = useMemo(
    () =>
      Array.from({ length: waveformBars }, (_, index) => ({
        delay: `${index * 48}ms`,
        height: `${26 + ((index * 17 + 31) % 58)}%`,
      })),
    [],
  )

  return (
    <section className={`calibration-screen ${isRecording ? 'is-recording' : ''}`} aria-label="Calibration phase">
      <div className="calibration-screen__grid" aria-hidden="true" />
      <div className="calibration-screen__aura" aria-hidden="true" />
      <div className="calibration-screen__noise" aria-hidden="true" />

      <div className="calibration-screen__particles" aria-hidden="true">
        {Array.from({ length: particles }, (_, index) => (
          <span
            key={index}
            style={
              {
                '--calibration-delay': `${index * 260}ms`,
                '--calibration-left': `${(index * 23 + 11) % 100}%`,
                '--calibration-top': `${(index * 31 + 19) % 100}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="calibration-screen__content"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="calibration-screen__phase">CALIBRATION PHASE // 01 OF 03</p>
        <h1>What does midnight sound like to you?</h1>

        <div className="calibration-screen__waveform" aria-hidden="true">
          {waveform.map((bar, index) => (
            <i
              key={index}
              style={
                {
                  '--calibration-wave-delay': bar.delay,
                  '--calibration-wave-height': bar.height,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <button
          aria-pressed={isRecording}
          className="calibration-screen__mic"
          onClick={() => setIsRecording((current) => !current)}
          type="button"
        >
          <span />
          <b>{isRecording ? 'LISTENING' : 'TAP TO SPEAK'}</b>
        </button>

        <label className="calibration-screen__input">
          <span>or type the frequency</span>
          <textarea
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="midnight sounds like..."
            rows={3}
            value={answer}
          />
        </label>

        <p className="calibration-screen__status">
          {isRecording ? 'subtle waveform detected // hold the thought there' : answer ? 'text signal held locally // no upload connected' : 'no backend connected // calibration is local only'}
        </p>
      </motion.div>
    </section>
  )
}
