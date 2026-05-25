import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "checkpoints.db")
OUTPUT_BASE = os.path.join(os.path.dirname(__file__), "output")

TTS_VOICE = os.getenv("TTS_VOICE", "zh-CN-YunxiNeural")
TTS_PROXY = os.getenv("TTS_PROXY", "")
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")

REVIEW_PASS_THRESHOLD = 80
REVIEW_RETRY_THRESHOLD = 60
MAX_RETRY_COUNT = 2

SCRIPT_ENDING = (
    "\n\n我不是作者，也不是学者，我只是优秀书籍的搬运工——我是瑞莱克斯。"
    "如果刚才的故事触动到了你心中的某个角落，我强烈建议你亲自走进那片文字的丛林，你一定会收获更多。"
    "感谢倾听，我们下本书再见。"
)
