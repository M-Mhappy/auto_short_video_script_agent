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
