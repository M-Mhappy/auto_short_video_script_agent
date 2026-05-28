import { useMemo } from 'react'
import type { MoodType } from './types'

interface Props {
  mood: MoodType
  stepIndex: number
}

const MOOD_CONFIGS: Record<MoodType, { colors: string[]; orbCount: number }> = {
  calm:       { colors: ['rgba(107,159,255,0.12)', 'rgba(107,159,255,0.06)'],  orbCount: 3 },
  dramatic:   { colors: ['rgba(231,76,60,0.15)',  'rgba(192,57,43,0.08)'],    orbCount: 5 },
  warm:       { colors: ['rgba(232,176,74,0.14)', 'rgba(211,84,0,0.06)'],     orbCount: 4 },
  tense:      { colors: ['rgba(230,126,34,0.13)', 'rgba(192,57,43,0.07)'],    orbCount: 5 },
  playful:    { colors: ['rgba(46,204,113,0.12)', 'rgba(52,152,219,0.08)'],   orbCount: 4 },
  mysterious: { colors: ['rgba(155,89,182,0.14)', 'rgba(142,68,173,0.07)'],   orbCount: 4 },
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

export default function VisualBackdrop({ mood, stepIndex }: Props) {
  const config = MOOD_CONFIGS[mood] || MOOD_CONFIGS.calm
  const rand = useMemo(() => seededRandom(stepIndex * 137 + 42), [stepIndex])

  const orbs = useMemo(() => {
    const r = rand
    return Array.from({ length: config.orbCount }, (_, i) => ({
      id: i,
      x: r() * 100,
      y: r() * 100,
      size: 200 + r() * 500,
      color: config.colors[i % config.colors.length],
      duration: 12 + r() * 18,
      delay: r() * -20,
    }))
  }, [config, rand])

  return (
    <div className="pres-backdrop" aria-hidden>
      {/* Radial vignette */}
      <div className="pres-backdrop-vignette" />

      {/* Floating gradient orbs */}
      {orbs.map(orb => (
        <div
          key={orb.id}
          className="pres-backdrop-orb"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}

      {/* Subtle grid lines */}
      <div className="pres-backdrop-grid" />

      {/* Accent glow at bottom */}
      <div className="pres-backdrop-glow" />
    </div>
  )
}
