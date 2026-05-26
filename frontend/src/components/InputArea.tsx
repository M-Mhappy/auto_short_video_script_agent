interface InputAreaProps {
  mode: 'direct' | 'keyword' | 'upload'
  onModeChange: (mode: 'direct' | 'keyword' | 'upload') => void
  input: string
  onInputChange: (val: string) => void
  isRunning: boolean
  onStart: () => void
  // upload
  uploadText: string
  onUploadTextChange: (val: string) => void
  uploadTitle: string
  onUploadTitleChange: (val: string) => void
  uploadLoading: boolean
  onUploadScript: () => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function InputArea({
  mode, onModeChange,
  input, onInputChange,
  isRunning, onStart,
  uploadText, onUploadTextChange,
  uploadTitle, onUploadTitleChange,
  uploadLoading, onUploadScript, onFileUpload,
}: InputAreaProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex gap-1 mb-3 flex-wrap">
          <button
            onClick={() => onModeChange('direct')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === 'direct'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            按书名搜索
          </button>
          <button
            onClick={() => onModeChange('keyword')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === 'keyword'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            按描述找书
          </button>
          <button
            onClick={() => onModeChange('upload')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === 'upload'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            上传口播稿
          </button>
        </div>
        {mode === 'upload' ? (
          <div className="space-y-3">
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="稿件标题（可选），用于文件命名"
              value={uploadTitle}
              onChange={(e) => onUploadTitleChange(e.target.value)}
              disabled={uploadLoading}
            />
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm min-h-[120px] max-h-48 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y"
              placeholder="粘贴口播稿全文，建议使用 ## 章节标题 分段..."
              value={uploadText}
              onChange={(e) => onUploadTextChange(e.target.value)}
              disabled={uploadLoading}
            />
            <div className="flex flex-wrap gap-3 items-center">
              <label className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                选择 .txt / .md 文件
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={onFileUpload}
                  disabled={uploadLoading}
                />
              </label>
              <button
                type="button"
                onClick={onUploadScript}
                disabled={uploadLoading || !uploadText.trim()}
                className={`flex-1 min-w-[140px] px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  uploadLoading || !uploadText.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
                }`}
              >
                {uploadLoading ? '处理中...' : '开始处理'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder={
                mode === 'direct'
                  ? '输入书名，如：三体、人类简史'
                  : '描述你想要的书，如：推荐一本关于时间管理的书'
              }
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isRunning && onStart()}
              disabled={isRunning}
            />
            <button
              onClick={onStart}
              disabled={isRunning || !input.trim()}
              className={`px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                isRunning || !input.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
              }`}
            >
              {isRunning ? '处理中...' : '开始生成'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
