import asyncio
import os
import re
import uuid
import zipfile

import edge_tts

TTS_CONCURRENCY = 3


def _safe_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip()


async def generate_audio(
    text: str, voice: str, output_dir: str, proxy: str = "",
    book_title: str = "",
    rate: str = "+0%", volume: str = "+0%", pitch: str = "+0Hz",
    filename: str | None = None,
) -> str:
    os.makedirs(output_dir, exist_ok=True)
    if not filename:
        prefix = _safe_filename(book_title) if book_title else "voiceover"
        filename = f"{prefix}_口播稿_{uuid.uuid4().hex[:6]}.mp3"
    filepath = os.path.join(output_dir, filename)
    communicate = edge_tts.Communicate(
        text, voice, rate=rate, volume=volume, pitch=pitch,
        proxy=proxy or None,
    )
    await communicate.save(filepath)
    return filepath


async def generate_chapter_audios(
    chapters: list[dict],
    voice: str,
    output_dir: str,
    proxy: str = "",
    book_title: str = "",
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
) -> list[dict]:
    """Generate one MP3 per chapter with controlled concurrency."""
    os.makedirs(output_dir, exist_ok=True)
    prefix = _safe_filename(book_title) if book_title else "voiceover"
    sem = asyncio.Semaphore(TTS_CONCURRENCY)

    async def _gen(idx: int, ch: dict) -> dict | None:
        title = ch.get("title", f"第{idx}章").strip()
        content = ch.get("content", "").strip()
        if not content:
            return None
        safe_title = _safe_filename(title)[:30] or f"ch{idx}"
        fname = f"{prefix}_{idx:02d}_{safe_title}.mp3"
        async with sem:
            filepath = await generate_audio(
                content, voice, output_dir, proxy,
                book_title=book_title,
                rate=rate, volume=volume, pitch=pitch,
                filename=fname,
            )
        return {
            "chapter": idx,
            "title": title,
            "filename": os.path.basename(filepath),
            "filepath": filepath,
        }

    tasks = [_gen(idx, ch) for idx, ch in enumerate(chapters, start=1)]
    raw_results = await asyncio.gather(*tasks)
    return [r for r in raw_results if r is not None]


async def generate_step_audios(
    steps: list[dict],
    voice: str,
    output_dir: str,
    proxy: str = "",
    book_title: str = "",
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
) -> list[dict]:
    """One MP3 per presentation step with controlled concurrency."""
    os.makedirs(output_dir, exist_ok=True)
    prefix = _safe_filename(book_title) if book_title else "presentation"
    sem = asyncio.Semaphore(TTS_CONCURRENCY)

    async def _gen(idx: int, step: dict) -> dict | None:
        narration = (step.get("narration") or "").strip()
        if not narration:
            return None
        fname = f"{prefix}_step_{idx:03d}.mp3"
        async with sem:
            filepath = await generate_audio(
                narration, voice, output_dir, proxy,
                book_title=book_title,
                rate=rate, volume=volume, pitch=pitch,
                filename=fname,
            )
        return {
            "step": idx,
            "filename": os.path.basename(filepath),
            "filepath": filepath,
        }

    tasks = [_gen(idx, step) for idx, step in enumerate(steps)]
    raw_results = await asyncio.gather(*tasks)
    return [r for r in raw_results if r is not None]


def zip_audio_files(filepaths: list[str], zip_path: str) -> str:
    os.makedirs(os.path.dirname(zip_path) or ".", exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in filepaths:
            if os.path.exists(fp):
                zf.write(fp, os.path.basename(fp))
    return zip_path
