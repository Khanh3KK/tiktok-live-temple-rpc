#!/usr/bin/env python3
"""
Milestone 11 — Export 10 Full Scripture MP3s, 10 Short TikTok MP3s, and 10 9:16 TikTok Videos
with Sparkling Golden Halo, Rotating Divine Sunbeams, Twinkling Golden Particles & Synchronized Subtitles.
"""
import json
import math
import os
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent.parent
SCRIPTURES_JS = ROOT_DIR / "public" / "js" / "scriptures.js"
TTS_CACHE_DIR = ROOT_DIR / "data" / "tts-cache"
BG_IMAGE_PATH = ROOT_DIR / "public" / "assets" / "church_stage.png"
ORGAN_BG_WAV = ROOT_DIR / "public" / "assets" / "bg_church_hymn.wav"

EXPORT_ROOT = ROOT_DIR / "exports"
MP3_FULL_DIR = EXPORT_ROOT / "mp3_full"
MP3_SHORTS_DIR = EXPORT_ROOT / "mp3_shorts"
VIDEOS_TIKTOK_DIR = EXPORT_ROOT / "videos_tiktok"

FFMPEG_BIN = r"C:\ProgramData\chocolatey\bin\ffmpeg.EXE"
if not os.path.isfile(FFMPEG_BIN):
    FFMPEG_BIN = "ffmpeg"

TARGET_SR = 24000
VIDEO_W = 1080
VIDEO_H = 1920
VIDEO_FPS = 30
LOOP_FRAMES = 150  # 5.0 seconds seamless 30fps loop for halo, sunbeams & twinkling stars


def load_scripture_decks() -> list[dict]:
    txt = SCRIPTURES_JS.read_text(encoding="utf-8")
    start = txt.index("return [") + len("return ")
    end = txt.rindex("];") + 1
    return json.loads(txt[start:end])


def read_wav_mono_24k(wav_path: Path) -> np.ndarray:
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)

    if sampwidth == 2:
        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 4:
        data = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width {sampwidth} in {wav_path}")

    if n_channels > 1:
        data = data.reshape(-1, n_channels).mean(axis=1)

    if sr != TARGET_SR and data.size > 0:
        duration = data.size / sr
        target_len = int(round(duration * TARGET_SR))
        x_old = np.linspace(0.0, 1.0, data.size, endpoint=False)
        x_new = np.linspace(0.0, 1.0, target_len, endpoint=False)
        data = np.interp(x_new, x_old, data).astype(np.float32)

    return data


def load_organ_bg_24k() -> np.ndarray:
    arr = read_wav_mono_24k(ORGAN_BG_WAV)
    peak = float(np.max(np.abs(arr))) if arr.size else 1.0
    if peak > 1e-4:
        arr = arr / peak
    return arr


def synthesize_cathedral_bell_intro(duration_sec: float = 1.35) -> np.ndarray:
    n = int(TARGET_SR * duration_sec)
    t = np.arange(n, dtype=np.float32) / TARGET_SR
    # Warm Cathedral Bell + Harp harmonics (C4=261.63, G4=392.0, C5=523.25, E5=659.25, G5=783.99, C6=1046.5)
    freqs = [261.63, 392.00, 523.25, 659.25, 783.99, 1046.50]
    amps = [0.26, 0.20, 0.32, 0.18, 0.14, 0.09]
    decays = [2.4, 2.8, 3.2, 3.8, 4.5, 5.5]
    offsets = [0.0, 0.04, 0.08, 0.14, 0.20, 0.26]

    sig = np.zeros(n, dtype=np.float32)
    for f, a, d, off in zip(freqs, amps, decays, offsets):
        mask = t >= off
        tm = t[mask] - off
        env = np.exp(-d * tm) * (1.0 - np.exp(-65.0 * tm))
        sig[mask] += a * env * np.sin(2.0 * np.pi * f * tm)

    peak = float(np.max(np.abs(sig)))
    if peak > 1e-4:
        sig = sig * (0.48 / peak)
    return sig


def build_mixed_audio(
    verses: list[dict],
    organ_bg: np.ndarray,
    bell_intro: np.ndarray,
    pause_sec: float = 0.72,
    organ_vol: float = 0.15,
    outro_sec: float = 1.35,
) -> tuple[np.ndarray, list[dict]]:
    segments: list[np.ndarray] = []
    timings: list[dict] = []

    cursor_samples = 0
    # 1. Cathedral bell intro
    segments.append(bell_intro)
    cursor_samples += bell_intro.size

    pause_samples = int(round(pause_sec * TARGET_SR))
    pause_arr = np.zeros(pause_samples, dtype=np.float32)

    for idx, v in enumerate(verses):
        rel_url = v["url"].lstrip("/")
        wav_path = ROOT_DIR / "data" / rel_url
        wav_arr = read_wav_mono_24k(wav_path)

        # Normalize voice cleanly to 0.92 peak
        v_peak = float(np.max(np.abs(wav_arr))) if wav_arr.size else 1.0
        if v_peak > 1e-4:
            wav_arr = wav_arr * (0.92 / v_peak)

        start_sec = cursor_samples / TARGET_SR
        segments.append(wav_arr)
        cursor_samples += wav_arr.size
        end_sec = cursor_samples / TARGET_SR

        if idx < len(verses) - 1:
            segments.append(pause_arr)
            cursor_samples += pause_samples
            end_sec_display = cursor_samples / TARGET_SR
        else:
            outro_arr = np.zeros(int(round(outro_sec * TARGET_SR)), dtype=np.float32)
            segments.append(outro_arr)
            cursor_samples += outro_arr.size
            end_sec_display = cursor_samples / TARGET_SR

        timings.append(
            {
                "index": idx + 1,
                "text": v["text"],
                "start": start_sec if idx > 0 else 0.0,
                "end": end_sec_display,
            }
        )

    voice_track = np.concatenate(segments)
    total_len = voice_track.size

    # Tile organ background seamlessly across total_len
    repeats = (total_len // organ_bg.size) + 2
    bg_tiled = np.tile(organ_bg, repeats)[:total_len].copy()

    # Smooth fade-in (0.8s) and fade-out (1.2s) on background music
    fade_in = min(int(TARGET_SR * 0.8), total_len // 4)
    fade_out = min(int(TARGET_SR * 1.2), total_len // 4)
    if fade_in > 1:
        bg_tiled[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)
    if fade_out > 1:
        bg_tiled[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)

    mixed = voice_track + bg_tiled * organ_vol
    max_val = float(np.max(np.abs(mixed)))
    if max_val > 0.96:
        mixed = mixed * (0.96 / max_val)

    return mixed, timings


def encode_mp3(audio_24k: np.ndarray, out_mp3: Path) -> None:
    pcm16 = np.clip(audio_24k * 32767.0, -32768, 32767).astype(np.int16).tobytes()
    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f",
        "s16le",
        "-ar",
        str(TARGET_SR),
        "-ac",
        "1",
        "-i",
        "-",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "192k",
        str(out_mp3),
    ]
    subprocess.run(cmd, input=pcm16, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def load_vn_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    win_fonts = Path(r"C:\Windows\Fonts")
    candidates = (
        ["arialbd.ttf", "segoeuib.ttf", "timesbd.ttf", "tahomabd.ttf"]
        if bold
        else ["arial.ttf", "segoeui.ttf", "times.ttf", "tahoma.ttf"]
    )
    for name in candidates:
        p = win_fonts / name
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def build_animated_halo_loop() -> list[np.ndarray]:
    """
    Pre-renders a 150-frame (5.0s @ 30fps) seamless loop of the zoomed Sanctuary & Jesus Christ
    with a breathing Golden Halo, rotating Divine Sunbeams, flickering Altar Candlelight,
    and 85 twinkling Golden Sparkle Stars.
    """
    orig = Image.open(BG_IMAGE_PATH).convert("RGB")
    # Crop upper-center sanctuary (840x1493 from 1080x1920) so Jesus Christ & Rose Window fill the center majestically
    # Shift top slightly so Header sits above Jesus's halo
    crop_box = (120, 0, 960, 1493)
    cropped = orig.crop(crop_box).resize((VIDEO_W, VIDEO_H), Image.Resampling.LANCZOS)
    base_rgb = np.asarray(cropped, dtype=np.float32)

    # Darken top header zone (y=0..220) and bottom subtitle zone (y=1300..1920) slightly for high contrast legibility
    y_coords = np.arange(VIDEO_H, dtype=np.float32)[:, None]
    x_coords = np.arange(VIDEO_W, dtype=np.float32)[None, :]

    top_vignette = np.clip((y_coords - 40.0) / 210.0, 0.52, 1.0)
    bot_vignette = np.clip(1.0 - np.maximum(0.0, y_coords - 1260.0) / 760.0 * 0.58, 0.42, 1.0)
    vignette = (top_vignette * bot_vignette)[:, :, None]
    base_rgb = base_rgb * vignette

    # Halo center behind Jesus Christ's head/shoulders in cropped coordinates:
    # Original (540, 265) -> with crop (120..960, 0..1493) scaled by 1.2857 -> (540, 341)
    # Sacred Heart center -> (540, 470)
    halo_cx, halo_cy = 540.0, 345.0
    heart_cx, heart_cy = 540.0, 475.0

    dx = x_coords - halo_cx
    dy = y_coords - halo_cy
    dist = np.sqrt(dx * dx + dy * dy)
    angle = np.arctan2(dy, dx)  # -pi .. pi

    # Radial mask for divine sunbeams (strong around r=110..480, soft fade inside Jesus's face r<95 and outside r>520)
    inner_fade = np.clip((dist - 75.0) / 75.0, 0.0, 1.0)
    outer_fade = np.exp(-((dist / 420.0) ** 2.2))
    ray_radial_mask = inner_fade * outer_fade

    # Soft golden aura around Halo & Sacred Heart
    aura_glow = np.exp(-((dist / 340.0) ** 2.0)) * 0.42
    heart_dist = np.sqrt((x_coords - heart_cx) ** 2 + (y_coords - heart_cy) ** 2)
    heart_glow = np.exp(-((heart_dist / 160.0) ** 2.0)) * 0.36

    # Warm flickering candlelight glow at Altar (y=1080..1280, x=240..840)
    candle_dist = np.sqrt(((x_coords - 540.0) / 290.0) ** 2 + ((y_coords - 1150.0) / 145.0) ** 2)
    candle_glow = np.exp(-(candle_dist ** 2)) * 0.28

    # Deterministic 85 Sparkling Golden Stars / Light Motes
    rng = np.random.default_rng(20261102)
    n_stars = 85
    star_x0 = rng.uniform(55, VIDEO_W - 55, size=n_stars)
    star_y0 = rng.uniform(160, 1340, size=n_stars)
    # Concentrate 45% of sparkles near the Golden Halo ring (r = 140..390)
    for i in range(int(n_stars * 0.45)):
        r_s = rng.uniform(135.0, 395.0)
        th_s = rng.uniform(-math.pi, math.pi)
        star_x0[i] = np.clip(halo_cx + r_s * math.cos(th_s), 55, VIDEO_W - 55)
        star_y0[i] = np.clip(halo_cy + r_s * math.sin(th_s), 140, 1280)

    star_phase = rng.uniform(0.0, 2.0 * math.pi, size=n_stars)
    star_freq = rng.choice([1, 2, 3], size=n_stars)
    star_size = rng.uniform(5.0, 11.5, size=n_stars)
    star_rise = rng.uniform(18.0, 48.0, size=n_stars)

    gold_color = np.array([255.0, 226.0, 132.0], dtype=np.float32)
    ivory_color = np.array([255.0, 248.0, 215.0], dtype=np.float32)

    frames: list[np.ndarray] = []
    for f in range(LOOP_FRAMES):
        phase = 2.0 * math.pi * (f / LOOP_FRAMES)
        pulse = 0.5 + 0.5 * math.sin(phase)
        pulse2 = 0.5 + 0.5 * math.sin(2.0 * phase + 0.7)

        # 12 rotating divine sunbeam rays (rotates by 2 full ray periods over LOOP_FRAMES -> 100% seamless)
        rot_angle = angle - phase / 6.0
        rays_12 = 0.5 + 0.5 * np.cos(12.0 * rot_angle)
        rays_24 = 0.5 + 0.5 * np.cos(24.0 * (angle + phase / 12.0))
        beam_intensity = ray_radial_mask * (0.28 * (rays_12 ** 2.2) + 0.16 * (rays_24 ** 3.0)) * (0.85 + 0.25 * pulse)

        # Breathing concentric golden halo rings (r1 ~ 215px, r2 ~ 295px, r3 ~ 370px)
        r1 = 212.0 + 8.0 * math.sin(phase)
        r2 = 292.0 - 6.0 * math.cos(phase)
        r3 = 368.0 + 7.0 * math.sin(phase + 1.2)
        ring1 = np.exp(-(((dist - r1) / 7.5) ** 2)) * (0.52 + 0.24 * pulse)
        ring2 = np.exp(-(((dist - r2) / 6.0) ** 2)) * (0.38 + 0.20 * pulse2)
        ring3 = np.exp(-(((dist - r3) / 8.0) ** 2)) * (0.25 + 0.15 * pulse)

        total_gold_add = (
            aura_glow * (0.88 + 0.24 * pulse)
            + heart_glow * (0.85 + 0.30 * pulse2)
            + candle_glow * (0.82 + 0.32 * math.sin(3.0 * phase))
            + beam_intensity
        )
        total_ivory_add = ring1 + ring2 + ring3

        frame_f = (
            base_rgb
            + total_gold_add[:, :, None] * gold_color[None, None, :]
            + total_ivory_add[:, :, None] * ivory_color[None, None, :]
        )

        # Draw twinkling 4-point golden star sparkles directly onto frame_f
        for s_idx in range(n_stars):
            twinkle = 0.5 + 0.5 * math.sin(star_freq[s_idx] * phase + star_phase[s_idx])
            if twinkle < 0.18:
                continue
            alpha_s = (twinkle ** 1.8) * 0.95
            sx = int(round(star_x0[s_idx] + 7.0 * math.sin(phase + star_phase[s_idx])))
            sy = int(round(star_y0[s_idx] - star_rise[s_idx] * math.sin(0.5 * phase)))
            rad = int(round(star_size[s_idx] * (0.65 + 0.55 * twinkle)))
            if rad < 2:
                continue

            y_min = max(0, sy - rad)
            y_max = min(VIDEO_H, sy + rad + 1)
            x_min = max(0, sx - rad)
            x_max = min(VIDEO_W, sx + rad + 1)
            if y_min >= y_max or x_min >= x_max:
                continue

            sub_y = np.arange(y_min, y_max, dtype=np.float32)[:, None] - sy
            sub_x = np.arange(x_min, x_max, dtype=np.float32)[None, :] - sx
            # 4-point diamond star + soft core
            core = np.exp(-((sub_x * sub_x + sub_y * sub_y) / (max(2.0, rad * 0.42) ** 2)))
            cross_h = np.exp(-((sub_y / 1.35) ** 2)) * np.exp(-((sub_x / (rad * 0.95)) ** 2))
            cross_v = np.exp(-((sub_x / 1.35) ** 2)) * np.exp(-((sub_y / (rad * 0.95)) ** 2))
            star_mask = np.clip((core + 0.85 * cross_h + 0.85 * cross_v) * alpha_s, 0.0, 1.0)[:, :, None]

            patch = frame_f[y_min:y_max, x_min:x_max]
            frame_f[y_min:y_max, x_min:x_max] = patch * (1.0 - star_mask * 0.65) + star_mask * 255.0

        frames.append(np.clip(frame_f, 0, 255).astype(np.uint8))

    return frames


def wrap_text_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        cand = f"{cur} {w}".strip()
        bbox = draw.textbbox((0, 0), cand, font=font)
        if bbox[2] - bbox[0] <= max_width or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def render_header_and_subtitle_slices(
    deck_title: str,
    short_title: str,
    verse_idx: int,
    total_verses: int,
    verse_text: str,
    fonts: dict,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Returns pre-rendered (header_rgb, header_alpha, bottom_rgb, bottom_alpha) slices:
    - Header slice: y = 45 .. 225 (height = 180)
    - Bottom subtitle + CTA slice: y = 1320 .. 1850 (height = 530)
    """
    # 1. HEADER SLICE (1080 x 180)
    h_img = Image.new("RGBA", (VIDEO_W, 180), (0, 0, 0, 0))
    h_draw = ImageDraw.Draw(h_img)

    # Top pill badge
    h_draw.rounded_rectangle(
        (70, 12, VIDEO_W - 70, 162),
        radius=28,
        fill=(10, 20, 46, 212),
        outline=(244, 196, 78, 225),
        width=3,
    )
    top_tag = "✝ THÁNH ĐƯỜNG HỒNG ÂN • LỜI CHÚA MỖI NGÀY ✝"
    tb = h_draw.textbbox((0, 0), top_tag, font=fonts["header_sub"])
    h_draw.text(
        ((VIDEO_W - (tb[2] - tb[0])) // 2, 26),
        top_tag,
        font=fonts["header_sub"],
        fill=(255, 226, 138, 255),
    )

    clean_title = deck_title.split("—")[0].strip().upper()
    if len(clean_title) > 42:
        clean_title = short_title.split("(")[0].strip().upper()
    tb2 = h_draw.textbbox((0, 0), clean_title, font=fonts["header_main"])
    h_draw.text(
        ((VIDEO_W - (tb2[2] - tb2[0])) // 2, 74),
        clean_title,
        font=fonts["header_main"],
        fill=(255, 252, 240, 255),
    )

    sub_line = deck_title.split("—")[1].strip() if "—" in deck_title else "Suy Niệm & Cầu Nguyện Bình An"
    tb3 = h_draw.textbbox((0, 0), sub_line, font=fonts["header_small"])
    h_draw.text(
        ((VIDEO_W - (tb3[2] - tb3[0])) // 2, 122),
        sub_line,
        font=fonts["header_small"],
        fill=(206, 228, 255, 255),
    )

    h_arr = np.asarray(h_img, dtype=np.float32)
    h_rgb = h_arr[:, :, :3]
    h_alpha = h_arr[:, :, 3:4] / 255.0

    # 2. BOTTOM SUBTITLE & CTA SLICE (1080 x 530, mapped to y = 1320 .. 1850)
    b_img = Image.new("RGBA", (VIDEO_W, 530), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(b_img)

    # Frosted dark-blue + gold border card for synchronized Scripture verse
    b_draw.rounded_rectangle(
        (56, 16, VIDEO_W - 56, 396),
        radius=34,
        fill=(8, 17, 40, 228),
        outline=(248, 206, 92, 240),
        width=3,
    )
    # Inner subtle golden frame line
    b_draw.rounded_rectangle(
        (68, 28, VIDEO_W - 68, 384),
        radius=26,
        fill=None,
        outline=(255, 232, 155, 85),
        width=1,
    )

    # Verse badge pill at top of card
    v_badge = f"📖 LỜI CHÚA & SUY NIỆM • CÂU {verse_idx}/{total_verses}"
    vb = b_draw.textbbox((0, 0), v_badge, font=fonts["badge"])
    vb_w = vb[2] - vb[0] + 44
    vb_x0 = (VIDEO_W - vb_w) // 2
    b_draw.rounded_rectangle(
        (vb_x0, 42, vb_x0 + vb_w, 88),
        radius=22,
        fill=(244, 196, 78, 42),
        outline=(244, 196, 78, 180),
        width=2,
    )
    b_draw.text(
        ((VIDEO_W - (vb[2] - vb[0])) // 2, 51),
        v_badge,
        font=fonts["badge"],
        fill=(255, 230, 142, 255),
    )

    # Wrap verse text cleanly inside width 890px
    quoted_text = f"“{verse_text.strip()}”"
    lines = wrap_text_lines(b_draw, quoted_text, fonts["verse"], max_width=885)
    font_to_use = fonts["verse"]
    line_h = 52
    if len(lines) > 5:
        lines = wrap_text_lines(b_draw, quoted_text, fonts["verse_sm"], max_width=900)
        font_to_use = fonts["verse_sm"]
        line_h = 44

    total_text_h = len(lines) * line_h
    start_y = 104 + max(0, (268 - total_text_h) // 2)

    for ln in lines:
        lb = b_draw.textbbox((0, 0), ln, font=font_to_use)
        lx = (VIDEO_W - (lb[2] - lb[0])) // 2
        # Soft drop shadow for readability
        b_draw.text((lx + 2, start_y + 2), ln, font=font_to_use, fill=(0, 0, 0, 220))
        b_draw.text((lx, start_y), ln, font=font_to_use, fill=(255, 250, 235, 255))
        start_y += line_h

    # Bottom Call-to-Action pill (y = 420 .. 492 inside slice -> Y = 1740 .. 1812 on screen)
    b_draw.rounded_rectangle(
        (78, 420, VIDEO_W - 78, 492),
        radius=36,
        fill=(18, 32, 68, 225),
        outline=(244, 196, 78, 200),
        width=2,
    )
    cta_text = "🕯️ Bình luận “Amen” nhận Phép Lành • Follow kênh nghe Lời Chúa mỗi ngày"
    cb = b_draw.textbbox((0, 0), cta_text, font=fonts["cta"])
    b_draw.text(
        ((VIDEO_W - (cb[2] - cb[0])) // 2, 441),
        cta_text,
        font=fonts["cta"],
        fill=(255, 232, 152, 255),
    )

    b_arr = np.asarray(b_img, dtype=np.float32)
    b_rgb = b_arr[:, :, :3]
    b_alpha = b_arr[:, :, 3:4] / 255.0

    return h_rgb, h_alpha, b_rgb, b_alpha


def render_tiktok_video(
    mp3_path: Path,
    out_mp4: Path,
    deck: dict,
    timings: list[dict],
    halo_loop: list[np.ndarray],
    fonts: dict,
    use_nvenc: bool = True,
) -> float:
    total_dur = timings[-1]["end"]
    total_frames = int(round(total_dur * VIDEO_FPS))

    # Pre-render and pre-blend the 6 verse slices once per video for 20x faster frame streaming
    base_top_slice = halo_loop[0][45:225].astype(np.float32)
    base_bot_slice = halo_loop[0][1320:1850].astype(np.float32)

    verse_overlays = []
    for t_info in timings:
        h_rgb, h_alpha, b_rgb, b_alpha = render_header_and_subtitle_slices(
            deck["title"],
            deck["shortTitle"],
            t_info["index"],
            len(timings),
            t_info["text"],
            fonts,
        )
        h_baked = np.clip(base_top_slice * (1.0 - h_alpha) + h_rgb * h_alpha, 0, 255).astype(np.uint8)
        b_baked = np.clip(base_bot_slice * (1.0 - b_alpha) + b_rgb * b_alpha, 0, 255).astype(np.uint8)
        verse_overlays.append((t_info["start"], t_info["end"], h_baked, b_baked))

    vcodec_args = (
        ["-c:v", "h264_nvenc", "-preset", "p2", "-cq", "21", "-b:v", "6M"]
        if use_nvenc
        else ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "20"]
    )

    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-s",
        f"{VIDEO_W}x{VIDEO_H}",
        "-pix_fmt",
        "rgb24",
        "-r",
        str(VIDEO_FPS),
        "-i",
        "-",
        "-i",
        str(mp3_path),
        *vcodec_args,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(out_mp4),
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    assert proc.stdin is not None

    cur_v_idx = 0
    n_verses = len(verse_overlays)

    for f in range(total_frames):
        t_sec = f / VIDEO_FPS
        while cur_v_idx < n_verses - 1 and t_sec >= verse_overlays[cur_v_idx][1]:
            cur_v_idx += 1

        _, _, h_baked, b_baked = verse_overlays[cur_v_idx]
        frame = halo_loop[f % LOOP_FRAMES].copy()
        frame[45:225] = h_baked
        frame[1320:1850] = b_baked
        proc.stdin.write(memoryview(frame))

    proc.stdin.close()
    stderr_bytes = proc.stderr.read() if proc.stderr else b""
    ret = proc.wait()
    if ret != 0:
        raise RuntimeError(f"FFmpeg failed ({ret}): {stderr_bytes.decode('utf-8', errors='replace')[-400:]}")

    return total_dur


def main() -> None:
    t0 = time.time()
    MP3_FULL_DIR.mkdir(parents=True, exist_ok=True)
    MP3_SHORTS_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_TIKTOK_DIR.mkdir(parents=True, exist_ok=True)

    decks = load_scripture_decks()
    print(f"[1/4] Loaded {len(decks)} Scripture decks. Decoding organ background & synthesizing bell intro...")
    organ_bg = load_organ_bg_24k()
    bell_intro = synthesize_cathedral_bell_intro(1.35)

    print("[2/4] Pre-rendering 150-frame (5.0s @ 30fps) Sparkling Golden Halo & Divine Rays loop...")
    halo_loop = build_animated_halo_loop()

    fonts = {
        "header_sub": load_vn_font(23, bold=True),
        "header_main": load_vn_font(33, bold=True),
        "header_small": load_vn_font(22, bold=False),
        "badge": load_vn_font(24, bold=True),
        "verse": load_vn_font(36, bold=True),
        "verse_sm": load_vn_font(31, bold=True),
        "cta": load_vn_font(24, bold=True),
    }

    manifest = []

    for idx, deck in enumerate(decks, 1):
        slug = f"{idx:02d}_{deck['id']}"
        verses = deck["verses"]

        # 1. Full MP3 (all 33 verses)
        full_mp3_path = MP3_FULL_DIR / f"{slug}_full.mp3"
        full_audio, _ = build_mixed_audio(
            verses,
            organ_bg=organ_bg,
            bell_intro=bell_intro,
            pause_sec=0.75,
            organ_vol=0.14,
            outro_sec=1.6,
        )
        encode_mp3(full_audio, full_mp3_path)
        full_dur = round(full_audio.size / TARGET_SR, 1)

        # 2. Short TikTok MP3 (first 6 core verses)
        short_mp3_path = MP3_SHORTS_DIR / f"{slug}_short.mp3"
        short_verses = verses[:6]
        short_audio, short_timings = build_mixed_audio(
            short_verses,
            organ_bg=organ_bg,
            bell_intro=bell_intro,
            pause_sec=0.65,
            organ_vol=0.16,
            outro_sec=1.3,
        )
        encode_mp3(short_audio, short_mp3_path)
        short_dur = round(short_audio.size / TARGET_SR, 1)

        # 3. Render 9:16 TikTok MP4 Video with Sparkling Golden Halo
        video_path = VIDEOS_TIKTOK_DIR / f"{slug}_tiktok.mp4"
        try:
            render_tiktok_video(
                short_mp3_path,
                video_path,
                deck,
                short_timings,
                halo_loop,
                fonts,
                use_nvenc=True,
            )
        except Exception:
            render_tiktok_video(
                short_mp3_path,
                video_path,
                deck,
                short_timings,
                halo_loop,
                fonts,
                use_nvenc=False,
            )

        item_info = {
            "index": idx,
            "id": deck["id"],
            "title": deck["title"],
            "mp3_full": str(full_mp3_path.relative_to(ROOT_DIR)),
            "mp3_full_duration_sec": full_dur,
            "mp3_full_size_mb": round(full_mp3_path.stat().st_size / (1024 * 1024), 2),
            "mp3_short": str(short_mp3_path.relative_to(ROOT_DIR)),
            "mp3_short_duration_sec": short_dur,
            "mp3_short_size_mb": round(short_mp3_path.stat().st_size / (1024 * 1024), 2),
            "video_tiktok": str(video_path.relative_to(ROOT_DIR)),
            "video_duration_sec": short_dur,
            "video_size_mb": round(video_path.stat().st_size / (1024 * 1024), 2),
        }
        manifest.append(item_info)
        print(
            f"  ✅ [{idx:02d}/10] {slug} | Full MP3: {full_dur}s ({item_info['mp3_full_size_mb']}MB) | "
            f"Short MP3: {short_dur}s | TikTok MP4: {item_info['video_size_mb']}MB"
        )

    manifest_path = EXPORT_ROOT / "export_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    elapsed = round(time.time() - t0, 1)
    print(f"\n🎉 DONE! Exported 10 Full MP3s, 10 Short MP3s & 10 TikTok 9:16 Videos in {elapsed}s.")


if __name__ == "__main__":
    main()
