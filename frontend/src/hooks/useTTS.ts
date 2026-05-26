import { useState, useCallback } from 'react'
import type { TTSParams, ChapterAudioFile } from '../api'

export const VOICE_OPTIONS = [
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

export function useTTS() {
  const [ttsLoading, setTtsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioChapters, setAudioChapters] = useState<ChapterAudioFile[]>([])
  const [showTtsPanel, setShowTtsPanel] = useState(false)
  const [ttsMode, setTtsMode] = useState<'full' | 'chapters'>('full')
  const [ttsVoice, setTtsVoice] = useState('zh-CN-YunxiNeural')
  const [ttsRate, setTtsRate] = useState(0)
  const [ttsVolume, setTtsVolume] = useState(0)
  const [ttsPitch, setTtsPitch] = useState(0)

  const ttsParams = useCallback((): TTSParams => ({
    voice: ttsVoice,
    rate: `${ttsRate >= 0 ? '+' : ''}${ttsRate}%`,
    volume: `${ttsVolume >= 0 ? '+' : ''}${ttsVolume}%`,
    pitch: `${ttsPitch >= 0 ? '+' : ''}${ttsPitch}Hz`,
  }), [ttsVoice, ttsRate, ttsVolume, ttsPitch])

  const resetTTS = useCallback(() => {
    setTtsLoading(false)
    setAudioUrl(null)
    setAudioChapters([])
    setShowTtsPanel(false)
    setTtsMode('full')
  }, [])

  return {
    ttsLoading, setTtsLoading,
    audioUrl, setAudioUrl,
    audioChapters, setAudioChapters,
    showTtsPanel, setShowTtsPanel,
    ttsMode, setTtsMode,
    ttsVoice, setTtsVoice,
    ttsRate, setTtsRate,
    ttsVolume, setTtsVolume,
    ttsPitch, setTtsPitch,
    ttsParams,
    resetTTS,
  }
}
