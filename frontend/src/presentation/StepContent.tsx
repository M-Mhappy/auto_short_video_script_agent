import type { PresentationStep } from './types'

interface Props {
  step: PresentationStep
}

export default function StepContent({ step }: Props) {
  return (
    <div key={`${step.type}-${step.chapter_title}`} className="presentation-step-enter">
      <p className="pres-chapter-tag">{step.chapter_title}</p>
      {step.type === 'hero' && (
        <>
          <h1 className="pres-hero-title">{step.title || step.chapter_title}</h1>
          {step.subtitle && <p className="pres-hero-sub">{step.subtitle}</p>}
        </>
      )}
      {step.type === 'text' && (
        <p className="pres-body">{step.body || step.narration}</p>
      )}
      {step.type === 'quote' && (
        <blockquote className="pres-quote">{step.quote || step.narration}</blockquote>
      )}
      {step.type === 'list_item' && (
        <>
          {step.list_title && <p className="pres-list-title">{step.list_title}</p>}
          <p className="pres-list-item">
            {step.item_index != null && (
              <span className="pres-list-index">{step.item_index}.</span>
            )}
            {step.item_text || step.narration}
          </p>
        </>
      )}
    </div>
  )
}
