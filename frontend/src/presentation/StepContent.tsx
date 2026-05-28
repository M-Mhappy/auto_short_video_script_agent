import type { PresentationStep, VisualElement } from './types'

interface Props {
  step: PresentationStep
}

function animClass(animate: string): string {
  switch (animate) {
    case 'fly-in': return 'pres-anim-fly-in'
    case 'typewriter': return 'pres-anim-typewriter'
    case 'none': return ''
    default: return 'pres-anim-fade-in'
  }
}

function ElementRenderer({ el, index }: { el: VisualElement; index: number }) {
  const delay = { animationDelay: `${index * 0.2 + 0.3}s` }

  switch (el.kind) {
    case 'number': {
      const match = el.content.match(/^(\d+)(.*)$/)
      const num = match?.[1] || el.content
      const label = match?.[2]?.trim() || el.role
      return (
        <div className="pres-el-number pres-anim-scale-in" style={delay}>
          <span className="pres-el-number-badge">{num}</span>
          {label && <span className="pres-el-number-label">{label}</span>}
        </div>
      )
    }
    case 'icon':
      return (
        <div className={`pres-el-icon-tag pres-anim-scale-in`} style={delay}>
          <span className="pres-el-icon-dot" />
          <span className="pres-el-icon-label">{el.content}</span>
        </div>
      )
    case 'quote':
      return (
        <div className={`pres-el-inline-quote ${animClass(el.animate)}`} style={delay}>
          {el.content}
        </div>
      )
    default:
      return (
        <span className={`pres-element-content ${animClass(el.animate)}`} style={delay}>
          {el.content}
        </span>
      )
  }
}

function RevealRenderer({ step }: Props) {
  const { headline, subhead, visual } = step.screen
  return (
    <div className="pres-reveal">
      {headline && (
        <h1 className="pres-reveal-headline pres-anim-fade-in">{headline}</h1>
      )}
      {subhead && (
        <p className="pres-reveal-subhead pres-anim-fade-in" style={{ animationDelay: '0.15s' }}>{subhead}</p>
      )}
      <div className="pres-reveal-elements">
        {visual.elements.map((el, i) => (
          <div key={i} className="pres-reveal-element">
            <ElementRenderer el={el} index={i} />
          </div>
        ))}
      </div>
    </div>
  )
}

function QuoteRenderer({ step }: Props) {
  const { visual, subhead } = step.screen
  const quoteEl = visual.elements.find(e => e.kind === 'quote') || visual.elements[0]
  return (
    <div className="pres-quote-wrap pres-anim-fade-in">
      <blockquote className="pres-quote-text">
        {quoteEl?.content || step.narration}
      </blockquote>
      {subhead && <p className="pres-quote-source">{subhead}</p>}
    </div>
  )
}

function ListRenderer({ step }: Props) {
  const { headline, visual } = step.screen
  return (
    <div className="pres-list">
      {headline && <p className="pres-list-heading pres-anim-fade-in">{headline}</p>}
      {visual.elements.map((el, i) => (
        <div
          key={i}
          className={`pres-list-row ${animClass(el.animate)}`}
          style={{ animationDelay: `${i * 0.15 + 0.2}s` }}
        >
          <span className="pres-list-bullet">
            {el.kind === 'number' ? el.content.match(/^\d+/)?.[0] || `${i + 1}` : (el.role || `${i + 1}`)}
          </span>
          <span className="pres-list-text">
            {el.kind === 'number' ? el.content.replace(/^\d+\s*/, '') : el.content}
          </span>
        </div>
      ))}
    </div>
  )
}

const RENDERERS: Record<string, React.FC<Props>> = {
  reveal: RevealRenderer,
  quote: QuoteRenderer,
  list: ListRenderer,
}

export default function StepContent({ step }: Props) {
  const vtype = step.screen?.visual?.type || 'reveal'
  const mood = step.screen?.visual?.mood || 'calm'
  const Renderer = RENDERERS[vtype] || RevealRenderer

  return (
    <div
      key={`${step.step}-${step.chapter_title}`}
      className={`presentation-step-enter pres-mood-${mood}`}
    >
      <p className="pres-chapter-tag">{step.chapter_title}</p>
      <Renderer step={step} />
    </div>
  )
}
