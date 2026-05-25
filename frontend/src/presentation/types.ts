export type PresentationStepType = 'hero' | 'text' | 'quote' | 'list_item'

export interface PresentationStep {
  type: PresentationStepType
  chapter_title: string
  narration: string
  title?: string
  subtitle?: string
  body?: string
  quote?: string
  list_title?: string
  item_index?: number | string
  item_text?: string
}

export interface PresentationData {
  book: { title: string; author: string }
  steps: PresentationStep[]
  step_count: number
  has_audio: boolean
}
