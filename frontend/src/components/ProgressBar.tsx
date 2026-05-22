const STEPS = [
  { key: 'entry', label: '解析输入' },
  { key: 'extract_keywords', label: '提取关键词' },
  { key: 'search_books', label: '搜索书籍' },
  { key: 'confirm_book', label: '确认书籍' },
  { key: 'generate_script', label: '生成口播稿' },
  { key: 'review_script', label: '审核打分' },
  { key: 'preview_script', label: '预览确认' },
  { key: 'export_word', label: '导出文档' },
]

interface Props {
  currentStep: string
}

export default function ProgressBar({ currentStep }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="w-full px-4 py-3">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const isActive = step.key === currentStep
          const isDone = currentIndex > i

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  className={`mt-1 text-xs whitespace-nowrap ${
                    isActive ? 'text-blue-600 font-semibold' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-16px] ${
                    isDone ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
