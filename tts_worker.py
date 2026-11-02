#!/usr/bin/env python3
"""
Persistent ZeroTTS Worker Daemon (voice='maichi' default).
- Strict Vietnamese-only text sanitizer: strips all Cuneiform (𒐫), Zalgo, emojis, and foreign scripts
  before passing to ZeroTTS so the model never chokes or glitches.
- Single-pass continuous synthesis + soft peak normalization (<= 0.90) + cosine fade-in/out.
- Low CPU configuration: intra_op_num_threads=3 + OMP_WAIT_POLICY=PASSIVE (0% CPU when idle).
"""
import hashlib
import json
import os
import re
import sys
import time
import builtins
import traceback
import unicodedata
from pathlib import Path

_orig_open = builtins.open


def _utf8_default_open(file, mode="r", buffering=-1, encoding=None, *args, **kwargs):
    if "b" not in mode and encoding is None:
        encoding = "utf-8"
    return _orig_open(file, mode, buffering, encoding, *args, **kwargs)


builtins.open = _utf8_default_open

if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

os.environ.setdefault("OMP_NUM_THREADS", "3")
os.environ.setdefault("OMP_WAIT_POLICY", "PASSIVE")
os.environ.setdefault("MKL_NUM_THREADS", "3")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "3")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "3")

import numpy as np
from zerotts import ZeroTTS, normalize_vi_text
from zerotts.audio import concat_with_silence
from zerotts.chunking import _atomize, clean_segment_punctuation, normalize_punctuation, split_sentences

CACHE_DIR = Path(__file__).resolve().parent / "data" / "tts-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

LOCAL_MODEL_CANDIDATES = [
    os.environ.get("ZEROTTS_MODEL_PATH", ""),
    str(Path(__file__).resolve().parent / "models" / "zerotts"),
]

# Chỉ giữ lại chữ cái tiếng Việt (Latin + dấu tiếng Việt), chữ số và dấu câu cơ bản
VIETNAMESE_ALLOWED_RE = re.compile(
    r"[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]"
)
MODERATION_NON_WORD_RE = re.compile(
    r"[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]+"
)
BRACKET_EMOTE_RE = re.compile(r"\[[^\]]{1,24}\]")
REPEATED_CHARS_RE = re.compile(r"(.)\1{2,}", re.IGNORECASE)
MULTI_PUNCT_RE = re.compile(r"([.,!?])\1+")
MULTI_SPACE_RE = re.compile(r"\s+")
MOCKING_EMOJI_RE = re.compile(r"[🤣😂😆😜🤪🤡💩🖕🤮🤢]")
SARCASTIC_QUESTION_RE = re.compile(r"\?\s*\?+")

STANDALONE_PROFANE_TOKENS = {
    "đm", "dm", "đmm", "dmm", "đkm", "dkm", "đcm", "dcm", "đcmm", "dcmm", "đklm",
    "vcl", "vl", "vkl", "vler", "vll", "vcc", "vc", "cc", "cl", "clm", "cmm", "cml",
    "đéo", "deo", "đếch", "đệch", "đệt", "đjt", "djt", "dit", "đit", "địt",
    "lồn", "lon", "loz", "lờ", "cặc", "cac", "cak", "cẹc", "buồi", "buoi",
    "dái", "cứt", "cut", "đái", "đĩ", "điếm", "phò", "cave", "chịch", "xoạc",
    "nứng", "dâm", "sục", "đụ", "đù", "đụmá", "đụmẹ", "đmá", "đmẹ", "mịa",
    "clgt", "wtf", "wth", "lol", "lmao", "ngu", "đần", "cút", "bịp", "sex", "porn", "jav",
    "haha", "hehe", "hihi", "ohehe", "hoho", "kaka", "sặc",
}

PROFANE_OR_DISRESPECTFUL_PHRASES = (
    "bóp dái", "đá dái", "vãi l", "vãi c", "vãi đ", "vãi chưởng",
    "cái lồn", "con cặc", "đầu buồi", "đầu bùi", "ăn cứt", "chi cứt", "cục cứt",
    "con đĩ", "con phò", "thằng chó", "con chó", "chó đẻ", "óc chó", "óc lợn",
    "súc vật", "khốn nạn", "mẹ kiếp", "mẹ mày", "má mày", "bố mày", "cha mày",
    "ông nội mày", "bà nội mày", "cả lò", "tổ sư", "tiên sư", "mả cha", "mả mẹ",
    "chết tiệt", "chết bầm", "chết mẹ", "chết cha", "hiếp dâm", "ấu dâm", "khiêu dâm",
    "i cư", "kimochi", "yamate", "yamete", "tài xỉu", "cá độ", "nổ hũ", "nhà cái",
    "lừa đảo", "lừa à", "te le gram", "telegram", "bố là trùm",
    "hết trò", "làm trò", "trò hề", "câu view", "câu like", "nhảm nhí", "xàm xí",
    "tào lao", "vớ vẩn", "rảnh háng", "báng bổ", "phỉ báng", "dị giáo", "tà đạo",
    "giả tạo", "diễn sâu", "như thật", "chịu đấy", "chịu luôn", "vụ này luôn",
    "hết chùa", "sang nhà thờ", "chúa giả", "phật giả", "tẩy chay", "rác rưởi",
    "ủa alo", "ủa rồi", "lạy luôn",
)

COMPACT_BLOCKED_SUBSTRINGS = (
    "bópdái", "bopdai", "đádái", "dadai", "đầubuồi", "daubuoi", "cáilồn", "concặc",
    "ăncứt", "chicứt", "cụccứt", "conđĩ", "conphò", "chóđẻ", "ócchó", "súcvật",
    "khốnnạn", "mẹkiếp", "mẹmày", "bốmày", "chếttiệt", "chếtmẹ", "hiếpdâm", "ấudâm",
    "xnxx", "xvideos", "pornhub", "yamate", "yamete", "kimochi", "tàixỉu", "nổhũ",
    "kubet", "sunwin", "go88", "lừađảo", "telegram", "bốlàtrùm", "đụmá", "đụmẹ",
    "địtmẹ", "vãilồn", "vãicặc", "hếttrò", "nhưthật", "chịuđấy", "hếtchùa",
    "sangnhàthờ", "ohehe",
)


def is_toxic_or_disrespectful(raw_text: str) -> bool:
    if not raw_text:
        return True
    s = str(raw_text).strip()
    if not s:
        return True
    if s.startswith("@") or MOCKING_EMOJI_RE.search(s) or SARCASTIC_QUESTION_RE.search(s):
        return True
    lower = unicodedata.normalize("NFC", unicodedata.normalize("NFKC", s)).lower()
    words = MULTI_SPACE_RE.sub(" ", MODERATION_NON_WORD_RE.sub(" ", lower)).strip()
    if not words:
        return True
    spaced = f" {words} "
    compact = words.replace(" ", "")
    collapsed_words = REPEATED_CHARS_RE.sub(r"\1", words)
    collapsed_spaced = f" {collapsed_words} "
    collapsed_compact = REPEATED_CHARS_RE.sub(r"\1", compact)
    for tk in STANDALONE_PROFANE_TOKENS:
        needle = f" {tk} "
        if needle in spaced or needle in collapsed_spaced:
            return True
    for p in PROFANE_OR_DISRESPECTFUL_PHRASES:
        needle = f" {p} "
        if needle in spaced or needle in collapsed_spaced:
            return True
    for sub in COMPACT_BLOCKED_SUBSTRINGS:
        if sub in compact or sub in collapsed_compact:
            return True
    return False


def resolve_model_source() -> str:
    for candidate in LOCAL_MODEL_CANDIDATES:
        if candidate and os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "config.json")):
            return candidate
    return "zeroweight-ai/ZeroTTS"


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def clean_and_normalize_text(raw_text: str, max_chars: int = 550) -> str:
    if not raw_text or is_toxic_or_disrespectful(raw_text):
        return ""
    # 1. Chuẩn hóa NFKC (biến chữ kiểu toán học 𝒯𝒽𝒾ê𝓃 𝒯â𝓂 -> Thiên Tâm) rồi NFC
    text = unicodedata.normalize("NFC", unicodedata.normalize("NFKC", str(raw_text)))
    # 2. Xóa các mã emote kiểu [thanks], [rose]
    text = BRACKET_EMOTE_RE.sub(" ", text)
    # 2b. Chuyển dấu ':', ';', '—', '–', '-' thành dấu phẩy ', ' để giữ nhịp nghỉ tự nhiên
    text = re.sub(r"[:;—–-]+", ", ", text)
    # 3. Xóa sạch ký tự lạ (𒐫, emoji, ký tự ngoại ngữ, ký tự điều khiển)
    text = VIETNAMESE_ALLOWED_RE.sub(" ", text)
    # 4. Thu gọn ký tự lặp quá 2 lần (ví dụ: aaaaa -> aa, ..... -> .)
    text = MULTI_PUNCT_RE.sub(r"\1", text)
    text = REPEATED_CHARS_RE.sub(r"\1\1", text)
    text = MULTI_SPACE_RE.sub(" ", text).strip(" .,!?-")

    # Phải có ít nhất 2 chữ cái hợp lệ mới đọc
    letters = re.findall(r"[a-zA-ZÀ-ỹĂăĐđĨĩŨũƠơƯư]", text)
    if len(letters) < 2:
        return ""

    # Giới hạn độ dài an toàn cho 1 câu đọc TTS / câu kinh Phật & Công Giáo
    limit = max(80, min(650, int(max_chars or 550)))
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0]

    normalized = normalize_vi_text(text)
    normalized = normalize_punctuation(normalized).strip()
    normalized = VIETNAMESE_ALLOWED_RE.sub(" ", normalized)
    normalized = MULTI_SPACE_RE.sub(" ", normalized).strip()
    if normalized and normalized[-1] not in ".!?":
        normalized += "."
    return normalized


def split_into_speakable_segments(norm_text: str) -> list[str]:
    """
    Tách văn bản theo câu độc lập (split_sentences) và khử triệt để mọi dấu '.' / '!' / '?'
    nằm bên trong từng segment để ZeroTTS không bao giờ phát tín hiệu <eoa> cắt cụt giữa câu!
    Nếu một câu dài > 165 ký tự, gom các vế ngăn cách bởi dấu phẩy ',' thành các cụm <= 165 ký tự
    (giữ nguyên dấu phẩy ',' bên trong cụm để giọng đọc liền mạch, tự nhiên).
    """
    merged_text = re.sub(r"[.!?]+\s*(Amen\.?)$", r", \1", norm_text, flags=re.IGNORECASE)
    raw_sentences = split_sentences(merged_text) or [merged_text]
    pieces: list[str] = []
    for sent in raw_sentences:
        s = sent.strip()
        if not s:
            continue
        if len(s) <= 175:
            pieces.append(s)
        else:
            clauses = [c.strip() for c in s.split(",") if c.strip()]
            cur = ""
            for c in clauses:
                cand = f"{cur}, {c}" if cur else c
                if len(cand) <= 165 or not cur:
                    cur = cand
                else:
                    pieces.append(cur)
                    cur = c
            if cur:
                if pieces and len(cur) < 35:
                    pieces[-1] = f"{pieces[-1]}, {cur}"
                else:
                    pieces.append(cur)

    segments: list[str] = []
    for piece in pieces:
        p = clean_segment_punctuation(piece)
        if not p:
            continue
        body = p[:-1] if p[-1] in ".!?" else p
        body = re.sub(r"[.!?]+", ",", body)
        body = re.sub(r",\s*,+", ",", body)
        body = MULTI_SPACE_RE.sub(" ", body).strip(" ,;-")
        if body:
            segments.append(body + ".")

    if not segments:
        fallback = clean_segment_punctuation(norm_text)
        if fallback:
            segments = [fallback]
    return segments


def polish_waveform(wav: np.ndarray, sample_rate: int, target_peak: float = 0.95) -> np.ndarray:
    """De-click ends, normalize to target_peak, and prevent PCM_16 digital clipping ('xước/rè')."""
    arr = np.asarray(wav, dtype=np.float32).reshape(-1)
    if arr.size == 0:
        return arr.reshape(1, 0)

    arr = arr - np.mean(arr)

    peak = float(np.max(np.abs(arr)))
    if peak > 1e-5:
        arr = arr * (target_peak / peak)

    fade_in = min(int(sample_rate * 0.012), arr.size // 4)
    fade_out = min(int(sample_rate * 0.020), arr.size // 4)
    if fade_in > 1:
        ramp_in = 0.5 * (1.0 - np.cos(np.linspace(0, np.pi, fade_in, dtype=np.float32)))
        arr[:fade_in] *= ramp_in
    if fade_out > 1:
        ramp_out = 0.5 * (1.0 + np.cos(np.linspace(0, np.pi, fade_out, dtype=np.float32)))
        arr[-fade_out:] *= ramp_out

    return arr.reshape(1, -1)


def main() -> None:
    t0 = time.time()
    model_src = resolve_model_source()
    emit({"type": "status", "status": "loading", "model": model_src})

    try:
        tts = ZeroTTS.from_pretrained(model_src, intra_op_num_threads=3)
        voices = tts.list_voices()
        default_voice = "maichi" if "maichi" in voices else (voices[0] if voices else None)
        load_sec = round(time.time() - t0, 2)
        emit({
            "type": "ready",
            "model": model_src,
            "voice": default_voice,
            "voices": voices,
            "sampleRate": int(tts.sample_rate),
            "loadSec": load_sec,
        })
    except Exception as exc:
        emit({
            "type": "error",
            "fatal": True,
            "error": str(exc),
            "trace": traceback.format_exc(),
        })
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            text = (req.get("text") or "").strip()
            voice = (req.get("voice") or "maichi").strip().lower()
            if voice not in voices:
                voice = "maichi"

            norm_text = clean_and_normalize_text(text)
            if not norm_text:
                emit({"type": "result", "id": req_id, "ok": False, "error": "Filtered empty/spam text"})
                continue

            is_scripture_voice = voice in ("huuduc", "kimoanh", "quangminh", "tiendat", "giahuy")
            cache_ver = "v8_full"
            target_peak = 0.95 if is_scripture_voice else 0.68

            cache_key = hashlib.sha1(f"{cache_ver}::{voice}::{norm_text}".encode("utf-8")).hexdigest()[:20]
            out_name = f"{voice}_{cache_key}.wav"
            out_path = CACHE_DIR / out_name

            if out_path.is_file() and out_path.stat().st_size > 200:
                emit({
                    "type": "result",
                    "id": req_id,
                    "ok": True,
                    "cached": True,
                    "voice": voice,
                    "file": out_name,
                    "url": f"/tts-cache/{out_name}",
                    "synthSec": 0.0,
                })
                continue

            t_synth = time.time()
            segments = split_into_speakable_segments(norm_text)
            wav_chunks = []
            for seg in segments:
                chunk_wav = tts.synthesize(seg, voice=voice, eoa_extra_frames=3)
                if chunk_wav is not None and chunk_wav.size > 0:
                    wav_chunks.append(chunk_wav)
            if not wav_chunks:
                emit({"type": "result", "id": req_id, "ok": False, "error": "No audio generated"})
                continue
            raw_wav = (
                concat_with_silence(wav_chunks, 0.16, int(tts.sample_rate))
                if len(wav_chunks) > 1
                else wav_chunks[0]
            )

            clean_audio = polish_waveform(raw_wav, int(tts.sample_rate), target_peak=target_peak)
            tts.save_audio(clean_audio, str(out_path))
            synth_sec = round(time.time() - t_synth, 2)
            duration_sec = round(clean_audio.shape[-1] / float(tts.sample_rate), 2)

            emit({
                "type": "result",
                "id": req_id,
                "ok": True,
                "cached": False,
                "voice": voice,
                "file": out_name,
                "url": f"/tts-cache/{out_name}",
                "synthSec": synth_sec,
                "durationSec": duration_sec,
            })
        except Exception as exc:
            emit({
                "type": "result",
                "id": req_id,
                "ok": False,
                "error": str(exc),
            })


if __name__ == "__main__":
    main()
