import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PresentationData } from './types'
import { normalizeStep } from './normalizeStep'
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
  const steps = useMemo(() => data.steps.map((s, i) => normalizeStep(s, i)), [data.steps])
  const total = steps.length
  const { index, goNext, isLast, autoAdvance } = useStepper(total, autoPlay)
  const { scale } = useStageScale()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [gateVisible, setGateVisible] = useState(autoPlay)
  const [showGuide, setShowGuide] = useState(false)

  const dismissGate = useCallback(() => {
    setGateVisible(false)
  }, [])

  useEffect(() => {
    if (!gateVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); dismissGate() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gateVisible, dismissGate])

  const handleAdvance = () => {
    if (!isLast) goNext()
  }

  useEffect(() => {
    if (gateVisible) return

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
  }, [index, autoAdvance, data.has_audio, sessionId, isLast, goNext, gateVisible])

  const progress = total > 0 ? ((index + 1) / total) * 100 : 0
  const step = steps[index]

  if (!step) return null

  return (
    <div className="presentation-root">
      {/* AutoStartGate */}
      {gateVisible && (
        <div className="pres-gate-overlay" onClick={dismissGate}>
          <p className="pres-gate-title">准备开始演示</p>
          <p className="pres-gate-hint">
            {data.has_audio
              ? '按 SPACE 开始自动播放（建议先开启录屏工具）'
              : '按 SPACE 开始，点击或空格推进下一步'}
          </p>
        </div>
      )}

      {/* Chrome */}
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
            onClick={(e) => { e.stopPropagation(); setShowGuide(v => !v) }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20"
          >
            导出视频
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20"
          >
            退出演示
          </button>
        </div>
      </div>

      {/* Recording guide overlay */}
      {showGuide && (
        <div className="pres-gate-overlay" onClick={() => setShowGuide(false)}>
          <div
            className="max-w-lg bg-white/10 backdrop-blur-md rounded-2xl p-8 text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">如何导出视频</h3>
            <div>
              <p className="font-semibold mb-2">方案一：AI 配音 + 自动录屏（推荐）</p>
              <ol className="list-decimal list-inside space-y-1 text-sm opacity-90">
                <li>先生成「演示配音」</li>
                <li>打开 OBS Studio 或 QuickTime</li>
                <li>浏览器全屏（F11）</li>
                <li>点击「自动播放演示」</li>
                <li>开始录屏 → 按 SPACE → 自动播完 → 停止录制</li>
                <li>裁掉头尾 → 完成</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold mb-2">方案二：自行配音</p>
              <ol className="list-decimal list-inside space-y-1 text-sm opacity-90">
                <li>下载「配音稿」（逐步标注口播文本）</li>
                <li>OBS 录屏，手动点击推进</li>
                <li>用剪映/PR 按配音稿逐句配音</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-2 px-4 py-2 text-sm rounded-lg bg-white/20 hover:bg-white/30"
            >
              知道了
            </button>
          </div>
        </div>
      )}

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
