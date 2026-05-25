const BASE = '/api'

export async function createSession(): Promise<string> {
  const res = await fetch(`${BASE}/session/create`, { method: 'POST' })
  const data = await res.json()
  return data.session_id
}

export async function startSession(sessionId: string, userInput: string, mode: string) {
  await fetch(`${BASE}/session/${sessionId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: userInput, mode }),
  })
}

export async function confirmBook(
  sessionId: string,
  action: string,
  index?: number,
  query?: string
) {
  await fetch(`${BASE}/session/${sessionId}/confirm-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, index, query }),
  })
}

export async function lowQualityDecision(sessionId: string, action: string) {
  await fetch(`${BASE}/session/${sessionId}/low-quality-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

export async function submitFeedback(
  sessionId: string,
  action: string,
  feedback?: string
) {
  await fetch(`${BASE}/session/${sessionId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, feedback }),
  })
}

export async function getSessionState(sessionId: string) {
  const res = await fetch(`${BASE}/session/${sessionId}/state`)
  return res.json()
}

export function getDownloadUrl(sessionId: string): string {
  return `${BASE}/session/${sessionId}/download`
}

export interface TTSParams {
  voice?: string
  rate?: string
  volume?: string
  pitch?: string
  mode?: 'full' | 'chapters'
}

export interface ChapterAudioFile {
  chapter: number
  title: string
  filename: string
}

export type TTSResponse =
  | { status: string; mode: 'full'; filename: string }
  | { status: string; mode: 'chapters'; files: ChapterAudioFile[]; zip_filename: string }

export async function generateTTS(
  sessionId: string,
  params: TTSParams = {},
): Promise<TTSResponse> {
  const res = await fetch(`${BASE}/session/${sessionId}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '配音失败' }))
    throw new Error(err.detail || '配音失败')
  }
  return res.json()
}

export function getAudioDownloadUrl(sessionId: string, chapter?: number): string {
  if (chapter !== undefined) {
    return `${BASE}/session/${sessionId}/download-audio?chapter=${chapter}`
  }
  return `${BASE}/session/${sessionId}/download-audio`
}

export function getAudioZipUrl(sessionId: string): string {
  return `${BASE}/session/${sessionId}/download-audio-zip`
}

export type { PresentationData, PresentationStep } from './presentation/types'
import type { PresentationData } from './presentation/types'

export async function generatePresentation(
  sessionId: string,
): Promise<{ status: string; step_count: number; pptx_filename?: string }> {
  const res = await fetch(`${BASE}/session/${sessionId}/presentation/generate`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '生成演示失败' }))
    throw new Error(err.detail || '生成演示失败')
  }
  return res.json()
}

export async function getPresentation(sessionId: string): Promise<PresentationData> {
  const res = await fetch(`${BASE}/session/${sessionId}/presentation`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '演示数据不存在' }))
    throw new Error(err.detail || '演示数据不存在')
  }
  return res.json() as Promise<PresentationData>
}

export async function generatePresentationTTS(
  sessionId: string,
  params: TTSParams = {},
): Promise<{ status: string; audio_count: number; zip_filename: string }> {
  const res = await fetch(`${BASE}/session/${sessionId}/presentation/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '演示配音失败' }))
    throw new Error(err.detail || '演示配音失败')
  }
  return res.json()
}

export function getPresentationAudioUrl(sessionId: string, stepIndex: number): string {
  return `${BASE}/session/${sessionId}/presentation/audio/${stepIndex}`
}

export function getPresentationAudioZipUrl(sessionId: string): string {
  return `${BASE}/session/${sessionId}/presentation/audio-zip`
}

export function getPresentationPptxUrl(sessionId: string): string {
  return `${BASE}/session/${sessionId}/presentation/download-pptx`
}

export async function generatePresentationVideo(
  sessionId: string,
): Promise<{ status: string; video_filename: string }> {
  const res = await fetch(`${BASE}/session/${sessionId}/presentation/video`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '视频合成失败' }))
    throw new Error(err.detail || '视频合成失败')
  }
  return res.json()
}

export function getPresentationVideoUrl(sessionId: string): string {
  return `${BASE}/session/${sessionId}/presentation/download-video`
}

export function subscribeSSE(
  sessionId: string,
  onEvent: (event: string, data: unknown) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${BASE}/session/${sessionId}/stream`)

  es.onopen = () => {}

  es.onerror = (e) => {
    if (onError) onError(e)
    es.close()
  }

  const eventTypes = [
    'entry',
    'extract_keywords',
    'search_books',
    'confirm_book',
    'load_reference',
    'generate_script',
    'review_script',
    'retry_generate',
    'low_quality_decision',
    'preview_script',
    'apply_feedback',
    'export_word',
    '__interrupt__',
    '__completed__',
    '__error__',
  ]

  for (const type of eventTypes) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        onEvent(type, data)
      } catch {
        onEvent(type, e.data)
      }
    })
  }

  return es
}
