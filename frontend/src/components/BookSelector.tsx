import { useState } from 'react'
import type { BookInfo } from '../types'

interface Props {
  books: BookInfo[]
  onSelect: (index: number) => void
  onRetry: () => void
  onResearch: (query: string) => void
  onAbandon: () => void
  searchRetryCount: number
  maxSearchRetries: number
}

export default function BookSelector({ books, onSelect, onRetry, onResearch, onAbandon, searchRetryCount, maxSearchRetries }: Props) {
  const canRetry = searchRetryCount < maxSearchRetries
  const [researchQuery, setResearchQuery] = useState('')
  const [showResearch, setShowResearch] = useState(false)

  if (books.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <p className="text-gray-500 mb-4">未找到相关书籍，请尝试其他关键词。</p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="输入新的搜索关键词..."
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && researchQuery.trim() && onResearch(researchQuery)}
          />
          <button
            onClick={() => researchQuery.trim() && onResearch(researchQuery)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
          >
            重新搜索
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        找到以下书籍，请选择一本：
      </h3>
      <div className="space-y-3">
        {books.map((book, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelect(i)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                  《{book.title}》
                </h4>
                <p className="text-sm text-gray-500 mt-1">作者：{book.author}</p>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{book.intro}</p>
                {book.relevance_reason && (
                  <p className="text-xs text-blue-500 mt-2">
                    推荐理由：{book.relevance_reason}
                  </p>
                )}
              </div>
              <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity ml-4 text-sm">
                选择 →
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
        {!showResearch ? (
          <>
            {canRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              >
                换一批（{maxSearchRetries - searchRetryCount} 次）
              </button>
            )}
            <button
              onClick={() => setShowResearch(true)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              换个关键词搜索
            </button>
            <button
              onClick={onAbandon}
              className="px-4 py-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              放弃
            </button>
          </>
        ) : (
          <div className="flex gap-2 w-full">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="输入新的搜索关键词..."
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && researchQuery.trim() && onResearch(researchQuery)
              }
              autoFocus
            />
            <button
              onClick={() => researchQuery.trim() && onResearch(researchQuery)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              搜索
            </button>
            <button
              onClick={() => setShowResearch(false)}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
