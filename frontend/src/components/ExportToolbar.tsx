import TTSSettingsPanel from './TTSSettingsPanel'

interface ExportToolbarProps {
  sessionId: string
  downloadUrl: string
  // TTS
  showTtsPanel: boolean
  onToggleTtsPanel: () => void
  audioUrl: string | null
  audioChaptersLen: number
  ttsLoading: boolean
  onTTS: () => void
  ttsMode: 'full' | 'chapters'
  ttsVoice: string
  ttsRate: number
  ttsVolume: number
  ttsPitch: number
  onTtsModeChange: (m: 'full' | 'chapters') => void
  onTtsVoiceChange: (v: string) => void
  onTtsRateChange: (v: number) => void
  onTtsVolumeChange: (v: number) => void
  onTtsPitchChange: (v: number) => void
  // Presentation
  presentationLoading: boolean
  onGeneratePresentation: () => void
  presentationReady: boolean
  narrationScriptUrl: string
  onOpenPresentation: (auto: boolean) => void
  presentationTtsLoading: boolean
  presentationHasAudio: boolean
  onPresentationTTS: () => void
  presentationAudioZipUrl: string
}

export default function ExportToolbar({
  downloadUrl,
  showTtsPanel, onToggleTtsPanel,
  audioUrl, audioChaptersLen,
  ttsLoading, onTTS,
  ttsMode, ttsVoice, ttsRate, ttsVolume, ttsPitch,
  onTtsModeChange, onTtsVoiceChange, onTtsRateChange, onTtsVolumeChange, onTtsPitchChange,
  presentationLoading, onGeneratePresentation,
  presentationReady, narrationScriptUrl,
  onOpenPresentation,
  presentationTtsLoading, presentationHasAudio, onPresentationTTS,
  presentationAudioZipUrl,
}: ExportToolbarProps) {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={downloadUrl}
          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          download
        >
          下载 Word 文档
        </a>
        <button
          type="button"
          onClick={onToggleTtsPanel}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          配音设置
        </button>
        {!audioUrl && audioChaptersLen === 0 && (
          <button
            onClick={onTTS}
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
          onClick={onGeneratePresentation}
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
            <button
              type="button"
              onClick={() => onOpenPresentation(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              打开网页演示
            </button>
            <a
              href={narrationScriptUrl}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              download
            >
              下载配音稿
            </a>
            <button
              type="button"
              onClick={onPresentationTTS}
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
                  href={presentationAudioZipUrl}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                  download
                >
                  下载演示配音
                </a>
                <button
                  type="button"
                  onClick={() => onOpenPresentation(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  自动播放演示（录屏用）
                </button>
              </>
            )}
          </>
        )}
      </div>
      {showTtsPanel && (
        <TTSSettingsPanel
          ttsMode={ttsMode}
          ttsVoice={ttsVoice}
          ttsRate={ttsRate}
          ttsVolume={ttsVolume}
          ttsPitch={ttsPitch}
          onModeChange={onTtsModeChange}
          onVoiceChange={onTtsVoiceChange}
          onRateChange={onTtsRateChange}
          onVolumeChange={onTtsVolumeChange}
          onPitchChange={onTtsPitchChange}
        />
      )}
    </div>
  )
}
