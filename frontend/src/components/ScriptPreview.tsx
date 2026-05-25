import { useState } from 'react'
import type { ReviewResult } from '../types'
import ScoreCard from './ScoreCard'

interface Props {
  script: string
  review?: ReviewResult
  onConfirm: () => void
  onFeedback: (feedback: string) => void
  onAbandon: () => void
}

function renderScriptBody(script: string) {
  const lines = script.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h4
          key={i}
          className="text-base font-bold text-gray-900 mt-4 mb-2 first:mt-0 border-l-4 border-blue-500 pl-3"
        >
          {line.slice(3).trim()}
        </h4>
      )
    }
    if (!line.trim()) {
      return <div key={i} className="h-2" />
    }
    return (
      <p key={i} className="text-gray-700 leading-relaxed text-sm mb-1">
        {line}
      </p>
    )
  })
}

export default function ScriptPreview({
  script,
  review,
  onConfirm,
  onFeedback,
  onAbandon,
}: Props) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const wordCount = script.replace(/\s/g, '').length
  const minutes = Math.round(wordCount / 250)
  const chapterCount = (script.match(/^## /gm) || []).length

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">口播稿预览</h3>
        <div className="text-sm text-gray-400">
          约 {wordCount} 字 / {minutes} 分钟
          {chapterCount > 0 && ` / ${chapterCount} 章`}
        </div>
      </div>

      {review && (
        <div className="mb-4">
          <ScoreCard review={review} />
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-5 mb-4 max-h-96 overflow-y-auto">
        <div>{renderScriptBody(script)}</div>
      </div>

      {!showFeedback ? (
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
          >
            确认，导出 Word
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            className="flex-1 py-2.5 border border-blue-400 text-blue-500 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            提交修改建议
          </button>
          <button
            onClick={onAbandon}
            className="px-4 py-2.5 text-gray-400 hover:text-red-500 transition-colors text-sm"
          >
            放弃
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            rows={4}
            placeholder="请输入您的修改建议，例如：&#10;- 开头太平淡，需要更抓人的钩子&#10;- 第三章的内容描述不够详细&#10;- 整体风格偏严肃，希望更轻松一些"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (feedback.trim()) {
                  onFeedback(feedback)
                  setFeedback('')
                  setShowFeedback(false)
                }
              }}
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              提交修改
            </button>
            <button
              onClick={() => setShowFeedback(false)}
              className="px-4 py-2.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
