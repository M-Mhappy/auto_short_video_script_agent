import type { ReviewResult } from '../types'

interface Props {
  review: ReviewResult
}

function getScoreColor(score: number, max: number): string {
  const ratio = score / max
  if (ratio >= 0.8) return 'text-green-600'
  if (ratio >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

function getTotalBg(total: number): string {
  if (total >= 80) return 'bg-green-50 border-green-200'
  if (total >= 60) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export default function ScoreCard({ review }: Props) {
  const dimensions = [
    { label: '事实准确性', value: review.fact_accuracy },
    { label: '忠实度', value: review.fidelity },
    { label: '完整性', value: review.completeness },
    { label: '风格一致性', value: review.style_consistency },
  ]

  return (
    <div className={`rounded-xl border p-5 ${getTotalBg(review.total)}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">审核评分</h3>
        <span className={`text-2xl font-bold ${getScoreColor(review.total, 100)}`}>
          {review.total}/100
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {dimensions.map((d) => (
          <div key={d.label} className="bg-white/60 rounded-lg p-3">
            <div className="text-xs text-gray-500">{d.label}</div>
            <div className={`text-lg font-semibold ${getScoreColor(d.value, 25)}`}>
              {d.value}/25
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  d.value / 25 >= 0.8
                    ? 'bg-green-500'
                    : d.value / 25 >= 0.6
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${(d.value / 25) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {review.reasoning && (
        <div className="text-sm text-gray-700 bg-white/40 rounded-lg p-3 mb-3">
          <strong>审核理由：</strong>{review.reasoning}
        </div>
      )}

      {review.hallucinations.length > 0 && (
        <div className="text-sm text-red-600 bg-white/40 rounded-lg p-3 mb-2">
          <strong>疑似编造：</strong>
          <ul className="list-disc list-inside mt-1">
            {review.hallucinations.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {review.omissions.length > 0 && (
        <div className="text-sm text-yellow-700 bg-white/40 rounded-lg p-3">
          <strong>遗漏内容：</strong>
          <ul className="list-disc list-inside mt-1">
            {review.omissions.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
