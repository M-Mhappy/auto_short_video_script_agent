const STEP_LABELS: Record<string, string> = {
  entry: '正在解析您的输入...',
  extract_keywords: '正在提取关键词...',
  search_books: '正在搜索相关书籍...',
  load_reference: '正在加载参考示例...',
  generate_script: '正在生成口播稿，这可能需要一两分钟...',
  review_script: '正在审核口播稿质量...',
  retry_generate: '审核未通过，正在重新生成...',
  apply_feedback: '正在根据您的反馈修改稿件...',
  export_word: '正在导出 Word 文档...',
}

interface Props {
  step: string
}

export default function LoadingIndicator({ step }: Props) {
  const label = STEP_LABELS[step] || '处理中...'

  return (
    <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-5 py-4 border border-blue-100">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-sm text-blue-700">{label}</span>
    </div>
  )
}
