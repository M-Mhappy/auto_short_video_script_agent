import { VOICE_OPTIONS } from '../hooks/useTTS'

interface TTSSettingsPanelProps {
  ttsMode: 'full' | 'chapters'
  ttsVoice: string
  ttsRate: number
  ttsVolume: number
  ttsPitch: number
  onModeChange: (mode: 'full' | 'chapters') => void
  onVoiceChange: (voice: string) => void
  onRateChange: (rate: number) => void
  onVolumeChange: (volume: number) => void
  onPitchChange: (pitch: number) => void
}

export default function TTSSettingsPanel({
  ttsMode, ttsVoice, ttsRate, ttsVolume, ttsPitch,
  onModeChange, onVoiceChange, onRateChange, onVolumeChange, onPitchChange,
}: TTSSettingsPanelProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 text-sm">
      <div>
        <label className="block text-gray-600 mb-1 font-medium">合成模式</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onModeChange('full')}
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
            onClick={() => onModeChange('chapters')}
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
          onChange={(e) => onVoiceChange(e.target.value)}
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
          onChange={(e) => onRateChange(Number(e.target.value))}
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
          onChange={(e) => onVolumeChange(Number(e.target.value))}
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
          onChange={(e) => onPitchChange(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>低沉</span><span>正常</span><span>尖锐</span>
        </div>
      </div>
    </div>
  )
}
