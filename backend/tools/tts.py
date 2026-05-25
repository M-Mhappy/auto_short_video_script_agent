import os
import re
import uuid

import edge_tts


def _safe_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip()


async def generate_audio(
    text: str, voice: str, output_dir: str, proxy: str = "",
    book_title: str = "",
    rate: str = "+0%", volume: str = "+0%", pitch: str = "+0Hz",
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    prefix = _safe_filename(book_title) if book_title else "voiceover"
    filename = f"{prefix}_口播稿_{uuid.uuid4().hex[:6]}.mp3"
    filepath = os.path.join(output_dir, filename)
    communicate = edge_tts.Communicate(
        text, voice, rate=rate, volume=volume, pitch=pitch,
        proxy=proxy or None,
    )
    await communicate.save(filepath)
    return filepath
