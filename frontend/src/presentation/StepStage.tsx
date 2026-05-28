import { useEffect, useRef, useState } from 'react'
import type { PresentationStep } from './types'
import StepContent from './StepContent'
import VisualBackdrop from './VisualBackdrop'
import SceneLayer from './SceneLayer'

interface Props {
  step: PresentationStep
  scale: number
  onAdvance: () => void
}

export default function StepStage({ step, scale, onAdvance }: Props) {
  const visual = step.screen?.visual
  const mood = visual?.mood || 'calm'

  return (
    <div className="presentation-stage-wrap" onClick={onAdvance}>
      <div
        className="presentation-stage pres-stage-zoom"
        style={{ transform: `scale(${scale})` }}
      >
        <VisualBackdrop mood={mood} stepIndex={step.step} />
        <SceneLayer
          scene={visual?.scene}
          mood={mood}
          motion={visual?.motion}
          stepIndex={step.step}
        />
        <StepContent step={step} />
      </div>
    </div>
  )
}

export function useStageScale() {
  const [scale, setScale] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setScale(Math.min(w / 1920, h / 1080))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return { scale, wrapRef }
}
