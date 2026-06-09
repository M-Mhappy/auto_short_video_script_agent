import { useState, useEffect, useCallback } from 'react'
import type { HistoryItem, ResumeInfo } from '../api'
import { getHistory, getResumeInfo, getDownloadUrl, getAudioZipUrl, getPresentationAudioZipUrl } from '../api'

interface HistoryPanelProps {
  open: boolean
  onClose: () => void
  onResume: (info: ResumeInfo) => void
}

export default function HistoryPanel({ open, onClose, onResume }: HistoryPanelProps) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [resumeLoading, setResumeLoading] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHistory(10)
      setItems(data.sessions)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchHistory()
  }, [open, fetchHistory])

  const handleResume = async (sessionId: string) => {
    setResumeLoading(sessionId)
    try {
      const info = await getResumeInfo(sessionId)
      onResume(info)
      onClose()
    } catch {
      /* ignore */
    } finally {
      setResumeLoading(null)
    }
  }

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const fileLabels: { key: keyof HistoryItem['files']; label: string }[] = [
    { key: 'word', label: 'Word' },
    { key: 'audio', label: '配音' },
    { key: 'presentation', label: '演示' },
    { key: 'presentation_audio', label: '演示配音' },
  ]

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-96 max-w-[90vw] bg-white shadow-2xl transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">历史记录</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto h-[calc(100%-60px)] p-4 space-y-3">
          {loading && (
            <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">暂无历史记录</div>
          )}
          {items.map((item) => (
            <div key={item.session_id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              {/* Title & time */}
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatTime(item.created_at)}</p>
                </div>
                {item.is_custom && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">自定义</span>
                )}
              </div>

              {/* File badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {fileLabels.map(({ key, label }) => (
                  <span
                    key={key}
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      item.files[key]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {item.files.word && (
                  <a
                    href={getDownloadUrl(item.session_id)}
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    download
                  >
                    Word
                  </a>
                )}
                {item.files.audio && (
                  <a
                    href={getAudioZipUrl(item.session_id)}
                    className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                    download
                  >
                    配音
                  </a>
                )}
                {item.files.presentation_audio && (
                  <a
                    href={getPresentationAudioZipUrl(item.session_id)}
                    className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                    download
                  >
                    演示配音
                  </a>
                )}

                <button
                  onClick={() => handleResume(item.session_id)}
                  disabled={resumeLoading === item.session_id}
                  className="ml-auto text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {resumeLoading === item.session_id ? '加载...' : '恢复会话'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
