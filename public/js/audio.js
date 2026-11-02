/**
 * TempleAudioEngine
 * - Nhạc nền Thiền Tự: Phát trực tiếp "/assets/bg_chant.wav" (Chuông Xoay Tây Tạng + Đàn Tranh + Niệm Phật A Di Đà)
 *   lặp vô tận êm dịu, tự động hạ nhỏ âm lượng (ducking) khi có giọng đọc lời khấn hoặc giảng kinh.
 * - Kênh Giảng Kinh & Pháp Thoại Cổ Điển (Dharma Sutra Engine):
 *   Đọc tuần tự các bộ Kinh Pháp Cú, Kinh A Di Đà, Bát Nhã Tâm Kinh, Kinh Báo Hiếu, Pháp Thoại Chánh Niệm
 *   bằng giọng AI ZeroTTS trầm ấm (mặc định: Hữu Đức) kết hợp nhịp Mõ Gỗ & Đại Hồng Chung định kỳ.
 * - Cơ chế Ưu Tiên Lời Khấn Thí Chủ (Smart Ritual Interrupt & Resume):
 *   Tự động tạm dừng câu kinh đang giảng khi có người xem Thắp hương / Xin xăm / Tặng quà,
 *   xướng tên và lời cầu nguyện của thí chủ xong sẽ tự động giảng tiếp câu kinh đang dở.
 */
class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';

    // Lưu & khôi phục cấu hình âm lượng từ localStorage (Ưu tiên Giọng Kinh 95%, Nhạc nền 45%, nhỏ tiếng Mai Chi 35%)
    const savedMusicVol = parseFloat(localStorage.getItem('temple_music_vol'));
    const savedTtsVol = parseFloat(localStorage.getItem('temple_tts_vol'));
    const savedSutraVol = parseFloat(localStorage.getItem('temple_sutra_vol'));
    const savedSutraVoice = localStorage.getItem('temple_sutra_voice');
    const savedSutraId = localStorage.getItem('temple_sutra_id');

    this.bgBaseVolume = Number.isFinite(savedMusicVol) && savedMusicVol > 0.02 ? Math.max(0.05, Math.min(1, savedMusicVol)) : 0.36;
    this.ttsVolume = Number.isFinite(savedTtsVol) && savedTtsVol > 0.02 ? Math.max(0.05, Math.min(1, savedTtsVol)) : 0.30;
    this.sutraVolume = Number.isFinite(savedSutraVol) && savedSutraVol > 0.05 ? Math.max(0.1, Math.min(1, savedSutraVol)) : 1.0;

    // Nhạc nền Thiền Tự & Chuông Xoay (/assets/bg_chant.wav?v=11)
    this.useSynthMusicFallback = false;
    this.synthBgTimer = null;
    this.bgAudio = new Audio('/assets/bg_chant.wav?v=11');
    this.bgAudio.loop = true;
    this.bgAudio.preload = 'auto';
    this.bgAudio.volume = this.bgBaseVolume;
    this.bgAudio.onerror = () => {
      this.useSynthMusicFallback = true;
    };

    // Quản lý tập trung các phần tử Audio để TUYỆT ĐỐI không bao giờ phát 2 giọng chồng lên nhau
    this.activeSutraAudios = new Set();
    this.activeTtsAudios = new Set();
    this.sutraRunId = 0;

    // Hàng đợi Lời khấn / Xin xăm / Cúng dường của Thí Chủ (Chờ hết ít nhất 2 câu kinh & cooldown 18s mới đọc nhẹ nhàng 30%)
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.onTtsStateChange = null;
    this.lastTtsPlayedAt = 0;
    this.minTtsCooldownMs = 18000;
    this.versesSinceLastTts = 2;

    // Động cơ Giảng Kinh Phật & Pháp Thoại Cổ Điển (ƯU TIÊN SỐ 1 — ĐỌC XUYÊN SUỐT, KHÔNG NGẮT GIỮA CÂU)
    this.sutras = Array.isArray(window.TEMPLE_SUTRAS) ? window.TEMPLE_SUTRAS : [];
    this.sutraEnabled = true;
    this.sutraChimeEnabled = true;
    this.sutraVoice = savedSutraVoice || 'huuduc';
    this.sutraIndex = 0;
    if (savedSutraId && this.sutras.length > 0) {
      const idx = this.sutras.findIndex((s) => s.id === savedSutraId);
      if (idx >= 0) this.sutraIndex = idx;
    }
    this.verseIndex = 0;
    this.sutraPlaying = false;
    this.sutraPausedByRitual = false;
    this.currentSutraAudio = null;
    this.sutraResumeTime = 0;
    this.sutraNextTimer = null;
    this.lastSutraStartAt = 0;
    this.sutraUrlCache = new Map();
    this.sutraInflightMap = new Map();
    this.onSutraStateChange = null;
    this.onSutraVisualBeat = null;

    // Watchdog tự phục hồi: đảm bảo Giọng giảng Kinh Phật không bao giờ bị tắt hay kẹt giữa chừng
    this.watchdogTimer = setInterval(() => {
      if (!this.unlocked || !this.sutraEnabled) return;
      const now = Date.now();
      if (this.sutraPlaying && this.lastSutraStartAt > 0 && now - this.lastSutraStartAt > 48000) {
        this.stopAllSutraAudios();
        this.sutraPlaying = false;
        this.advanceSutraCursor();
        this.scheduleNextSutraVerse(350);
        return;
      }
      if (!this.sutraPlaying && !this.sutraNextTimer) {
        this.scheduleNextSutraVerse(400);
      }
    }, 3000);
  }

  stopAllSutraAudios() {
    this.sutraRunId += 1;
    if (this.sutraNextTimer) {
      clearTimeout(this.sutraNextTimer);
      this.sutraNextTimer = null;
    }
    for (const a of this.activeSutraAudios) {
      try {
        const doneFn = a._doneFn;
        a.onended = null;
        a.onerror = null;
        a.pause();
        if (typeof doneFn === 'function') doneFn(false);
      } catch (_) {}
    }
    this.activeSutraAudios.clear();
    this.currentSutraAudio = null;
  }

  stopAllTtsAudios() {
    for (const a of this.activeTtsAudios) {
      try {
        a.onended = null;
        a.onerror = null;
        a.pause();
      } catch (_) {}
    }
    this.activeTtsAudios.clear();
    this.currentAudio = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
    if (this.bgMusicEnabled) {
      this.startZenAmbience();
    }
    if (this.sutraEnabled && !this.ttsPlaying && !this.sutraPlaying && !this.sutraNextTimer) {
      this.scheduleNextSutraVerse(400);
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC NỀN THIỀN TỰ & AUTO-DUCKING KHI ĐỌC LỜI KHẤN / GIẢNG KINH
  // --------------------------------------------------------------------------
  isVoiceActive() {
    return Boolean(this.ttsPlaying || this.sutraPlaying);
  }

  getDuckedVolume() {
    return Math.max(0.08, +(this.bgBaseVolume * 0.82).toFixed(2));
  }

  refreshBgVolume() {
    if (!this.bgMusicEnabled) return;
    try {
      if (!this.useSynthMusicFallback && this.bgAudio) {
        this.bgAudio.volume = this.isVoiceActive() ? this.getDuckedVolume() : this.bgBaseVolume;
      }
    } catch (_) {}
  }

  setMusicVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.bgBaseVolume = v;
    try {
      localStorage.setItem('temple_music_vol', String(v));
    } catch (_) {}
    if (v > 0.01) {
      this.bgMusicEnabled = true;
      this.refreshBgVolume();
      if (this.unlocked) {
        this.startZenAmbience();
      }
    } else {
      this.refreshBgVolume();
    }
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('temple_tts_vol', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.ttsVolume;
    }
  }

  setSutraVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.sutraVolume = v;
    try {
      localStorage.setItem('temple_sutra_vol', String(v));
    } catch (_) {}
    if (this.currentSutraAudio) {
      this.currentSutraAudio.volume = this.sutraVolume;
    }
  }

  startZenAmbience() {
    if (!this.bgMusicEnabled) return;
    if (this.useSynthMusicFallback) {
      this.startDefaultZenSynthLoop();
      return;
    }
    try {
      this.refreshBgVolume();
      if (this.bgAudio.paused) {
        const p = this.bgAudio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (this.bgAudio.error) {
              this.useSynthMusicFallback = true;
              this.startDefaultZenSynthLoop();
            }
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
      this.startDefaultZenSynthLoop();
    }
  }

  startDefaultZenSynthLoop() {
    if (!this.bgMusicEnabled || this.synthBgTimer) return;
    const PENTATONIC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0];
    let step = 0;
    const playZenNote = () => {
      if (!this.bgMusicEnabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const freq = PENTATONIC[step % PENTATONIC.length];
        step++;
        const vol = (this.isVoiceActive() ? this.getDuckedVolume() : this.bgBaseVolume) * 0.2;
        if (vol <= 0.002) return;

        const osc = this.ctx.createOscillator();
        const sub = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        sub.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        sub.frequency.setValueAtTime(freq * 0.5, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

        osc.connect(gain);
        sub.connect(gain);
        gain.connect(this.ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          sub.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        sub.start(now);
        osc.stop(now + 4.05);
        sub.stop(now + 4.05);
      } catch (_) {}
    };
    playZenNote();
    this.synthBgTimer = setInterval(playZenNote, 3400);
  }

  stopZenAmbience() {
    try {
      this.bgAudio.pause();
    } catch (_) {}
    if (this.synthBgTimer) {
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
  }

  setBgDucking(_ducked) {
    this.refreshBgVolume();
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG MÕ GỖ TỤNG KINH (WOODEN FISH PERCUSSION SYNTH)
  // --------------------------------------------------------------------------
  getSfxDuckFactor() {
    return this.sutraPlaying ? 0.22 : 0.65;
  }

  playWoodenFish(pitchMultiplier = 1.0, volumeScale = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 610 * pitchMultiplier * (0.985 + Math.random() * 0.03);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.018);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, now + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq * 1.15, now);
      filter.Q.setValueAtTime(4.2, now);

      const peakGain = Math.min(0.28, 0.22 * volumeScale * this.getSfxDuckFactor());
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.onended = () => {
        osc1.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc1.start(now);
      osc1.stop(now + 0.16);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG ĐẠI HỒNG CHUNG (TEMPLE BRONZE BELL)
  // --------------------------------------------------------------------------
  playTempleBell(intensity = 1.0) {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const base = 174;
      const partials = [
        { ratio: 0.5, amp: 0.22, decay: 4.2 },
        { ratio: 1.0, amp: 0.35, decay: 3.6 },
        { ratio: 1.506, amp: 0.16, decay: 2.4 },
        { ratio: 2.0, amp: 0.18, decay: 1.9 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.24 * Math.min(1.0, intensity) * this.getSfxDuckFactor(), now);
      master.connect(ctx.destination);

      partials.forEach((p, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * p.ratio, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(p.amp, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(g);
        g.connect(master);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
          if (idx === 0) master.disconnect();
        };
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG LẮC ỐNG XĂM TRE (FORTUNE STICK SHAKER)
  // --------------------------------------------------------------------------
  playFortuneShake() {
    if (!this.sfxEnabled) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playWoodenFish(1.32 + (i % 2) * 0.16);
      }, i * 120);
    }
  }

  // --------------------------------------------------------------------------
  // 5. TIẾNG CHUÔNG NGỌC DÂNG LỄ / THẮP HƯƠNG (SINGING CHIME)
  // --------------------------------------------------------------------------
  playIncenseChime() {
    if (!this.sfxEnabled) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const notes = [528, 660];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.085 * this.getSfxDuckFactor(), now + idx * 0.1 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.15);
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. ZEROTTS VOICE QUEUE CHO LỜI KHẤN THÍ CHỦ (NHỎ NHẸ 35%, CHỜ HẾT CÂU KINH MỚI ĐỌC)
  // --------------------------------------------------------------------------
  enqueueTts(text, options = {}) {
    const onStart = typeof options.onStart === 'function' ? options.onStart : null;
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;

    if (!this.ttsEnabled || this.ttsVolume <= 0.01) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 4500);
      return;
    }
    const clean = String(text || '').trim();
    if (!clean) {
      if (onStart) onStart();
      if (onEnd) setTimeout(onEnd, 4500);
      return;
    }

    // ƯU TIÊN GIỌNG KINH: Chỉ giữ tối đa 1 lời khấn mới nhất trong hàng đợi để không làm gián đoạn việc giảng kinh
    while (this.ttsQueue.length >= 1) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || null,
      onStart,
      onEnd
    };

    // KHÔNG gọi fetchZeroTtsAudio ngay tại đây (Lazy Synthesis) để tránh nghẽn tts_worker.py khi khán giả vào đông
    this.ttsQueue.push(item);

    // Chạy kênh Mai Chi độc lập (âm lượng nhỏ 28%) dưới nền để xướng tên tương tác mà KHÔNG BAO GIỜ ngắt Giọng Giảng Kinh!
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text, voice = 'maichi', priority = 'high') {
    const cacheKey = `${voice}::${text}`;
    if (this.sutraUrlCache.has(cacheKey)) {
      return { ok: true, url: this.sutraUrlCache.get(cacheKey), voice };
    }
    if (this.sutraInflightMap.has(cacheKey)) {
      return this.sutraInflightMap.get(cacheKey);
    }

    const promise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, priority }),
          signal: controller.signal
        });
        const data = await res.json();
        if (data && data.ok && data.url) {
          this.sutraUrlCache.set(cacheKey, data.url);
          return data;
        }
        return { ok: false, error: data?.error || 'ZeroTTS unavailable' };
      } catch (err) {
        return { ok: false, error: err.message };
      } finally {
        clearTimeout(timeoutId);
        this.sutraInflightMap.delete(cacheKey);
      }
    })();

    this.sutraInflightMap.set(cacheKey, promise);
    return promise;
  }

  async processTtsQueue() {
    if (this.ttsPlaying || this.ttsQueue.length === 0) return;

    this.ttsPlaying = true;
    const item = this.ttsQueue.shift();

    try {
      let audioUrl = item.url;
      if (!audioUrl && item.text) {
        const res = await this.fetchZeroTtsAudio(item.text, item.voice, 'high');
        if (res && res.ok && res.url) {
          audioUrl = res.url;
        }
      }

      if (audioUrl && this.ttsVolume > 0.01) {
        this.refreshBgVolume();
        if (this.currentSutraAudio) {
          this.currentSutraAudio.volume = Math.max(0.15, this.sutraVolume * 0.34);
        }
        if (this.onTtsStateChange) {
          this.onTtsStateChange({ speaking: true, synthesizing: false, text: item.text });
        }
        if (item.onStart) item.onStart();
        this.lastTtsPlayedAt = Date.now();
        this.versesSinceLastTts = 0;
        await this.playWavUrl(audioUrl);
        if (item.onEnd) item.onEnd();
      } else {
        if (item.onStart) item.onStart();
        if (item.onEnd) setTimeout(item.onEnd, 4500);
      }
    } catch (err) {
      console.warn('[ZeroTTS Playback Warning]', err);
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      this.ttsPlaying = false;
      if (this.currentSutraAudio) {
        this.currentSutraAudio.volume = this.sutraVolume;
      }
      this.refreshBgVolume();
      if (this.onTtsStateChange) {
        this.onTtsStateChange({ speaking: false, synthesizing: false, text: '' });
      }
      if (this.ttsQueue.length > 0) {
        setTimeout(() => this.processTtsQueue(), 500);
      }
    }
  }

  playWavUrl(url) {
    return new Promise((resolve) => {
      let settled = false;
      let audioRef = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(guardTimer);
        if (audioRef) {
          this.activeTtsAudios.delete(audioRef);
          if (this.currentAudio === audioRef) this.currentAudio = null;
        }
        resolve();
      };
      const guardTimer = setTimeout(finish, 45000);
      try {
        this.stopAllTtsAudios();
        const audio = new Audio(url);
        audioRef = audio;
        this.currentAudio = audio;
        this.activeTtsAudios.add(audio);
        audio.volume = Math.max(0.1, Math.min(1.0, this.ttsVolume || 0.88));
        audio.onended = finish;
        audio.onerror = finish;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(finish);
        }
      } catch (_) {
        finish();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. ĐỘNG CƠ GIẢNG KINH PHẬT & PHÁP THOẠI CỔ ĐIỂN (ƯU TIÊN SỐ 2, TỰ ĐỘNG NỐI TIẾP)
  // --------------------------------------------------------------------------
  getCurrentSutra() {
    if (!this.sutras || this.sutras.length === 0) return null;
    const idx = ((this.sutraIndex % this.sutras.length) + this.sutras.length) % this.sutras.length;
    return this.sutras[idx];
  }

  getCurrentVerseObj() {
    const sutra = this.getCurrentSutra();
    if (!sutra || !Array.isArray(sutra.verses) || sutra.verses.length === 0) return null;
    const vIdx = ((this.verseIndex % sutra.verses.length) + sutra.verses.length) % sutra.verses.length;
    return {
      sutra,
      sutraIndex: this.sutraIndex,
      verseIndex: vIdx,
      totalVerses: sutra.verses.length,
      verse: sutra.verses[vIdx]
    };
  }

  getSutraStatus() {
    const cur = this.getCurrentVerseObj();
    return {
      enabled: this.sutraEnabled,
      playing: this.sutraPlaying,
      pausedByRitual: this.sutraPausedByRitual,
      voice: this.sutraVoice,
      volume: this.sutraVolume,
      chimeEnabled: this.sutraChimeEnabled,
      sutraId: cur?.sutra?.id || '',
      sutraTitle: cur?.sutra?.title || '',
      sutraShortTitle: cur?.sutra?.shortTitle || '',
      sutraCategory: cur?.sutra?.category || '',
      verseIndex: cur ? cur.verseIndex : 0,
      totalVerses: cur ? cur.totalVerses : 0,
      verseText: cur?.verse?.text || ''
    };
  }

  emitSutraState() {
    if (typeof this.onSutraStateChange === 'function') {
      this.onSutraStateChange(this.getSutraStatus());
    }
  }

  prefetchVerseAudio(sIdx, vIdx) {
    if (!this.sutras || this.sutras.length === 0) return;
    const sutra = this.sutras[((sIdx % this.sutras.length) + this.sutras.length) % this.sutras.length];
    if (!sutra || !sutra.verses?.length) return;
    const verse = sutra.verses[((vIdx % sutra.verses.length) + sutra.verses.length) % sutra.verses.length];
    if (verse && verse.text) {
      if (this.sutraVoice === 'huuduc' && verse.url) return;
      this.fetchZeroTtsAudio(verse.text, this.sutraVoice);
    }
  }

  pauseSutraForRitual() {
    this.stopAllSutraAudios();
    if (this.sutraPlaying || this.sutraEnabled) {
      this.sutraPlaying = false;
      this.sutraPausedByRitual = true;
      this.refreshBgVolume();
      this.emitSutraState();
    }
  }

  resumeSutraAfterRitual() {
    if (!this.sutraEnabled) {
      this.sutraPausedByRitual = false;
      this.emitSutraState();
      return;
    }
    if (this.ttsPlaying) return;
    this.sutraPausedByRitual = false;
    this.scheduleNextSutraVerse(750);
  }

  scheduleNextSutraVerse(delayMs = 900) {
    if (this.sutraNextTimer) {
      clearTimeout(this.sutraNextTimer);
      this.sutraNextTimer = null;
    }
    if (!this.sutraEnabled) {
      this.emitSutraState();
      return;
    }
    this.sutraNextTimer = setTimeout(() => {
      this.sutraNextTimer = null;
      this.playCurrentSutraVerse();
    }, delayMs);
  }

  advanceSutraCursor() {
    const cur = this.getCurrentSutra();
    if (!cur) return;
    this.sutraResumeTime = 0;
    if (this.verseIndex + 1 < cur.verses.length) {
      this.verseIndex += 1;
    } else {
      // Hết 1 bộ kinh -> tự động chuyển sang bộ kinh tiếp theo
      this.verseIndex = 0;
      this.sutraIndex = (this.sutraIndex + 1) % this.sutras.length;
      const nextSutra = this.getCurrentSutra();
      if (nextSutra) {
        try {
          localStorage.setItem('temple_sutra_id', nextSutra.id);
        } catch (_) {}
      }
    }
  }

  playSutraRitualPreamble(verse) {
    if (!this.sutraChimeEnabled || !this.sfxEnabled || !verse || this.sutraVolume <= 0.01) return 0;
    if (verse.sfx === 'bell') {
      this.playTempleBell(0.72);
      if (typeof this.onSutraVisualBeat === 'function') {
        this.onSutraVisualBeat('bell');
      }
      return 950;
    }
    if (verse.sfx === 'chime') {
      this.playIncenseChime();
      if (typeof this.onSutraVisualBeat === 'function') {
        this.onSutraVisualBeat('chime');
      }
      return 550;
    }
    // Mặc định gõ 2 nhịp mõ gỗ trầm ấm trước câu kinh
    const beats = Math.max(1, Math.min(3, Number(verse.woodfishBeats) || 2));
    const expectedRunId = this.sutraRunId;
    for (let i = 0; i < beats; i++) {
      setTimeout(() => {
        if (this.sutraRunId === expectedRunId && !this.ttsPlaying && this.sutraEnabled && this.sutraVolume > 0.01) {
          this.playWoodenFish(0.86 + (i % 2) * 0.04, 0.72);
        }
      }, i * 360);
    }
    if (typeof this.onSutraVisualBeat === 'function') {
      this.onSutraVisualBeat('woodfish');
    }
    return beats * 360 + 220;
  }

  async playCurrentSutraVerse() {
    if (!this.sutraEnabled || !this.unlocked) {
      this.emitSutraState();
      return;
    }

    // Dừng mọi thẻ audio kinh cũ (nếu có) trước khi bắt đầu câu mới để không bao giờ chồng 2 tiếng kinh
    this.stopAllSutraAudios();
    const myRunId = this.sutraRunId;

    const cur = this.getCurrentVerseObj();
    if (!cur || !cur.verse?.text) return;

    this.sutraPlaying = true;
    this.sutraPausedByRitual = false;
    this.lastSutraStartAt = Date.now();
    this.refreshBgVolume();
    this.emitSutraState();

    // Prefetch trước câu kinh tiếp theo để không có độ trễ
    const nextV = cur.verseIndex + 1 < cur.totalVerses ? cur.verseIndex + 1 : 0;
    const nextS = cur.verseIndex + 1 < cur.totalVerses ? cur.sutraIndex : (cur.sutraIndex + 1) % this.sutras.length;
    this.prefetchVerseAudio(nextS, nextV);

    // Fetch câu kinh hiện tại (Nếu đang dùng giọng mặc định huuduc và đã có sẵn url tĩnh thì phát tức thì 0ms!)
    const res =
      this.sutraVoice === 'huuduc' && cur.verse.url
        ? { ok: true, url: cur.verse.url, voice: 'huuduc', cached: true }
        : await this.fetchZeroTtsAudio(cur.verse.text, this.sutraVoice, 'high');
    if (myRunId !== this.sutraRunId || !this.sutraEnabled) {
      this.sutraPlaying = false;
      this.refreshBgVolume();
      this.emitSutraState();
      return;
    }

    if (!res || !res.ok || !res.url) {
      this.sutraPlaying = false;
      this.refreshBgVolume();
      this.advanceSutraCursor();
      this.scheduleNextSutraVerse(1800);
      return;
    }

    let preambleMs = 0;
    if (this.sutraResumeTime <= 0.1) {
      preambleMs = this.playSutraRitualPreamble(cur.verse);
    }

    if (preambleMs > 0) {
      await new Promise((r) => setTimeout(r, preambleMs));
    }

    if (myRunId !== this.sutraRunId || !this.sutraEnabled) {
      this.sutraPlaying = false;
      this.refreshBgVolume();
      this.emitSutraState();
      return;
    }

    await new Promise((resolve) => {
      let settled = false;
      let audioRef = null;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(sutraGuardTimer);
        if (audioRef) {
          this.activeSutraAudios.delete(audioRef);
          if (this.currentSutraAudio === audioRef) this.currentSutraAudio = null;
        }
        if (myRunId === this.sutraRunId && ok) {
          this.sutraResumeTime = 0;
          this.advanceSutraCursor();
        }
        resolve(ok);
      };
      const sutraGuardTimer = setTimeout(() => {
        if (myRunId === this.sutraRunId) {
          this.advanceSutraCursor();
        }
        done(false);
      }, 38000);
      try {
        const audio = new Audio(res.url);
        audioRef = audio;
        audio._doneFn = done;
        this.currentSutraAudio = audio;
        this.activeSutraAudios.add(audio);
        audio.volume = this.sutraVolume;

        audio.onended = () => done(true);
        audio.onerror = () => {
          if (myRunId === this.sutraRunId) {
            this.advanceSutraCursor();
          }
          done(false);
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => done(false));
        }
      } catch (_) {
        done(false);
      }
    });

    if (myRunId !== this.sutraRunId) return;

    this.sutraPlaying = false;
    this.versesSinceLastTts += 1;
    this.refreshBgVolume();
    this.emitSutraState();

    if (this.sutraEnabled) {
      // Khoảng nghỉ tĩnh tâm 1.1s giữa 2 câu kinh
      this.scheduleNextSutraVerse(1100);
    }
  }

  // Các hàm điều khiển Trình Giảng Kinh từ UI & RPC
  setSutraEnabled(enabled) {
    this.sutraEnabled = Boolean(enabled);
    if (!this.sutraEnabled) {
      this.stopAllSutraAudios();
      this.sutraPlaying = false;
      this.sutraPausedByRitual = false;
      this.refreshBgVolume();
      this.emitSutraState();
    } else {
      this.ensureContext();
      this.scheduleNextSutraVerse(250);
    }
  }

  setSutraVoice(voice) {
    const v = String(voice || 'huuduc').trim().toLowerCase();
    if (!v) return;
    this.sutraVoice = v;
    try {
      localStorage.setItem('temple_sutra_voice', v);
    } catch (_) {}
    if (this.sutraEnabled) {
      this.sutraResumeTime = 0;
      this.stopAllSutraAudios();
      this.sutraPlaying = false;
      this.scheduleNextSutraVerse(200);
    } else {
      this.emitSutraState();
    }
  }

  selectSutraById(sutraId, verseIndex = 0) {
    if (!this.sutras || this.sutras.length === 0) return;
    const idx = this.sutras.findIndex((s) => s.id === sutraId);
    if (idx < 0) return;
    this.sutraIndex = idx;
    const targetSutra = this.sutras[idx];
    this.verseIndex = Math.max(0, Math.min((targetSutra.verses?.length || 1) - 1, Number(verseIndex) || 0));
    this.sutraResumeTime = 0;
    try {
      localStorage.setItem('temple_sutra_id', targetSutra.id);
    } catch (_) {}

    this.stopAllSutraAudios();
    this.sutraPlaying = false;
    this.emitSutraState();
    if (this.sutraEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextSutraVerse(200);
    }
  }

  nextSutraVerse() {
    this.sutraResumeTime = 0;
    this.advanceSutraCursor();
    this.stopAllSutraAudios();
    this.sutraPlaying = false;
    this.emitSutraState();
    if (this.sutraEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextSutraVerse(150);
    }
  }

  prevSutraVerse() {
    const cur = this.getCurrentSutra();
    if (!cur) return;
    this.sutraResumeTime = 0;
    if (this.verseIndex > 0) {
      this.verseIndex -= 1;
    } else {
      this.sutraIndex = (this.sutraIndex - 1 + this.sutras.length) % this.sutras.length;
      const prevSutra = this.getCurrentSutra();
      this.verseIndex = Math.max(0, (prevSutra?.verses?.length || 1) - 1);
    }
    this.stopAllSutraAudios();
    this.sutraPlaying = false;
    this.emitSutraState();
    if (this.sutraEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextSutraVerse(150);
    }
  }
}

window.TempleAudioEngine = TempleAudioEngine;
