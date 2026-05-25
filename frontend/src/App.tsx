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
  generateTTS,
  getAudioDownloadUrl,
  getAudioZipUrl,
  generatePresentation,
  getPresentation,
  generatePresentationTTS,
  generatePresentationVideo,
  getPresentationPptxUrl,
  getPresentationAudioZipUrl,
  getPresentationVideoUrl,
} from './api'
import type { TTSParams, ChapterAudioFile, PresentationData } from './api'
import ProgressBar from './components/ProgressBar'
import PresentationView from './presentation/PresentationView'
import BookSelector from './components/BookSelector'
import ScriptPreview from './components/ScriptPreview'
import LowQualityDecision from './components/LowQualityDecision'
import LoadingIndicator from './components/LoadingIndicator'

const VOICE_OPTIONS = [
  { id: 'zh-CN-YunxiNeural', label: '云希（男·自然叙事）' },
  { id: 'zh-CN-YunjianNeural', label: '云健（男·浑厚沉稳）' },
  { id: 'zh-CN-YunhaoNeural', label: '云皓（男·温暖亲切）' },
  { id: 'zh-CN-YunyangNeural', label: '云扬（男·新闻播报）' },
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女·温柔清晰）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女·活泼年轻）' },
  { id: 'zh-CN-XiaochenNeural', label: '晓辰（女·成熟知性）' },
  { id: 'zh-TW-HsiaoChenNeural', label: '晓臻（女·台湾腔）' },
  { id: 'zh-HK-HiuGaaiNeural', label: '曉佳（女·粤语）' },
]

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
  const [ttsLoading, setTtsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioChapters, setAudioChapters] = useState<ChapterAudioFile[]>([])
  const [showTtsPanel, setShowTtsPanel] = useState(false)
  const [ttsMode, setTtsMode] = useState<'full' | 'chapters'>('full')
  const [ttsVoice, setTtsVoice] = useState('zh-CN-YunxiNeural')
  const [ttsRate, setTtsRate] = useState(0)
  const [ttsVolume, setTtsVolume] = useState(0)
  const [ttsPitch, setTtsPitch] = useState(0)
  const [viewMode, setViewMode] = useState<'chat' | 'presentation'>('chat')
  const [presentationReady, setPresentationReady] = useState(false)
  const [presentationHasAudio, setPresentationHasAudio] = useState(false)
  const [presentationLoading, setPresentationLoading] = useState(false)
  const [presentationTtsLoading, setPresentationTtsLoading] = useState(false)
  const [presentationVideoLoading, setPresentationVideoLoading] = useState(false)
  const [presentationVideoReady, setPresentationVideoReady] = useState(false)
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null)
  const [presentationAuto, setPresentationAuto] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  useEffect(scrollToBottom, [messages, interrupt, scrollToBottom])

  const ttsParams = (): TTSParams => ({
    voice: ttsVoice,
    rate: `${ttsRate >= 0 ? '+' : ''}${ttsRate}%`,
    volume: `${ttsVolume >= 0 ? '+' : ''}${ttsVolume}%`,
    pitch: `${ttsPitch >= 0 ? '+' : ''}${ttsPitch}Hz`,
  })

  const openPresentation = useCallback(async (sid: string, auto: boolean) => {
    const data = await getPresentation(sid)
    setPresentationData(data)
    setPresentationHasAudio(data.has_audio)
    setPresentationAuto(auto)
    setViewMode('presentation')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('presentation') === '1' && params.get('session')) {
      const sid = params.get('session')!
      setSessionId(sid)
      setPresentationReady(true)
      openPresentation(sid, params.get('auto') === '1').catch(() => {})
    }
  }, [openPresentation])

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

  const handleTTS = async () => {
    if (!sessionId) return
    setTtsLoading(true)
    try {
      const params: TTSParams = { ...ttsParams(), mode: ttsMode }
      const result = await generateTTS(sessionId, params)
      if (result.mode === 'chapters') {
        setAudioUrl(null)
        setAudioChapters(result.files)
        addMessage({
          role: 'assistant',
          content: `AI 配音已生成（${result.files.length} 个章节）！`,
          type: 'audio',
          data: {
            mode: 'chapters',
            chapters: result.files,
            zipUrl: getAudioZipUrl(sessionId),
          },
        })
      } else {
        const url = getAudioDownloadUrl(sessionId)
        setAudioUrl(url)
        setAudioChapters([])
        addMessage({
          role: 'assistant',
          content: 'AI 配音已生成！',
          type: 'audio',
          data: { mode: 'full', audioUrl: url },
        })
      }
    } catch (err) {
      addMessage({
        role: 'system',
        content: `配音失败：${err instanceof Error ? err.message : '未知错误'}`,
        type: 'text',
      })
    } finally {
      setTtsLoading(false)
    }
  }

  const handleGeneratePresentation = async () => {
    if (!sessionId) return
    setPresentationLoading(true)
    try {
      const res = await generatePresentation(sessionId)
      setPresentationReady(true)
      setPresentationHasAudio(false)
      setPresentationVideoReady(false)
      addMessage({
        role: 'assistant',
        content: `演示文稿已生成（${res.step_count} 步），可打开演示或生成演示配音。`,
        type: 'text',
      })
    } catch (err) {
      addMessage({
        role: 'system',
        content: `生成演示失败：${err instanceof Error ? err.message : '未知错误'}`,
        type: 'text',
      })
    } finally {
      setPresentationLoading(false)
    }
  }

  const handlePresentationTTS = async () => {
    if (!sessionId) return
    setPresentationTtsLoading(true)
    try {
      await generatePresentationTTS(sessionId, ttsParams())
      setPresentationHasAudio(true)
      setPresentationVideoReady(false)
      addMessage({
        role: 'assistant',
        content: '演示配音已生成，打开演示可自动连播（录屏建议用自动播放）。',
        type: 'text',
      })
    } catch (err) {
      addMessage({
        role: 'system',
        content: `演示配音失败：${err instanceof Error ? err.message : '未知错误'}`,
        type: 'text',
      })
    } finally {
      setPresentationTtsLoading(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!sessionId) return
    setPresentationVideoLoading(true)
    try {
      await generatePresentationVideo(sessionId)
      setPresentationVideoReady(true)
      addMessage({
        role: 'assistant',
        content: '演示视频已合成，可下载 MP4 文件。',
        type: 'text',
      })
    } catch (err) {
      addMessage({
        role: 'system',
        content: `视频合成失败：${err instanceof Error ? err.message : '未知错误'}`,
        type: 'text',
      })
    } finally {
      setPresentationVideoLoading(false)
    }
  }

  const handleOpenPresentation = async (auto = false) => {
    if (!sessionId) return
    try {
      await openPresentation(sessionId, auto)
    } catch (err) {
      addMessage({
        role: 'system',
        content: `打开演示失败：${err instanceof Error ? err.message : '请先点击生成演示文稿'}`,
        type: 'text',
      })
    }
  }

  const handleNewSession = () => {
    if (esRef.current) esRef.current.close()
    setSessionId(null)
    setMessages([])
    setCurrentStep('')
    setIsRunning(false)
    setInterrupt(null)
    setTtsLoading(false)
    setAudioUrl(null)
    setAudioChapters([])
    setShowTtsPanel(false)
    setTtsMode('full')
    setViewMode('chat')
    setPresentationReady(false)
    setPresentationHasAudio(false)
    setPresentationVideoReady(false)
    setPresentationData(null)
    setPresentationAuto(false)
    setMode('direct')
  }

  if (viewMode === 'presentation' && sessionId && presentationData) {
    return (
      <PresentationView
        sessionId={sessionId}
        data={presentationData}
        autoPlay={presentationAuto}
        onClose={() => {
          setViewMode('chat')
          setPresentationAuto(false)
        }}
      />
    )
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
                {msg.type === 'export' && typeof msg.data?.downloadUrl === 'string' && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={msg.data.downloadUrl as string}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                        download
                      >
                        下载 Word 文档
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowTtsPanel((v) => !v)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      >
                        配音设置
                      </button>
                      {!audioUrl && audioChapters.length === 0 && (
                        <button
                          onClick={handleTTS}
                          disabled={ttsLoading}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            ttsLoading
                              ? 'bg-purple-300 text-white cursor-wait'
                              : 'bg-purple-500 text-white hover:bg-purple-600'
                          }`}
                        >
                          {ttsLoading ? '配音生成中...' : 'AI 配音'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGeneratePresentation}
                        disabled={presentationLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          presentationLoading
                            ? 'bg-amber-200 text-amber-800 cursor-wait'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {presentationLoading ? '生成中...' : '生成演示文稿'}
                      </button>
                      {presentationReady && (
                        <>
                          <a
                            href={sessionId ? getPresentationPptxUrl(sessionId) : '#'}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                            download
                          >
                            下载演示文稿 PPTX
                          </a>
                          <button
                            type="button"
                            onClick={() => handleOpenPresentation(false)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
                          >
                            打开网页演示
                          </button>
                          <button
                            type="button"
                            onClick={handlePresentationTTS}
                            disabled={presentationTtsLoading}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              presentationTtsLoading
                                ? 'bg-indigo-300 text-white cursor-wait'
                                : 'bg-indigo-500 text-white hover:bg-indigo-600'
                            }`}
                          >
                            {presentationTtsLoading
                              ? '演示配音中...'
                              : presentationHasAudio
                                ? '重新生成演示配音'
                                : '生成演示配音'}
                          </button>
                          {presentationHasAudio && (
                            <>
                              <a
                                href={sessionId ? getPresentationAudioZipUrl(sessionId) : '#'}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                                download
                              >
                                下载演示配音
                              </a>
                              <button
                                type="button"
                                onClick={() => handleOpenPresentation(true)}
                                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                自动播放演示
                              </button>
                              <button
                                type="button"
                                onClick={handleGenerateVideo}
                                disabled={presentationVideoLoading}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  presentationVideoLoading
                                    ? 'bg-rose-300 text-white cursor-wait'
                                    : 'bg-rose-500 text-white hover:bg-rose-600'
                                }`}
                              >
                                {presentationVideoLoading
                                  ? '视频合成中...'
                                  : presentationVideoReady
                                    ? '重新生成视频'
                                    : '生成视频'}
                              </button>
                              {presentationVideoReady && (
                                <a
                                  href={sessionId ? getPresentationVideoUrl(sessionId) : '#'}
                                  className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
                                  download
                                >
                                  下载视频 MP4
                                </a>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {showTtsPanel && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-sm">
                        <div>
                          <label className="block text-gray-600 mb-1 font-medium">合成模式</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setTtsMode('full')}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                ttsMode === 'full'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              整篇合成
                            </button>
                            <button
                              type="button"
                              onClick={() => setTtsMode('chapters')}
                              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                ttsMode === 'chapters'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              按章节合成
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1 font-medium">音色</label>
                          <select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            {VOICE_OPTIONS.map((v) => (
                              <option key={v.id} value={v.id}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1 font-medium">
                            语速：{ttsRate > 0 ? `+${ttsRate}%` : `${ttsRate}%`}
                          </label>
                          <input
                            type="range" min={-50} max={100} value={ttsRate}
                            onChange={(e) => setTtsRate(Number(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>慢</span><span>正常</span><span>快</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1 font-medium">
                            音量：{ttsVolume > 0 ? `+${ttsVolume}%` : `${ttsVolume}%`}
                          </label>
                          <input
                            type="range" min={-50} max={50} value={ttsVolume}
                            onChange={(e) => setTtsVolume(Number(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>轻</span><span>正常</span><span>响</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1 font-medium">
                            音调：{ttsPitch > 0 ? `+${ttsPitch}Hz` : `${ttsPitch}Hz`}
                          </label>
                          <input
                            type="range" min={-50} max={50} value={ttsPitch}
                            onChange={(e) => setTtsPitch(Number(e.target.value))}
                            className="w-full accent-purple-500"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>低沉</span><span>正常</span><span>尖锐</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {msg.type === 'audio' && msg.data?.mode === 'full' && typeof msg.data?.audioUrl === 'string' && (
                  <div className="mt-3 space-y-2">
                    <audio controls className="w-full" src={msg.data.audioUrl as string} />
                    <a
                      href={msg.data.audioUrl as string}
                      className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                      download
                    >
                      下载音频文件
                    </a>
                  </div>
                )}
                {msg.type === 'audio' && msg.data?.mode === 'chapters' && (
                  <div className="mt-3 space-y-3">
                    {(msg.data.chapters as ChapterAudioFile[]).map((ch) => (
                      <div key={ch.chapter} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {ch.chapter}. {ch.title}
                        </p>
                        <audio
                          controls
                          className="w-full mb-2"
                          src={sessionId ? getAudioDownloadUrl(sessionId, ch.chapter) : ''}
                        />
                        <a
                          href={sessionId ? getAudioDownloadUrl(sessionId, ch.chapter) : '#'}
                          className="text-xs text-purple-600 hover:text-purple-700"
                          download
                        >
                          下载本章
                        </a>
                      </div>
                    ))}
                    {typeof msg.data?.zipUrl === 'string' && (
                      <a
                        href={msg.data.zipUrl as string}
                        className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                        download
                      >
                        下载全部（ZIP）
                      </a>
                    )}
                  </div>
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
