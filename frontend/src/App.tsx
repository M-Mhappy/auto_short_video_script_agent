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
  generatePresentationTTS,
  generatePresentationVideo,
  getPresentationPptxUrl,
  getPresentationAudioZipUrl,
  getPresentationVideoUrl,
  uploadScript,
} from './api'
import type { TTSParams, ChapterAudioFile, ResumeInfo } from './api'
import { useTTS } from './hooks/useTTS'
import { usePresentation } from './hooks/usePresentation'
import ProgressBar from './components/ProgressBar'
import PresentationView from './presentation/PresentationView'
import BookSelector from './components/BookSelector'
import ScriptPreview from './components/ScriptPreview'
import LowQualityDecision from './components/LowQualityDecision'
import LoadingIndicator from './components/LoadingIndicator'
import ExportToolbar from './components/ExportToolbar'
import InputArea from './components/InputArea'
import HistoryPanel from './components/HistoryPanel'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'direct' | 'keyword' | 'upload'>('direct')
  const [uploadText, setUploadText] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const [isUploadSession, setIsUploadSession] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [interrupt, setInterrupt] = useState<InterruptData | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const tts = useTTS()
  const pres = usePresentation()

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  useEffect(scrollToBottom, [messages, interrupt, scrollToBottom])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('presentation') === '1' && params.get('session')) {
      const sid = params.get('session')!
      setSessionId(sid)
      pres.setPresentationReady(true)
      pres.openPresentation(sid, params.get('auto') === '1').catch(() => {})
    }
  }, [pres.openPresentation])

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
            addMessage({ role: 'system', content: `发生错误：${d.error || '未知错误'}`, type: 'text' })
            return
          }
          if (event === '__completed__') {
            setIsRunning(false)
            return
          }
          if (event === '__interrupt__') {
            setIsRunning(false)
            setInterrupt(d as unknown as InterruptData)
            return
          }

          setCurrentStep(event)

          if (event === 'generate_script' && d.script_draft) {
            addMessage({ role: 'assistant', content: '口播稿已生成，正在进行质量审核...', type: 'text' })
          } else if (event === 'review_script' && d.review_result) {
            const review = d.review_result as ReviewResult
            addMessage({ role: 'assistant', content: `审核完成，得分：${review.total}/100`, type: 'score', data: { review } })
          } else if (event === 'retry_generate') {
            addMessage({ role: 'assistant', content: '得分未达标，正在自动重新生成...', type: 'text' })
          } else if (event === 'export_word') {
            setIsRunning(false)
            addMessage({ role: 'assistant', content: 'Word 文档已生成！', type: 'export', data: { downloadUrl: getDownloadUrl(sid) } })
          }
        },
        () => setIsRunning(false),
      )
      esRef.current = es
    },
    [addMessage],
  )

  // ── Handlers ───────────────────────────────────────────────

  const handleUploadScript = async () => {
    const text = uploadText.trim()
    if (!text) return
    const title = uploadTitle.trim() || '自定义口播稿'
    setUploadLoading(true)
    addMessage({ role: 'user', content: `上传口播稿：${title}`, type: 'text' })
    try {
      const res = await uploadScript(text, title)
      setSessionId(res.session_id)
      setIsUploadSession(true)
      setInterrupt(null)
      setIsRunning(false)
      addMessage({ role: 'assistant', content: `已接收口播稿（${res.chapter_count} 个章节），可直接生成配音、演示文稿与视频。`, type: 'script_preview', data: { script: text } })
      addMessage({ role: 'assistant', content: 'Word 文档已生成！', type: 'export', data: { downloadUrl: getDownloadUrl(res.session_id) } })
    } catch (err) {
      addMessage({ role: 'system', content: `上传失败：${err instanceof Error ? err.message : '未知错误'}`, type: 'text' })
    } finally {
      setUploadLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setUploadText(String(reader.result || ''))
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

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
      setMessages((prev) => [...prev, { id: genId(), timestamp: Date.now(), role: 'assistant', content: '正在为您处理...', type: 'loading' }])
      await startSession(sid, userInput, mode)
      startListening(sid)
    } catch (err) {
      addMessage({ role: 'system', content: `启动失败：${err instanceof Error ? err.message : '网络错误'}`, type: 'text' })
      setIsRunning(false)
    }
  }

  const handleBookSelect = async (index: number) => {
    if (!sessionId) return
    const books = (interrupt?.books || []) as BookInfo[]
    setInterrupt(null)
    setIsRunning(true)
    addMessage({ role: 'user', content: `已选择：《${books[index]?.title || ''}》`, type: 'text' })
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
    if (interruptType === 'book_confirm') await confirmBook(sessionId, 'abandon')
    else if (interruptType === 'low_quality_decision') await lowQualityDecision(sessionId, 'abandon')
    else if (interruptType === 'preview_feedback') await submitFeedback(sessionId, 'abandon')
    addMessage({ role: 'system', content: '已放弃本次生成。', type: 'text' })
  }

  const handleTTS = async () => {
    if (!sessionId) return
    tts.setTtsLoading(true)
    try {
      const params: TTSParams = { ...tts.ttsParams(), mode: tts.ttsMode }
      const result = await generateTTS(sessionId, params)
      if (result.mode === 'chapters') {
        tts.setAudioUrl(null)
        tts.setAudioChapters(result.files)
        addMessage({ role: 'assistant', content: `AI 配音已生成（${result.files.length} 个章节）！`, type: 'audio', data: { mode: 'chapters', chapters: result.files, zipUrl: getAudioZipUrl(sessionId) } })
      } else {
        const url = getAudioDownloadUrl(sessionId)
        tts.setAudioUrl(url)
        tts.setAudioChapters([])
        addMessage({ role: 'assistant', content: 'AI 配音已生成！', type: 'audio', data: { mode: 'full', audioUrl: url } })
      }
    } catch (err) {
      addMessage({ role: 'system', content: `配音失败：${err instanceof Error ? err.message : '未知错误'}`, type: 'text' })
    } finally {
      tts.setTtsLoading(false)
    }
  }

  const handleGeneratePresentation = async () => {
    if (!sessionId) return
    pres.setPresentationLoading(true)
    try {
      const res = await generatePresentation(sessionId)
      pres.setPresentationReady(true)
      pres.setPresentationHasAudio(false)
      pres.setPresentationVideoReady(false)
      addMessage({ role: 'assistant', content: `演示文稿已生成（${res.step_count} 步），可打开演示或生成演示配音。`, type: 'text' })
    } catch (err) {
      addMessage({ role: 'system', content: `生成演示失败：${err instanceof Error ? err.message : '未知错误'}`, type: 'text' })
    } finally {
      pres.setPresentationLoading(false)
    }
  }

  const handlePresentationTTS = async () => {
    if (!sessionId) return
    pres.setPresentationTtsLoading(true)
    try {
      await generatePresentationTTS(sessionId, tts.ttsParams())
      pres.setPresentationHasAudio(true)
      pres.setPresentationVideoReady(false)
      addMessage({ role: 'assistant', content: '演示配音已生成，打开演示可自动连播（录屏建议用自动播放）。', type: 'text' })
    } catch (err) {
      addMessage({ role: 'system', content: `演示配音失败：${err instanceof Error ? err.message : '未知错误'}`, type: 'text' })
    } finally {
      pres.setPresentationTtsLoading(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!sessionId) return
    pres.setPresentationVideoLoading(true)
    try {
      await generatePresentationVideo(sessionId)
      pres.setPresentationVideoReady(true)
      addMessage({ role: 'assistant', content: '演示视频已合成，可下载 MP4 文件。', type: 'text' })
    } catch (err) {
      addMessage({ role: 'system', content: `视频合成失败：${err instanceof Error ? err.message : '未知错误'}`, type: 'text' })
    } finally {
      pres.setPresentationVideoLoading(false)
    }
  }

  const handleOpenPresentation = async (auto = false) => {
    if (!sessionId) return
    try {
      await pres.openPresentation(sessionId, auto)
    } catch (err) {
      addMessage({ role: 'system', content: `打开演示失败：${err instanceof Error ? err.message : '请先点击生成演示文稿'}`, type: 'text' })
    }
  }

  const handleNewSession = () => {
    if (esRef.current) esRef.current.close()
    setSessionId(null)
    setMessages([])
    setCurrentStep('')
    setIsRunning(false)
    setInterrupt(null)
    setMode('direct')
    setUploadText('')
    setUploadTitle('')
    setUploadLoading(false)
    setIsUploadSession(false)
    tts.resetTTS()
    pres.resetPresentation()
  }

  const handleResumeSession = (info: ResumeInfo) => {
    if (esRef.current) esRef.current.close()
    setSessionId(info.session_id)
    setMessages([])
    setCurrentStep('')
    setIsRunning(false)
    setInterrupt(null)
    setIsUploadSession(info.is_custom)
    tts.resetTTS()
    pres.resetPresentation()

    if (info.has_presentation) pres.setPresentationReady(true)
    if (info.has_pres_audio) pres.setPresentationHasAudio(true)
    if (info.video_file) pres.setPresentationVideoReady(true)

    addMessage({
      role: 'assistant',
      content: `已恢复会话：${info.title}`,
      type: 'text',
    })

    if (info.word_file) {
      addMessage({
        role: 'assistant',
        content: 'Word 文档已生成！',
        type: 'export',
        data: { downloadUrl: getDownloadUrl(info.session_id) },
      })
    }

    if (info.audio_zip) {
      if (info.audio_chapters.length > 0) {
        tts.setAudioChapters(info.audio_chapters)
        addMessage({
          role: 'assistant',
          content: `AI 配音已生成（${info.audio_chapters.length} 个章节）！`,
          type: 'audio',
          data: {
            mode: 'chapters',
            chapters: info.audio_chapters,
            zipUrl: getAudioZipUrl(info.session_id),
          },
        })
      } else if (info.audio_file) {
        const url = getAudioDownloadUrl(info.session_id)
        tts.setAudioUrl(url)
        addMessage({
          role: 'assistant',
          content: 'AI 配音已生成！',
          type: 'audio',
          data: { mode: 'full', audioUrl: url },
        })
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────

  if (pres.viewMode === 'presentation' && sessionId && pres.presentationData) {
    return (
      <PresentationView
        sessionId={sessionId}
        data={pres.presentationData}
        autoPlay={pres.presentationAuto}
        onClose={() => {
          pres.setViewMode('chat')
          pres.setPresentationAuto(false)
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              历史记录
            </button>
            {sessionId && (
              <button
                onClick={handleNewSession}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                新建会话
              </button>
            )}
          </div>
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
              {mode === 'upload' ? '上传口播稿，一键生成配音与演示' : '选择模式，开始生成口播稿'}
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {mode === 'direct'
                ? '输入明确的书名，直接搜索并生成口播稿。'
                : mode === 'keyword'
                  ? '描述你想要的书籍类型，AI 帮你找书再生成口播稿。'
                  : '粘贴或上传已有口播稿（支持 .txt / .md），跳过 AI 生成，直接配音、演示与合成视频。建议使用 ## 章节标题 分段。'}
            </p>
            {mode !== 'upload' && (
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
                  : ['想找一本关于心理学的书', '有没有讲时间管理的', '推荐一本治愈系小说'].map((example) => (
                      <button
                        key={example}
                        onClick={() => setInput(example)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-colors shadow-sm"
                      >
                        {example}
                      </button>
                    ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'loading') return null
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                {msg.type === 'script_preview' && typeof msg.data?.script === 'string' && (
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {msg.data.script as string}
                  </div>
                )}
                {msg.type === 'export' && typeof msg.data?.downloadUrl === 'string' && sessionId && (
                  <ExportToolbar
                    sessionId={sessionId}
                    downloadUrl={msg.data.downloadUrl as string}
                    showTtsPanel={tts.showTtsPanel}
                    onToggleTtsPanel={() => tts.setShowTtsPanel((v) => !v)}
                    audioUrl={tts.audioUrl}
                    audioChaptersLen={tts.audioChapters.length}
                    ttsLoading={tts.ttsLoading}
                    onTTS={handleTTS}
                    ttsMode={tts.ttsMode}
                    ttsVoice={tts.ttsVoice}
                    ttsRate={tts.ttsRate}
                    ttsVolume={tts.ttsVolume}
                    ttsPitch={tts.ttsPitch}
                    onTtsModeChange={tts.setTtsMode}
                    onTtsVoiceChange={tts.setTtsVoice}
                    onTtsRateChange={tts.setTtsRate}
                    onTtsVolumeChange={tts.setTtsVolume}
                    onTtsPitchChange={tts.setTtsPitch}
                    presentationLoading={pres.presentationLoading}
                    onGeneratePresentation={handleGeneratePresentation}
                    presentationReady={pres.presentationReady}
                    pptxUrl={getPresentationPptxUrl(sessionId)}
                    onOpenPresentation={handleOpenPresentation}
                    presentationTtsLoading={pres.presentationTtsLoading}
                    presentationHasAudio={pres.presentationHasAudio}
                    onPresentationTTS={handlePresentationTTS}
                    presentationAudioZipUrl={getPresentationAudioZipUrl(sessionId)}
                    presentationVideoLoading={pres.presentationVideoLoading}
                    presentationVideoReady={pres.presentationVideoReady}
                    onGenerateVideo={handleGenerateVideo}
                    videoUrl={getPresentationVideoUrl(sessionId)}
                  />
                )}
                {msg.type === 'audio' && msg.data?.mode === 'full' && typeof msg.data?.audioUrl === 'string' && (
                  <div className="mt-3 space-y-2">
                    <audio controls className="w-full" src={msg.data.audioUrl as string} />
                    <a href={msg.data.audioUrl as string} className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors" download>
                      下载音频文件
                    </a>
                  </div>
                )}
                {msg.type === 'audio' && msg.data?.mode === 'chapters' && (
                  <div className="mt-3 space-y-3">
                    {(msg.data.chapters as ChapterAudioFile[]).map((ch) => (
                      <div key={ch.chapter} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">{ch.chapter}. {ch.title}</p>
                        <audio controls className="w-full mb-2" src={sessionId ? getAudioDownloadUrl(sessionId, ch.chapter) : ''} />
                        <a href={sessionId ? getAudioDownloadUrl(sessionId, ch.chapter) : '#'} className="text-xs text-purple-600 hover:text-purple-700" download>下载本章</a>
                      </div>
                    ))}
                    {typeof msg.data?.zipUrl === 'string' && (
                      <a href={msg.data.zipUrl as string} className="inline-block px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors" download>
                        下载全部（ZIP）
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isRunning && <LoadingIndicator step={currentStep} />}

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

      {/* Input Area */}
      {!interrupt && !(isUploadSession && sessionId) && (
        <InputArea
          mode={mode}
          onModeChange={setMode}
          input={input}
          onInputChange={setInput}
          isRunning={isRunning}
          onStart={handleStart}
          uploadText={uploadText}
          onUploadTextChange={setUploadText}
          uploadTitle={uploadTitle}
          onUploadTitleChange={setUploadTitle}
          uploadLoading={uploadLoading}
          onUploadScript={handleUploadScript}
          onFileUpload={handleFileUpload}
        />
      )}

      <HistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onResume={handleResumeSession}
      />
    </div>
  )
}
