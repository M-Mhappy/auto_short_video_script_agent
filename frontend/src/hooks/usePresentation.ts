import { useState, useCallback } from 'react'
import type { PresentationData } from '../api'
import { getPresentation } from '../api'

export function usePresentation() {
  const [presentationReady, setPresentationReady] = useState(false)
  const [presentationHasAudio, setPresentationHasAudio] = useState(false)
  const [presentationLoading, setPresentationLoading] = useState(false)
  const [presentationTtsLoading, setPresentationTtsLoading] = useState(false)
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null)
  const [presentationAuto, setPresentationAuto] = useState(false)
  const [viewMode, setViewMode] = useState<'chat' | 'presentation'>('chat')

  const openPresentation = useCallback(async (sid: string, auto: boolean) => {
    const data = await getPresentation(sid)
    setPresentationData(data)
    setPresentationHasAudio(data.has_audio)
    setPresentationAuto(auto)
    setViewMode('presentation')
  }, [])

  const resetPresentation = useCallback(() => {
    setViewMode('chat')
    setPresentationReady(false)
    setPresentationHasAudio(false)
    setPresentationData(null)
    setPresentationAuto(false)
  }, [])

  return {
    presentationReady, setPresentationReady,
    presentationHasAudio, setPresentationHasAudio,
    presentationLoading, setPresentationLoading,
    presentationTtsLoading, setPresentationTtsLoading,
    presentationData, setPresentationData,
    presentationAuto, setPresentationAuto,
    viewMode, setViewMode,
    openPresentation,
    resetPresentation,
  }
}
