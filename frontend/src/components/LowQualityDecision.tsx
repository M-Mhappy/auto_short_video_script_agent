import type { ReviewResult } from '../types'
import ScoreCard from './ScoreCard'

interface Props {
  review: ReviewResult
  message: string
  onAccept: () => void
  onAbandon: () => void
}

export default function LowQualityDecision({
  review,
  message,
  onAccept,
  onAbandon,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">⚠️</span>
        <h3 className="text-lg font-semibold text-orange-700">质量未达标</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{message}</p>

      <div className="mb-4">
        <ScoreCard review={review} />
      </div>

      <p className="text-xs text-gray-400 mb-3">
        该书信息不足以生成高质量口播稿，建议换一本热门书试试。
      </p>

      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="flex-1 py-2.5 border border-orange-400 text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors"
        >
          接受当前稿件
        </button>
        <button
          onClick={onAbandon}
          className="flex-1 py-2.5 text-gray-400 border border-gray-300 rounded-lg hover:text-red-500 hover:border-red-300 transition-colors"
        >
          放弃，换本书
        </button>
      </div>
    </div>
  )
}
