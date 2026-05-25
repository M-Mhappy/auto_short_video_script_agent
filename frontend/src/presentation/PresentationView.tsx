import { useEffect, useRef } from 'react'
import type { PresentationData } from './types'
import { useStepper } from './useStepper'
import StepStage, { useStageScale } from './StepStage'
import { getPresentationAudioUrl } from '../api'
import './presentation.css'

interface Props {
  sessionId: string
  data: PresentationData
  autoPlay: boolean
  onClose: () => void
}

const AUTO_FALLBACK_MS = 3000

export default function PresentationView({
  sessionId,
  data,
  autoPlay,
  onClose,
}: Props) {
  const steps = data.steps
  const total = steps.length
  const { index, goNext, isLast, autoAdvance } = useStepper(total, autoPlay)
  const { scale } = useStageScale()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleAdvance = () => {
    if (!isLast) goNext()
  }

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (!autoAdvance || isLast) return

    const playAndAdvance = () => {
      if (data.has_audio) {
        const audio = new Audio(getPresentationAudioUrl(sessionId, index))
        audioRef.current = audio
        audio.onended = () => {
          if (!isLast) goNext()
        }
        audio.onerror = () => {
          timerRef.current = setTimeout(() => goNext(), AUTO_FALLBACK_MS)
        }
        audio.play().catch(() => {
          timerRef.current = setTimeout(() => goNext(), AUTO_FALLBACK_MS)
        })
      } else {
        timerRef.current = setTimeout(() => goNext(), AUTO_FALLBACK_MS)
      }
    }

    playAndAdvance()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [index, autoAdvance, data.has_audio, sessionId, isLast, goNext])

  const progress = total > 0 ? ((index + 1) / total) * 100 : 0
  const step = steps[index]

  if (!step) return null

  return (
    <div className="presentation-root">
      <div className="presentation-chrome">
        <div className="text-sm opacity-80">
          {data.book.title}
          {data.book.author && ` · ${data.book.author}`}
        </div>
        <div className="flex gap-2 items-center">
          {autoPlay && (
            <span className="text-xs px-2 py-1 rounded bg-white/10">自动播放</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20"
          >
            退出演示
          </button>
        </div>
      </div>

      <StepStage step={step} scale={scale} onAdvance={handleAdvance} />

      <div className="presentation-progress">
        <div className="flex justify-between text-xs mb-2 opacity-70">
          <span>
            {index + 1} / {total} · {step.chapter_title}
          </span>
          <span>空格/点击下一步 · ← 上一步</span>
        </div>
        <div className="presentation-progress-bar">
          <div
            className="presentation-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
