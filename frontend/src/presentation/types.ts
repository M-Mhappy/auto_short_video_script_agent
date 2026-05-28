/* ── Visual step types ─── */

export type VisualType = 'reveal' | 'quote' | 'list'
export type AnimationType = 'fade-in' | 'fly-in' | 'typewriter' | 'none'
export type MoodType = 'calm' | 'tense' | 'dramatic' | 'playful' | 'warm' | 'mysterious'
export type SceneType = 'book' | 'archive' | 'timeline' | 'silhouette' | 'city' | 'nature' | 'void'
export type MotionType = 'slow' | 'medium' | 'strong'

export interface VisualElement {
  kind: 'text' | 'number' | 'quote' | 'icon'
  content: string
  role: string
  animate: AnimationType
}

export interface ScreenVisual {
  type: VisualType
  elements: VisualElement[]
  mood: MoodType
  scene?: SceneType
  motion?: MotionType
}

export interface StepScreen {
  headline: string
  subhead: string
  visual: ScreenVisual
}

export interface PresentationStep {
  step: number
  chapter_title: string
  narration: string
  screen: StepScreen
  /* Legacy fields kept for backward compat during normalize */
  type?: string
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
