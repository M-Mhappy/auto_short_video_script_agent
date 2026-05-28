import { useMemo } from 'react'
import type { SceneType, MoodType, MotionType } from './types'

interface Props {
  scene?: SceneType
  mood: MoodType
  motion?: MotionType
  stepIndex: number
}

const MOOD_SCENE_DEFAULTS: Partial<Record<MoodType, SceneType>> = {
  dramatic: 'void',
  warm: 'book',
  tense: 'city',
  mysterious: 'silhouette',
  playful: 'nature',
  calm: 'archive',
}

function motionDuration(motion?: MotionType): number {
  if (motion === 'strong') return 8
  if (motion === 'medium') return 14
  return 22
}

function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

/* ── Book: pages, spine, text lines ─── */
function BookScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const lines = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    w: 30 + r() * 50,
    y: 20 + i * 10,
    delay: i * 0.4,
  })), [r])

  return (
    <g className="scene-book">
      {/* Pages stack */}
      <rect x="600" y="250" width="720" height="580" rx="6" className="scene-book-page" style={{ animationDuration: `${dur}s` }} />
      <rect x="610" y="260" width="700" height="560" rx="4" className="scene-book-page-inner" />
      {/* Spine line */}
      <line x1="960" y1="250" x2="960" y2="830" className="scene-book-spine" />
      {/* Text lines on right page */}
      {lines.map((l, i) => (
        <rect
          key={i}
          x={990}
          y={l.y * 5 + 100}
          width={l.w * 5}
          height={4}
          rx={2}
          className="scene-book-line"
          style={{ animationDelay: `${l.delay}s`, animationDuration: `${dur * 0.6}s` }}
        />
      ))}
      {/* Page turning hint */}
      <path d="M1300,260 Q1340,540 1300,820" className="scene-book-curl" style={{ animationDuration: `${dur}s` }} />
    </g>
  )
}

/* ── Archive: cards, annotation lines, stamp ─── */
function ArchiveScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const cards = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    x: 300 + i * 440,
    y: 300 + r() * 100,
    rot: -5 + r() * 10,
    delay: i * 0.6,
  })), [r])

  return (
    <g className="scene-archive">
      {cards.map((c, i) => (
        <g key={i} transform={`translate(${c.x},${c.y}) rotate(${c.rot})`}>
          <rect width="380" height="280" rx="8" className="scene-archive-card" style={{ animationDelay: `${c.delay}s`, animationDuration: `${dur}s` }} />
          {/* Horizontal annotation lines */}
          {[0, 1, 2, 3].map(j => (
            <rect key={j} x={30} y={60 + j * 50} width={200 + r() * 100} height={3} rx={1.5} className="scene-archive-line" style={{ animationDelay: `${c.delay + j * 0.2}s` }} />
          ))}
        </g>
      ))}
      {/* Red stamp circle */}
      <circle cx="1500" cy="780" r="60" className="scene-archive-stamp" style={{ animationDuration: `${dur}s` }} />
    </g>
  )
}

/* ── Timeline: horizontal axis with nodes ─── */
function TimelineScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const nodes = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    x: 250 + i * 320,
    active: i <= 2,
    delay: i * 0.5,
    height: 30 + r() * 60,
  })), [r])

  return (
    <g className="scene-timeline">
      {/* Main axis */}
      <line x1="200" y1="540" x2="1720" y2="540" className="scene-timeline-axis" />
      {nodes.map((n, i) => (
        <g key={i}>
          {/* Vertical bar */}
          <rect x={n.x - 3} y={540 - n.height} width={6} height={n.height} rx={3} className={`scene-timeline-bar ${n.active ? 'active' : ''}`} style={{ animationDelay: `${n.delay}s`, animationDuration: `${dur}s` }} />
          {/* Node dot */}
          <circle cx={n.x} cy={540} r={n.active ? 10 : 6} className={`scene-timeline-dot ${n.active ? 'active' : ''}`} style={{ animationDelay: `${n.delay}s` }} />
        </g>
      ))}
    </g>
  )
}

/* ── Silhouette: walking figure ─── */
function SilhouetteScene({ dur }: { dur: number }) {
  return (
    <g className="scene-silhouette">
      {/* Ground line */}
      <line x1="0" y1="850" x2="1920" y2="850" className="scene-sil-ground" />
      {/* Person silhouette (simplified) */}
      <g className="scene-sil-figure" style={{ animationDuration: `${dur}s` }}>
        {/* Head */}
        <circle cx="960" cy="650" r="35" />
        {/* Body */}
        <line x1="960" y1="685" x2="960" y2="790" strokeWidth="6" strokeLinecap="round" />
        {/* Left arm */}
        <line x1="960" y1="720" x2="925" y2="760" strokeWidth="5" strokeLinecap="round" />
        {/* Right arm */}
        <line x1="960" y1="720" x2="995" y2="760" strokeWidth="5" strokeLinecap="round" />
        {/* Left leg */}
        <line x1="960" y1="790" x2="935" y2="850" strokeWidth="5" strokeLinecap="round" />
        {/* Right leg */}
        <line x1="960" y1="790" x2="985" y2="850" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* Shadow */}
      <ellipse cx="960" cy="855" rx="40" ry="6" className="scene-sil-shadow" style={{ animationDuration: `${dur}s` }} />
    </g>
  )
}

/* ── City: skyline with lit windows ─── */
function CityScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const buildings = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    x: i * 160,
    w: 80 + r() * 80,
    h: 200 + r() * 400,
    windows: Array.from({ length: Math.floor(3 + r() * 5) }, () => ({
      wy: r() * 0.8,
      wx: 0.15 + r() * 0.6,
      lit: r() > 0.4,
      delay: r() * 8,
    })),
  })), [r])

  return (
    <g className="scene-city" style={{ animationDuration: `${dur * 2}s` }}>
      {buildings.map((b, i) => (
        <g key={i} transform={`translate(${b.x}, ${880 - b.h})`}>
          <rect width={b.w} height={b.h} className="scene-city-building" />
          {b.windows.map((w, j) => (
            <rect
              key={j}
              x={w.wx * b.w}
              y={w.wy * b.h}
              width={12}
              height={16}
              rx={1}
              className={`scene-city-window ${w.lit ? 'lit' : ''}`}
              style={{ animationDelay: `${w.delay}s`, animationDuration: `${3 + r() * 4}s` }}
            />
          ))}
        </g>
      ))}
    </g>
  )
}

/* ── Nature: trees, rain, leaves ─── */
function NatureScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const raindrops = useMemo(() => Array.from({ length: 30 }, () => ({
    x: r() * 1920,
    delay: r() * 5,
    len: 20 + r() * 30,
    speed: 1.5 + r() * 2,
  })), [r])
  const leaves = useMemo(() => Array.from({ length: 6 }, () => ({
    x: r() * 1920,
    y: 200 + r() * 400,
    size: 15 + r() * 20,
    delay: r() * 10,
    drift: 60 + r() * 100,
  })), [r])

  return (
    <g className="scene-nature">
      {/* Tree silhouettes */}
      <path d="M200,880 L200,600 Q150,500 100,600 Q80,480 200,400 Q320,480 300,600 Q250,500 200,600 Z" className="scene-nature-tree" />
      <path d="M1700,880 L1700,650 Q1650,550 1600,650 Q1580,530 1700,450 Q1820,530 1800,650 Q1750,550 1700,650 Z" className="scene-nature-tree" style={{ animationDelay: '1s' }} />
      {/* Rain */}
      {raindrops.map((d, i) => (
        <line
          key={i}
          x1={d.x} y1={0} x2={d.x - 10} y2={d.len}
          className="scene-nature-rain"
          style={{ animationDelay: `${d.delay}s`, animationDuration: `${d.speed}s` }}
        />
      ))}
      {/* Floating leaves */}
      {leaves.map((l, i) => (
        <ellipse
          key={`l${i}`}
          cx={l.x} cy={l.y}
          rx={l.size} ry={l.size * 0.5}
          className="scene-nature-leaf"
          style={{
            animationDelay: `${l.delay}s`,
            animationDuration: `${dur}s`,
            ['--leaf-drift' as string]: `${l.drift}px`,
          }}
        />
      ))}
    </g>
  )
}

/* ── Void: fog, floating paper scraps ─── */
function VoidScene({ dur, seed }: { dur: number; seed: number }) {
  const r = useMemo(() => seeded(seed), [seed])
  const scraps = useMemo(() => Array.from({ length: 8 }, () => ({
    x: r() * 1920,
    y: 200 + r() * 600,
    w: 20 + r() * 40,
    h: 15 + r() * 25,
    rot: r() * 360,
    delay: r() * 15,
    driftX: -50 + r() * 100,
    driftY: -30 + r() * 60,
  })), [r])

  return (
    <g className="scene-void">
      {/* Fog layers */}
      <ellipse cx="960" cy="540" rx="800" ry="300" className="scene-void-fog fog1" style={{ animationDuration: `${dur * 1.5}s` }} />
      <ellipse cx="600" cy="640" rx="600" ry="200" className="scene-void-fog fog2" style={{ animationDuration: `${dur * 1.2}s` }} />
      {/* Paper scraps */}
      {scraps.map((s, i) => (
        <rect
          key={i}
          x={s.x} y={s.y}
          width={s.w} height={s.h}
          rx={2}
          transform={`rotate(${s.rot},${s.x + s.w / 2},${s.y + s.h / 2})`}
          className="scene-void-scrap"
          style={{
            animationDelay: `${s.delay}s`,
            animationDuration: `${dur}s`,
            ['--scrap-dx' as string]: `${s.driftX}px`,
            ['--scrap-dy' as string]: `${s.driftY}px`,
          }}
        />
      ))}
    </g>
  )
}

const SCENE_MAP: Record<SceneType, React.FC<{ dur: number; seed: number }>> = {
  book: BookScene,
  archive: ArchiveScene,
  timeline: TimelineScene,
  silhouette: SilhouetteScene,
  city: CityScene,
  nature: NatureScene,
  void: VoidScene,
}

export default function SceneLayer({ scene, mood, motion, stepIndex }: Props) {
  const resolvedScene = scene || MOOD_SCENE_DEFAULTS[mood] || 'book'
  const dur = motionDuration(motion)
  const SceneComp = SCENE_MAP[resolvedScene] || SCENE_MAP.book

  return (
    <svg
      className="pres-scene-layer"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <SceneComp dur={dur} seed={stepIndex * 97 + 13} />
    </svg>
  )
}
