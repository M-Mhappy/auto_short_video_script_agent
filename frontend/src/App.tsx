import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, InterruptData, BookInfo, ReviewResult } from './types'
import {
  createSession,
  startSession,
  confirmBook,
  lowQualityDecision,
  submitFeedback,
  subscribeSSE,
  getDownloadUrl,
} from './api'
import ProgressBar from './components/ProgressBar'
import BookSelector from './components/BookSelector'
import ScriptPreview from './components/ScriptPreview'
import LowQualityDecision from './components/LowQualityDecision'
import LoadingIndicator from './components/LoadingIndicator'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'direct' | 'keyword'>('direct')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [interrupt, setInterrupt] = useState<InterruptData | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  useEffect(scrollToBottom, [messages, interrupt, scrollToBottom])

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      setMessages((prev) => [...prev, { ...msg, id: genId(), timestamp: Date.now() }])
    },
    []
  )

  const startListening = useCallback(
    (sid: string) => {
      if (esRef.current) esRef.current.close()

      const es = subscribeSSE(
        sid,
        (event, data) => {
          const d = data as Record<string, unknown>

          if (event === '__error__') {
            setIsRunning(false)
            addMessage({
              role: 'system',
              content: `发生错误：${d.error || '未知错误'}`,
              type: 'text',
            })
            return
          }

          if (event === '__completed__') {
            setIsRunning(false)
            return
          }

          if (event === '__interrupt__') {
            setIsRunning(false)
            const interruptData = d as unknown as InterruptData
            setInterrupt(interruptData)
            return
          }

          setCurrentStep(event)

          if (event === 'search_books' && d.search_results) {
            // wait for interrupt
          } else if (event === 'generate_script' && d.script_draft) {
            addMessage({
              role: 'assistant',
              content: '口播稿已生成，正在进行质量审核...',
              type: 'text',
            })
          } else if (event === 'review_script' && d.review_result) {
            const review = d.review_result as ReviewResult
            addMessage({
              role: 'assistant',
              content: `审核完成，得分：${review.total}/100`,
              type: 'score',
              data: { review },
            })
          } else if (event === 'retry_generate') {
            addMessage({
              role: 'assistant',
              content: '得分未达标，正在自动重新生成...',
              type: 'text',
            })
          } else if (event === 'export_word') {
            setIsRunning(false)
            addMessage({
              role: 'assistant',
              content: 'Word 文档已生成！',
              type: 'export',
              data: { downloadUrl: getDownloadUrl(sid) },
            })
          }
        },
        () => {
          setIsRunning(false)
        }
      )

      esRef.current = es
    },
    [addMessage]
  )

  const handleStart = async () => {
    if (!input.trim()) return

    const userInput = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userInput, type: 'text' })

    try {
      const sid = await createSession()
      setSessionId(sid)
      setIsRunning(true)
      setInterrupt(null)
      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          timestamp: Date.now(),
          role: 'assistant',
          content: '正在为您处理...',
          type: 'loading',
        },
      ])
      await startSession(sid, userInput, mode)
      startListening(sid)
    } catch (err) {
      addMessage({
        role: 'system',
        content: `启动失败：${err instanceof Error ? err.message : '网络错误'}`,
        type: 'text',
      })
      setIsRunning(false)
    }
  }

  const handleBookSelect = async (index: number) => {
    if (!sessionId) return
    const books = (interrupt?.books || []) as BookInfo[]
    const book = books[index]
    setInterrupt(null)
    setIsRunning(true)
    addMessage({
      role: 'user',
      content: `已选择：《${book?.title || ''}》`,
      type: 'text',
    })
    await confirmBook(sessionId, 'select', index)
    startListening(sessionId)
  }

  const handleBookRetry = async () => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: '换一批搜索结果', type: 'text' })
    await confirmBook(sessionId, 'retry')
    startListening(sessionId)
  }

  const handleBookResearch = async (query: string) => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: `重新搜索：${query}`, type: 'text' })
    await confirmBook(sessionId, 'research', 0, query)
    startListening(sessionId)
  }

  const handleLowQualityAccept = async () => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: '接受当前稿件', type: 'text' })
    await lowQualityDecision(sessionId, 'accept')
    startListening(sessionId)
  }

  const handlePreviewConfirm = async () => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: '确认导出', type: 'text' })
    await submitFeedback(sessionId, 'confirm')
    startListening(sessionId)
  }

  const handlePreviewFeedback = async (fb: string) => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: `修改建议：${fb}`, type: 'text' })
    await submitFeedback(sessionId, 'feedback', fb)
    startListening(sessionId)
  }

  const handleAbandon = async () => {
    if (!sessionId) return
    setInterrupt(null)
    setIsRunning(false)

    const interruptType = interrupt?.type
    if (interruptType === 'book_confirm') {
      await confirmBook(sessionId, 'abandon')
    } else if (interruptType === 'low_quality_decision') {
      await lowQualityDecision(sessionId, 'abandon')
    } else if (interruptType === 'preview_feedback') {
      await submitFeedback(sessionId, 'abandon')
    }

    addMessage({ role: 'system', content: '已放弃本次生成。', type: 'text' })
  }

  const handleNewSession = () => {
    if (esRef.current) esRef.current.close()
    setSessionId(null)
    setMessages([])
    setCurrentStep('')
    setIsRunning(false)
    setInterrupt(null)
    setMode('direct')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">智能口播稿生成器</h1>
              <p className="text-xs text-gray-400">围绕一本书，生成讲故事式口播稿</p>
            </div>
          </div>
          {sessionId && (
            <button
              onClick={handleNewSession}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              新建会话
            </button>
          )}
        </div>
        {currentStep && (
          <div className="max-w-4xl mx-auto px-2">
            <ProgressBar currentStep={currentStep} />
          </div>
        )}
      </header>

      {/* Messages */}
      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4 pb-40">
        {messages.length === 0 && !isRunning && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg">
              AI
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              选择模式，开始生成口播稿
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {mode === 'direct'
                ? '输入明确的书名，直接搜索并生成口播稿。'
                : '描述你想要的书籍类型，AI 帮你找书再生成口播稿。'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {mode === 'direct'
                ? ['三体', '人类简史', '小王子', '活着'].map((example) => (
                    <button
                      key={example}
                      onClick={() => setInput(example)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-colors shadow-sm"
                    >
                      {example}
                    </button>
                  ))
                : ['想找一本关于心理学的书', '有没有讲时间管理的', '推荐一本治愈系小说'].map(
                    (example) => (
                      <button
                        key={example}
                        onClick={() => setInput(example)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-colors shadow-sm"
                      >
                        {example}
                      </button>
                    )
                  )}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'loading') return null
          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : msg.role === 'system'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-white border border-gray-100 shadow-sm text-gray-700'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.type === 'export' && msg.data?.downloadUrl && (
                  <a
                    href={msg.data.downloadUrl as string}
                    className="inline-block mt-3 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                    download
                  >
                    下载 Word 文档
                  </a>
                )}
              </div>
            </div>
          )
        })}

        {/* Loading indicator */}
        {isRunning && <LoadingIndicator step={currentStep} />}

        {/* Interrupt UIs */}
        {interrupt?.type === 'book_confirm' && (
          <BookSelector
            books={(interrupt.books || []) as BookInfo[]}
            onSelect={handleBookSelect}
            onRetry={handleBookRetry}
            onResearch={handleBookResearch}
            onAbandon={handleAbandon}
            searchRetryCount={interrupt.search_retry_count ?? 0}
            maxSearchRetries={interrupt.max_search_retries ?? 5}
          />
        )}

        {interrupt?.type === 'low_quality_decision' && (
          <LowQualityDecision
            review={(interrupt.review || {}) as ReviewResult}
            message={interrupt.message || ''}
            onAccept={handleLowQualityAccept}
            onAbandon={handleAbandon}
          />
        )}

        {interrupt?.type === 'preview_feedback' && (
          <ScriptPreview
            script={(interrupt.script as string) || ''}
            review={interrupt.review as ReviewResult | undefined}
            onConfirm={handlePreviewConfirm}
            onFeedback={handlePreviewFeedback}
            onAbandon={handleAbandon}
          />
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      {!interrupt && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setMode('direct')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mode === 'direct'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                按书名搜索
              </button>
              <button
                onClick={() => setMode('keyword')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mode === 'keyword'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                按描述找书
              </button>
            </div>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                placeholder={
                  mode === 'direct'
                    ? '输入书名，如：三体、人类简史'
                    : '描述你想要的书，如：推荐一本关于时间管理的书'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isRunning && handleStart()}
                disabled={isRunning}
              />
              <button
                onClick={handleStart}
                disabled={isRunning || !input.trim()}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                  isRunning || !input.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
                }`}
              >
                {isRunning ? '处理中...' : '开始生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
