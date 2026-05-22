export interface BookInfo {
  title: string
  author: string
  intro: string
  relevance_reason: string
}

export interface ReviewResult {
  fact_accuracy: number
  fidelity: number
  completeness: number
  style_consistency: number
  total: number
  reasoning: string
  hallucinations: string[]
  omissions: string[]
}

export interface SSEEvent {
  node: string
  data: Record<string, unknown>
}

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'interrupted'
  | 'completed'
  | 'error'

export type InterruptType =
  | 'book_confirm'
  | 'low_quality_decision'
  | 'preview_feedback'

export interface InterruptData {
  type: InterruptType
  message: string
  books?: BookInfo[]
  review?: ReviewResult
  script?: string
  search_retry_count?: number
  max_search_retries?: number
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: number
  data?: Record<string, unknown>
  type?: 'text' | 'book_select' | 'script_preview' | 'score' | 'low_quality' | 'loading' | 'export'
}
