import type { PresentationStep, StepScreen } from './types'

/**
 * Ensure a step (possibly old hero/text/quote/list_item format)
 * always has a valid `screen` object for the new renderers.
 */
export function normalizeStep(raw: PresentationStep, index: number): PresentationStep {
  if (raw.screen?.visual?.type) return raw

  const chapter = raw.chapter_title || `步骤 ${index + 1}`
  const narration = raw.narration || ''
  const oldType = raw.type || ''

  let screen: StepScreen

  switch (oldType) {
    case 'hero':
      screen = {
        headline: raw.title || chapter,
        subhead: raw.subtitle || '',
        visual: {
          type: 'reveal',
          elements: [{ kind: 'text', content: raw.title || chapter, role: '主标题', animate: 'fade-in' }],
          mood: 'dramatic',
        },
      }
      break
    case 'quote':
      screen = {
        headline: '',
        subhead: '',
        visual: {
          type: 'quote',
          elements: [{ kind: 'quote', content: raw.quote || narration, role: '金句', animate: 'fade-in' }],
          mood: 'warm',
        },
      }
      break
    case 'list_item':
      screen = {
        headline: raw.list_title || '',
        subhead: '',
        visual: {
          type: 'list',
          elements: [{ kind: 'text', content: raw.item_text || narration, role: `第${raw.item_index ?? ''}项`, animate: 'fly-in' }],
          mood: 'calm',
        },
      }
      break
    default:
      screen = {
        headline: chapter,
        subhead: '',
        visual: {
          type: 'reveal',
          elements: [{ kind: 'text', content: raw.body || narration, role: '主内容', animate: 'fade-in' }],
          mood: 'calm',
        },
      }
  }

  return { ...raw, step: raw.step ?? index + 1, screen }
}
