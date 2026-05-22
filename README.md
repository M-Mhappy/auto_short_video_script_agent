# 智能口播稿生成器

围绕一本书生成 8-15 分钟讲故事式口播稿的 AI Agent。

## 技术栈

- **后端**: FastAPI + LangGraph + LangChain
- **前端**: React + Vite + TailwindCSS
- **LLM**: DeepSeek（OpenAI 兼容接口）
- **搜索**: Tavily Search API

## 快速开始

### 1. 配置环境变量

将 `.env.example` 复制为 `.env` 并填入 API Key：

```bash
cp .env.example .env
```

需要配置：
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- `TAVILY_API_KEY` - Tavily Search API 密钥

### 2. 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

### 3. 启动后端

在项目根目录运行：

```bash
python -m backend.main
```

后端启动在 `http://localhost:8000`

### 4. 安装并启动前端

```bash
cd frontend
npm install
npm run dev
```

前端启动在 `http://localhost:5173`，自动代理 `/api` 到后端。

## 使用方式

1. 打开 `http://localhost:5173`
2. 输入书名（如"三体"）或描述需求（如"推荐一本关于心理学的书"）
3. 从搜索结果中选择一本书
4. 等待 AI 生成口播稿并审核
5. 预览口播稿，确认或提交修改建议
6. 导出 Word 文档
