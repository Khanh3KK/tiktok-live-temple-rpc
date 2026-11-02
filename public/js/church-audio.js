/**
 * ChurchAudioEngine — Hệ thống Âm thanh Phụng Vụ & Thánh Ca Nhà Thờ Online
 * - Nhạc nền Thánh Đường: Phát trực tiếp "/assets/bg_church_hymn.wav" (Đàn Đại Phong Cầm Pipe Organ +
 *   Đàn Harp Thiên Thần + Chuông Thánh Đường + Giai điệu Thánh Ca êm dịu) lặp vô tận, tự động hạ nhỏ
 *   âm lượng (ducking) khi có giọng đọc lời cầu nguyện hoặc đọc Lời Chúa.
 * - Kênh Đọc Lời Chúa, Thánh Vịnh & Suy Niệm Tin Mừng (Scripture & Homily Engine):
 *   Đọc tuần tự Kinh Hòa Bình, Thánh Vịnh 23, Tám Mối Phúc Thật, Bài Ca Đức Ái, Kinh Cầu Bình An Gia Đình
 *   bằng giọng AI ZeroTTS trầm ấm kết hợp Chuông Thánh Đường & Đàn Harp định kỳ.
 * - Cơ chế Ưu Tiên Lời Nguyện Tín Hữu (Smart Ritual Interrupt & Resume):
 *   Tự động tạm dừng câu Kinh Thánh đang đọc khi có người xem Thắp nến / Hái Lộc Thánh / Dâng lễ vật,
 *   đọc xong lời cầu nguyện của tín hữu sẽ tự động đọc tiếp câu Lời Chúa đang dở.
 */
class ChurchAudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sfxEnabled = true;
    this.bgMusicEnabled = true;
    this.ttsEnabled = true;
    this.ttsVoice = 'maichi';

    const savedMusicVol = parseFloat(localStorage.getItem('church_music_vol_v2'));
    const savedTtsVol = parseFloat(localStorage.getItem('church_tts_vol_v2'));
    const savedScriptureVol = parseFloat(localStorage.getItem('church_scripture_vol_v2'));
    const savedScriptureVoice = localStorage.getItem('church_scripture_voice');
    const savedScriptureId = localStorage.getItem('church_scripture_id');

    this.bgBaseVolume = Number.isFinite(savedMusicVol) ? Math.max(0, Math.min(1, savedMusicVol)) : 0.36;
    this.ttsVolume = Number.isFinite(savedTtsVol) ? Math.max(0, Math.min(1, savedTtsVol)) : 0.30;
    this.scriptureVolume = Number.isFinite(savedScriptureVol) ? Math.max(0, Math.min(1, savedScriptureVol)) : 1.0;

    // Nhạc nền Thánh Đường (/assets/bg_church_hymn.wav?v=2)
    this.useSynthMusicFallback = false;
    this.synthBgTimer = null;
    this.bgAudio = new Audio('/assets/bg_church_hymn.wav?v=2');
    this.bgAudio.loop = true;
    this.bgAudio.preload = 'auto';
    this.bgAudio.volume = this.bgBaseVolume;
    this.bgAudio.onerror = () => {
      this.useSynthMusicFallback = true;
    };

    // Hàng đợi Phụ (Ưu Tiên 2): Lời cầu nguyện của Tín Hữu (nhỏ nhẹ 30%, không ngắt ngang Lời Chúa)
    this.ttsQueue = [];
    this.ttsPlaying = false;
    this.currentAudio = null;
    this.activeTtsAudios = new Set();
    this.onTtsStateChange = null;
    this.lastTtsPlayedAt = 0;
    this.minTtsCooldownMs = 18000;
    this.versesSinceLastTts = 2;

    // Kênh Chủ Đạo (Ưu Tiên Số 1 Tuyệt Đối): Đọc Lời Chúa, Thánh Vịnh & Suy Niệm (100% âm lượng)
    this.scriptures = Array.isArray(window.CHURCH_SCRIPTURES) ? window.CHURCH_SCRIPTURES : [];
    this.scriptureEnabled = true;
    this.scriptureChimeEnabled = true;
    this.scriptureVoice = savedScriptureVoice || 'huuduc';
    this.scriptureIndex = 0;
    if (savedScriptureId && this.scriptures.length > 0) {
      const idx = this.scriptures.findIndex((s) => s.id === savedScriptureId);
      if (idx >= 0) this.scriptureIndex = idx;
    }
    this.verseIndex = 0;
    this.scripturePlaying = false;
    this.scripturePausedByRitual = false;
    this.currentScriptureAudio = null;
    this.activeScriptureAudios = new Set();
    this.scriptureRunId = 0;
    this.scriptureResumeTime = 0;
    this.scriptureNextTimer = null;
    this.lastScriptureStartAt = 0;
    this.lastSfxAt = 0;
    this.urlCache = new Map();
    this.inflightMap = new Map();
    this.onScriptureStateChange = null;
    this.onScriptureVisualBeat = null;

    // Bộ Đạo Diễn Hành Lễ Nhà Thờ Công Giáo (Mass Liturgy Director)
    this.massLiturgy = window.MASS_LITURGY || null;
    this.massActive = false;
    this.massStepIndex = 0;
    this.massAutoSchedule = true;
    this.massScheduleHours = [5, 6, 7, 12, 17, 18, 19, 20, 21, 22];
    this.lastTriggeredMassHourKey = '';
    this.lastTriggeredPreMassKey = '';
    this.getRecentParishionerNames = null;
    this.onMassStepVisual = null;

    // Watchdog tự phục hồi: đảm bảo Giọng đọc Kinh Thánh & Hành Lễ không bao giờ bị tắt hay kẹt giữa chừng khi livestream đông người
    this.watchdogTimer = setInterval(() => {
      if (!this.unlocked || !this.scriptureEnabled) return;
      const now = Date.now();
      if (this.scripturePlaying && this.lastScriptureStartAt > 0 && now - this.lastScriptureStartAt > 65000) {
        console.warn('[ChurchAudioEngine Watchdog] Verse playback stalled > 65s, auto-recovering...');
        this.stopAllScriptureAudios();
        this.scripturePlaying = false;
        if (this.massActive && this.massLiturgy && Array.isArray(this.massLiturgy.steps)) {
          this.massStepIndex += 1;
          if (this.massStepIndex >= this.massLiturgy.steps.length) {
            this.stopMassLiturgy(true);
            return;
          }
        } else {
          this.advanceScriptureCursor();
        }
        this.scheduleNextScriptureVerse(350);
        return;
      }
      if (!this.scripturePlaying && !this.scriptureNextTimer) {
        this.scheduleNextScriptureVerse(400);
      }
    }, 3000);

    // Bộ Hẹn Giờ Tự Động Cử Hành Thánh Lễ Theo Khung Giờ Cố Định
    this.massScheduleTimer = setInterval(() => {
      this.checkMassAutoSchedule();
    }, 15000);
  }

  stopAllScriptureAudios() {
    this.scriptureRunId += 1;
    if (this.scriptureNextTimer) {
      clearTimeout(this.scriptureNextTimer);
      this.scriptureNextTimer = null;
    }
    for (const a of this.activeScriptureAudios) {
      try {
        const doneFn = a._doneFn;
        a.onended = null;
        a.onerror = null;
        a.pause();
        if (typeof doneFn === 'function') doneFn(false);
      } catch (_) {}
    }
    this.activeScriptureAudios.clear();
    this.currentScriptureAudio = null;
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
      this.startSacredAmbience();
    }
    if (this.scriptureEnabled && !this.ttsPlaying && !this.scripturePlaying && !this.scriptureNextTimer) {
      this.scheduleNextScriptureVerse(400);
    }
    return this.ctx;
  }

  // --------------------------------------------------------------------------
  // 1. NHẠC NỀN THÁNH CA & AUTO-DUCKING KHI ĐỌC LỜI NGUYỆN / LỜI CHÚA
  // --------------------------------------------------------------------------
  isVoiceActive() {
    return Boolean(this.ttsPlaying || this.scripturePlaying);
  }

  getDuckedVolume() {
    return Math.max(0.06, +(this.bgBaseVolume * 0.30).toFixed(2));
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
      localStorage.setItem('church_music_vol_v2', String(v));
    } catch (_) {}
    this.refreshBgVolume();
  }

  setTtsVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.ttsVolume = v;
    try {
      localStorage.setItem('church_tts_vol_v2', String(v));
    } catch (_) {}
    if (this.currentAudio) {
      this.currentAudio.volume = this.scriptureEnabled ? Math.min(0.45, this.ttsVolume) : this.ttsVolume;
    }
  }

  setScriptureVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    if (!Number.isFinite(v)) return;
    this.scriptureVolume = v;
    try {
      localStorage.setItem('church_scripture_vol_v2', String(v));
    } catch (_) {}
    if (this.currentScriptureAudio) {
      this.currentScriptureAudio.volume = this.scriptureVolume;
    }
  }

  startSacredAmbience() {
    if (!this.bgMusicEnabled) return;
    if (this.useSynthMusicFallback) {
      this.startOrganSynthFallback();
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
              this.startOrganSynthFallback();
            }
          });
        }
      }
    } catch (_) {
      this.useSynthMusicFallback = true;
      this.startOrganSynthFallback();
    }
  }

  startOrganSynthFallback() {
    if (!this.bgMusicEnabled || this.synthBgTimer) return;
    const HYMN_NOTES = [293.66, 369.99, 440.0, 587.33, 554.37, 493.88];
    let step = 0;
    const playNote = () => {
      if (!this.bgMusicEnabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const freq = HYMN_NOTES[step % HYMN_NOTES.length];
        step++;
        const vol = (this.isVoiceActive() ? this.getDuckedVolume() : this.bgBaseVolume) * 0.18;
        if (vol <= 0.002) return;

        const osc = this.ctx.createOscillator();
        const sub = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        sub.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        sub.frequency.setValueAtTime(freq * 0.5, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

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
        osc.stop(now + 4.25);
        sub.stop(now + 4.25);
      } catch (_) {}
    };
    playNote();
    this.synthBgTimer = setInterval(playNote, 3600);
  }

  stopSacredAmbience() {
    try {
      this.bgAudio.pause();
    } catch (_) {}
    if (this.synthBgTimer) {
      clearInterval(this.synthBgTimer);
      this.synthBgTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // 2. TIẾNG LẦN HẠT MÂN CÔI & CHUÔNG BẠC NHẸ (ROSARY BEADS SYNTH - DUCK KHI ĐANG ĐỌC KINH)
  // --------------------------------------------------------------------------
  getSfxDuckFactor() {
    return this.scripturePlaying ? 0.16 : 0.65;
  }

  canPlaySfx(minGapMs = 420) {
    const now = Date.now();
    if (now - this.lastSfxAt < minGapMs) return false;
    this.lastSfxAt = now;
    return true;
  }

  playRosaryBead(pitchMultiplier = 1.0, volumeScale = 1.0) {
    if (!this.sfxEnabled || !this.canPlaySfx(260)) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const chime = ctx.createOscillator();
      const gain = ctx.createGain();
      const chimeGain = ctx.createGain();

      const baseFreq = 528 * pitchMultiplier * (0.99 + Math.random() * 0.02);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, now + 0.14);

      chime.type = 'sine';
      chime.frequency.setValueAtTime(baseFreq * 2.0, now);

      const peak = Math.min(0.20, 0.14 * volumeScale * this.getSfxDuckFactor());
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.linearRampToValueAtTime(peak * 0.35, now + 0.01);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      chime.connect(chimeGain);
      gain.connect(ctx.destination);
      chimeGain.connect(ctx.destination);

      osc.onended = () => {
        osc.disconnect();
        chime.disconnect();
        gain.disconnect();
        chimeGain.disconnect();
      };

      osc.start(now);
      chime.start(now);
      osc.stop(now + 0.24);
      chime.stop(now + 0.46);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. TIẾNG CHUÔNG THÁNH ĐƯỜNG NGÂN VANG (CATHEDRAL BRONZE BELL TOWER)
  // --------------------------------------------------------------------------
  playCathedralBell(intensity = 1.0, force = false) {
    if (!this.sfxEnabled || (!force && !this.canPlaySfx(550))) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      // Chuông nhà thờ hợp âm D major trầm hùng (D3 = 146.83 Hz, A3 = 220 Hz, D4 = 293.66 Hz, F#4 = 369.99 Hz)
      const base = 220.0;
      const partials = [
        { ratio: 0.5, amp: 0.26, decay: 4.5 },
        { ratio: 1.0, amp: 0.38, decay: 3.9 },
        { ratio: 1.335, amp: 0.18, decay: 2.8 },
        { ratio: 1.5, amp: 0.22, decay: 2.5 },
        { ratio: 2.0, amp: 0.16, decay: 2.0 }
      ];

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.24 * Math.min(1.2, intensity) * this.getSfxDuckFactor(), now);
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
  // 3B. TIẾNG CHUÔNG CUNG THÁNH TRUYỀN PHÉP (SANCTUS ALTAR SILVER BELL)
  // --------------------------------------------------------------------------
  playSanctusBell(rings = 3) {
    if (!this.sfxEnabled) return;
    const totalRings = Math.max(1, Math.min(5, Number(rings) || 3));
    const chord = [1318.5, 1760.0, 2217.46, 2637.0]; // E6 - A6 - C#7 - E7

    const triggerSingleRing = () => {
      try {
        const ctx = this.ensureContext();
        const now = ctx.currentTime;
        const master = ctx.createGain();
        const duck = Math.max(0.28, this.getSfxDuckFactor());
        master.gain.setValueAtTime(0.22 * duck, now);
        master.connect(ctx.destination);

        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          const t0 = now + idx * 0.018;
          osc.frequency.setValueAtTime(freq, t0);

          const amp = idx === 0 ? 0.32 : idx === 1 ? 0.26 : idx === 2 ? 0.20 : 0.16;
          const decay = 1.65 - idx * 0.18;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(amp, t0 + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

          osc.connect(g);
          g.connect(master);
          osc.onended = () => {
            osc.disconnect();
            g.disconnect();
            if (idx === 0) master.disconnect();
          };
          osc.start(t0);
          osc.stop(t0 + decay + 0.04);
        });
      } catch (_) {}
    };

    for (let r = 0; r < totalRings; r++) {
      if (r === 0) {
        triggerSingleRing();
      } else {
        setTimeout(() => {
          if (this.sfxEnabled) triggerSingleRing();
        }, r * 620);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. TIẾNG ĐÀN HARP THIÊN THẦN KHI THẮP NẾN / HÁI LỘC THÁNH (ANGELIC HARP)
  // --------------------------------------------------------------------------
  playCandleHarp() {
    if (!this.sfxEnabled || !this.canPlaySfx(450)) return;
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5 - F#5 - A5 - D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t0 = now + idx * 0.085;
        osc.frequency.setValueAtTime(freq, t0);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(0.08 * this.getSfxDuckFactor(), t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + 1.4);
      });
    } catch (_) {}
  }

  playBlessingChime() {
    if (!this.sfxEnabled) return;
    this.playCandleHarp();
    setTimeout(() => this.playCathedralBell(0.65), 260);
  }

  // --------------------------------------------------------------------------
  // 5. ZEROTTS VOICE QUEUE CHO LỜI CẦU NGUYỆN TÍN HỮU (NHỎ NHẸ 30%, ƯU TIÊN TUYỆT ĐỐI CHO LỜI CHÚA)
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

    // ƯU TIÊN TUYỆT ĐỐI GIỌNG ĐỌC LỜI CHÚA:
    // Chỉ giữ tối đa 1 lời cầu nguyện mới nhất trong hàng đợi, không bao giờ ngắt ngang câu Kinh!
    while (this.ttsQueue.length >= 1) {
      const dropped = this.ttsQueue.shift();
      if (dropped?.onStart) dropped.onStart();
      if (dropped?.onEnd) dropped.onEnd();
    }

    const item = {
      id: `ctts_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      voice: (options.voice || this.ttsVoice || 'maichi').toLowerCase(),
      url: options.url || null,
      onStart,
      onEnd
    };

    // KHÔNG gọi fetchZeroTtsAudio ngay tại đây (Lazy Synthesis):
    // Tránh việc 50 khán giả comment cùng lúc làm nghẽn ống lệnh tts_worker.py khiến Giọng Kinh Thánh bị chờ!
    this.ttsQueue.push(item);

    // Chạy kênh Mai Chi độc lập (âm lượng nhỏ 26%) song song dưới nền để xướng tên tương tác mà KHÔNG BAO GIỜ ngắt Giọng Kinh Chúa!
    this.processTtsQueue();
  }

  async fetchZeroTtsAudio(text, voice = 'maichi', priority = 'high') {
    const cacheKey = `v8::${voice}::${text}`;
    if (this.urlCache.has(cacheKey)) {
      return { ok: true, url: this.urlCache.get(cacheKey), voice };
    }
    if (this.inflightMap.has(cacheKey)) {
      return this.inflightMap.get(cacheKey);
    }

    const promise = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, priority }),
          signal: controller.signal
        });
        const data = await res.json();
        if (data && data.ok && data.url) {
          this.urlCache.set(cacheKey, data.url);
          return data;
        }
        return { ok: false, error: data?.error || 'ZeroTTS unavailable' };
      } catch (err) {
        return { ok: false, error: err.message };
      } finally {
        clearTimeout(timeoutId);
        this.inflightMap.delete(cacheKey);
      }
    })();

    this.inflightMap.set(cacheKey, promise);
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
        if (this.currentScriptureAudio) {
          this.currentScriptureAudio.volume = Math.max(0.15, this.scriptureVolume * 0.34);
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
      console.warn('[Church ZeroTTS Playback Warning]', err);
      if (item.onStart) item.onStart();
      if (item.onEnd) item.onEnd();
    } finally {
      this.ttsPlaying = false;
      if (this.currentScriptureAudio) {
        this.currentScriptureAudio.volume = this.scriptureVolume;
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
  // 6. ĐỘNG CƠ ĐỌC LỜI CHÚA, THÁNH VỊNH & SUY NIỆM (ƯU TIÊN SỐ 2, TỰ ĐỘNG NỐI TIẾP)
  // --------------------------------------------------------------------------
  getCurrentScripture() {
    if (!this.scriptures || this.scriptures.length === 0) return null;
    const idx = ((this.scriptureIndex % this.scriptures.length) + this.scriptures.length) % this.scriptures.length;
    return this.scriptures[idx];
  }

  getCurrentVerseObj() {
    const scripture = this.getCurrentScripture();
    if (!scripture || !Array.isArray(scripture.verses) || scripture.verses.length === 0) return null;
    const vIdx = ((this.verseIndex % scripture.verses.length) + scripture.verses.length) % scripture.verses.length;
    return {
      scripture,
      scriptureIndex: this.scriptureIndex,
      verseIndex: vIdx,
      totalVerses: scripture.verses.length,
      verse: scripture.verses[vIdx]
    };
  }

  resolveMassStepText(step) {
    if (!step || !step.text) return '';
    let text = String(step.text);
    if (text.includes('{{RECENT_PARISHIONERS}}')) {
      let rawNames = '';
      if (typeof this.getRecentParishionerNames === 'function') {
        try {
          rawNames = String(this.getRecentParishionerNames() || '').trim();
        } catch (_) {}
      }
      const cleanedList = rawNames
        .split(',')
        .map((n) =>
          String(n || '')
            .replace(/[0-9]+[^\s]*/g, ' ')
            .replace(/[_.\-~!@#$%^&*()+=]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 24)
        )
        .filter((n) => n.length >= 2)
        .slice(0, 3);
      const cleanNamesStr = cleanedList.join(', ');
      const replacement = cleanNamesStr
        ? (cleanNamesStr.toLowerCase().startsWith('các tín hữu') ? cleanNamesStr : `các tín hữu ${cleanNamesStr}`)
        : 'toàn thể quý ông bà và anh chị em đang hiệp thông nơi Thánh Đường';
      text = text.replace(/\{\{RECENT_PARISHIONERS\}\}/g, replacement);
    }
    return text;
  }

  getScriptureStatus() {
    if (!this.massLiturgy && window.MASS_LITURGY) {
      this.massLiturgy = window.MASS_LITURGY;
    }
    if (this.massActive && this.massLiturgy && Array.isArray(this.massLiturgy.steps) && this.massLiturgy.steps.length > 0) {
      const sIdx = Math.max(0, Math.min(this.massLiturgy.steps.length - 1, this.massStepIndex));
      const step = this.massLiturgy.steps[sIdx];
      const resolvedText = this.resolveMassStepText(step);
      return {
        enabled: this.scriptureEnabled,
        playing: this.scripturePlaying,
        pausedByRitual: this.scripturePausedByRitual,
        voice: step.voice || this.scriptureVoice,
        volume: this.scriptureVolume,
        chimeEnabled: this.scriptureChimeEnabled,
        massActive: true,
        massAutoSchedule: this.massAutoSchedule,
        massScheduleHours: this.massScheduleHours,
        massStepIndex: sIdx,
        massTotalSteps: this.massLiturgy.steps.length,
        massPartIndex: step.partIndex ?? 0,
        massPartId: step.partId || 'intro',
        massPartTitle: step.partTitle || '',
        massRole: step.role || '',
        massVoice: step.voice || 'huuduc',
        activeActor: step.activeActor || 'priest',
        priestPose: step.priestPose || 'orans',
        fx: step.fx || null,
        hallPose: step.hallPose || 'bow',
        hallBubble: step.hallBubble || '',
        scriptureId: this.massLiturgy.id || 'catholic_solemn_mass',
        scriptureTitle: step.partTitle || this.massLiturgy.title,
        scriptureShortTitle: step.role || this.massLiturgy.shortTitle,
        scriptureCategory: 'Thánh Lễ Phụng Vụ',
        verseIndex: sIdx,
        totalVerses: this.massLiturgy.steps.length,
        verseText: resolvedText
      };
    }

    const cur = this.getCurrentVerseObj();
    return {
      enabled: this.scriptureEnabled,
      playing: this.scripturePlaying,
      pausedByRitual: this.scripturePausedByRitual,
      voice: this.scriptureVoice,
      volume: this.scriptureVolume,
      chimeEnabled: this.scriptureChimeEnabled,
      massActive: false,
      massAutoSchedule: this.massAutoSchedule,
      massScheduleHours: this.massScheduleHours,
      scriptureId: cur?.scripture?.id || '',
      scriptureTitle: cur?.scripture?.title || '',
      scriptureShortTitle: cur?.scripture?.shortTitle || '',
      scriptureCategory: cur?.scripture?.category || '',
      verseIndex: cur ? cur.verseIndex : 0,
      totalVerses: cur ? cur.totalVerses : 0,
      verseText: cur?.verse?.text || ''
    };
  }

  emitScriptureState() {
    if (typeof this.onScriptureStateChange === 'function') {
      this.onScriptureStateChange(this.getScriptureStatus());
    }
  }

  prefetchVerseAudio(sIdx, vIdx) {
    if (!this.scriptures || this.scriptures.length === 0) return;
    const sc = this.scriptures[((sIdx % this.scriptures.length) + this.scriptures.length) % this.scriptures.length];
    if (!sc || !sc.verses?.length) return;
    const verse = sc.verses[((vIdx % sc.verses.length) + sc.verses.length) % sc.verses.length];
    if (verse && verse.text) {
      if (this.scriptureVoice === 'huuduc' && verse.url) return;
      this.fetchZeroTtsAudio(verse.text, this.scriptureVoice, 'low');
    }
  }

  pauseScriptureForRitual() {
    this.stopAllScriptureAudios();
    if (this.scripturePlaying || this.scriptureEnabled) {
      this.scripturePlaying = false;
      this.scripturePausedByRitual = true;
      this.refreshBgVolume();
      this.emitScriptureState();
    }
  }

  resumeScriptureAfterRitual() {
    if (!this.scriptureEnabled) {
      this.scripturePausedByRitual = false;
      this.emitScriptureState();
      return;
    }
    if (this.ttsPlaying) return;
    this.scripturePausedByRitual = false;
    this.scheduleNextScriptureVerse(700);
  }

  scheduleNextScriptureVerse(delayMs = 900) {
    if (this.scriptureNextTimer) {
      clearTimeout(this.scriptureNextTimer);
      this.scriptureNextTimer = null;
    }
    if (!this.scriptureEnabled) {
      this.emitScriptureState();
      return;
    }
    this.scriptureNextTimer = setTimeout(() => {
      this.scriptureNextTimer = null;
      this.playCurrentScriptureVerse();
    }, delayMs);
  }

  advanceScriptureCursor() {
    const cur = this.getCurrentScripture();
    if (!cur) return;
    this.scriptureResumeTime = 0;
    if (this.verseIndex + 1 < cur.verses.length) {
      this.verseIndex += 1;
    } else {
      this.verseIndex = 0;
      this.scriptureIndex = (this.scriptureIndex + 1) % this.scriptures.length;
      const nextSc = this.getCurrentScripture();
      if (nextSc) {
        try {
          localStorage.setItem('church_scripture_id', nextSc.id);
        } catch (_) {}
      }
    }
  }

  playScripturePreamble(verse) {
    if (!this.scriptureChimeEnabled || !this.sfxEnabled || !verse) return 0;
    if (verse.sfx === 'bell') {
      this.playCathedralBell(0.75);
      if (typeof this.onScriptureVisualBeat === 'function') {
        this.onScriptureVisualBeat('bell');
      }
      return 950;
    }
    if (verse.sfx === 'harp') {
      this.playCandleHarp();
      if (typeof this.onScriptureVisualBeat === 'function') {
        this.onScriptureVisualBeat('harp');
      }
      return 600;
    }
    const beats = Math.max(1, Math.min(3, Number(verse.rosaryBeats) || 2));
    for (let i = 0; i < beats; i++) {
      setTimeout(() => {
        if (!this.ttsPlaying && this.scriptureEnabled) {
          this.playRosaryBead(0.95 + (i % 2) * 0.08, 0.72);
        }
      }, i * 360);
    }
    if (typeof this.onScriptureVisualBeat === 'function') {
      this.onScriptureVisualBeat('rosary');
    }
    return beats * 360 + 220;
  }

  async playCurrentScriptureVerse() {
    if (!this.scriptureEnabled || !this.unlocked) {
      this.emitScriptureState();
      return;
    }

    if (!this.massLiturgy && window.MASS_LITURGY) {
      this.massLiturgy = window.MASS_LITURGY;
    }

    this.stopAllScriptureAudios();
    const myRunId = this.scriptureRunId;

    // ========================================================================
    // NHÁNH 1: CHẾ ĐỘ ĐANG CỬ HÀNH THÁNH LỄ CÔNG GIÁO (MASS LITURGY MODE)
    // ========================================================================
    if (this.massActive && this.massLiturgy && Array.isArray(this.massLiturgy.steps) && this.massLiturgy.steps.length > 0) {
      if (this.massStepIndex >= this.massLiturgy.steps.length) {
        this.stopMassLiturgy(true);
        return;
      }

      const step = this.massLiturgy.steps[this.massStepIndex];
      const resolvedText = this.resolveMassStepText(step);
      const stepVoice = (step.voice || 'huuduc').toLowerCase();

      this.scripturePlaying = true;
      this.scripturePausedByRitual = false;
      this.lastScriptureStartAt = Date.now();
      this.refreshBgVolume();
      this.emitScriptureState();

      // 1. Tổng hợp / lấy audio của bước hiện tại TRƯỚC TIÊN (high priority, có retry 1 lần nếu nghẽn)
      let res = await this.fetchZeroTtsAudio(resolvedText, stepVoice, 'high');
      if ((!res || !res.ok || !res.url) && myRunId === this.scriptureRunId && this.scriptureEnabled && this.massActive) {
        await new Promise((r) => setTimeout(r, 450));
        res = await this.fetchZeroTtsAudio(resolvedText, stepVoice, 'high');
      }
      if (myRunId !== this.scriptureRunId || !this.scriptureEnabled || !this.massActive) {
        this.scripturePlaying = false;
        this.refreshBgVolume();
        this.emitScriptureState();
        return;
      }

      if (!res || !res.ok || !res.url) {
        this.scripturePlaying = false;
        this.refreshBgVolume();
        this.massStepIndex += 1;
        if (this.massStepIndex >= this.massLiturgy.steps.length) {
          this.stopMassLiturgy(true);
          return;
        }
        this.scheduleNextScriptureVerse(1500);
        return;
      }

      // 2. Sau khi đã có audio của bước hiện tại, mới prefetch bước kế tiếp (prewarm priority)
      const nextStepIdx = this.massStepIndex + 1;
      if (nextStepIdx < this.massLiturgy.steps.length) {
        const nextStep = this.massLiturgy.steps[nextStepIdx];
        if (nextStep && nextStep.text) {
          this.fetchZeroTtsAudio(
            this.resolveMassStepText(nextStep),
            (nextStep.voice || 'huuduc').toLowerCase(),
            'prewarm'
          );
        }
      }

      // 3. Kích hoạt hiệu ứng âm thanh đầu bước theo step.fx
      let fxWaitMs = 0;
      if (this.sfxEnabled && step.fx) {
        if (step.fx === 'cathedralBell3') {
          this.playCathedralBell(1.0, true);
          setTimeout(() => {
            if (this.massActive && myRunId === this.scriptureRunId) this.playCathedralBell(0.95, true);
          }, 900);
          setTimeout(() => {
            if (this.massActive && myRunId === this.scriptureRunId) this.playCathedralBell(0.90, true);
          }, 1800);
          fxWaitMs = 1200;
        } else if (step.fx === 'sanctusBell3') {
          this.playSanctusBell(3);
          fxWaitMs = 1300;
        } else if (['candleHarp', 'haloFlare', 'incenseBurst', 'grandBlessingRain'].includes(step.fx)) {
          this.playCandleHarp();
          fxWaitMs = 550;
        }
      }

      if (fxWaitMs > 0) {
        await new Promise((r) => setTimeout(r, fxWaitMs));
      }

      if (myRunId !== this.scriptureRunId || !this.scriptureEnabled || !this.massActive) {
        this.scripturePlaying = false;
        this.refreshBgVolume();
        this.emitScriptureState();
        return;
      }

      // 4. Kích hoạt callback visual đồng bộ ngay lúc bắt đầu phát giọng đọc
      if (typeof this.onMassStepVisual === 'function') {
        try {
          this.onMassStepVisual(step);
        } catch (_) {}
      }

      // 5. Phát giọng đọc bước lễ
      await new Promise((resolve) => {
        let settled = false;
        let audioRef = null;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(verseGuardTimer);
          if (audioRef) {
            this.activeScriptureAudios.delete(audioRef);
            if (this.currentScriptureAudio === audioRef) this.currentScriptureAudio = null;
          }
          resolve(ok);
        };
        const verseGuardTimer = setTimeout(() => done(false), 55000);
        try {
          const audio = new Audio(res.url);
          audioRef = audio;
          audio._doneFn = done;
          this.currentScriptureAudio = audio;
          this.activeScriptureAudios.add(audio);
          audio.volume = this.scriptureVolume;

          audio.onended = () => done(true);
          audio.onerror = () => done(false);

          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => done(false));
          }
        } catch (_) {
          done(false);
        }
      });

      if (myRunId !== this.scriptureRunId || !this.massActive) return;

      this.scripturePlaying = false;
      this.versesSinceLastTts += 1;
      this.refreshBgVolume();

      const pauseMs = Math.max(400, Number(step.pauseMs) || 1100);
      this.massStepIndex += 1;

      // 6. Nếu đã hoàn thành bước cuối cùng -> tự động kết thúc lễ và chuyển về Đọc Kinh Thường
      if (this.massStepIndex >= this.massLiturgy.steps.length) {
        this.stopMassLiturgy(true);
        return;
      }

      this.emitScriptureState();
      if (this.scriptureEnabled) {
        this.scheduleNextScriptureVerse(pauseMs);
      }
      return;
    }

    // ========================================================================
    // NHÁNH 2: CHẾ ĐỘ ĐỌC KINH THƯỜNG (REGULAR SCRIPTURE MODE)
    // ========================================================================
    const cur = this.getCurrentVerseObj();
    if (!cur || !cur.verse?.text) return;

    this.scripturePlaying = true;
    this.scripturePausedByRitual = false;
    this.lastScriptureStartAt = Date.now();
    this.refreshBgVolume();
    this.emitScriptureState();

    const res =
      this.scriptureVoice === 'huuduc' && cur.verse.url
        ? { ok: true, url: cur.verse.url, voice: 'huuduc', cached: true }
        : await this.fetchZeroTtsAudio(cur.verse.text, this.scriptureVoice, 'high');
    if (myRunId !== this.scriptureRunId || !this.scriptureEnabled) {
      this.scripturePlaying = false;
      this.refreshBgVolume();
      this.emitScriptureState();
      return;
    }

    if (!res || !res.ok || !res.url) {
      this.scripturePlaying = false;
      this.refreshBgVolume();
      this.advanceScriptureCursor();
      this.scheduleNextScriptureVerse(1800);
      return;
    }

    const nextV = cur.verseIndex + 1 < cur.totalVerses ? cur.verseIndex + 1 : 0;
    const nextS = cur.verseIndex + 1 < cur.totalVerses ? cur.scriptureIndex : (cur.scriptureIndex + 1) % this.scriptures.length;
    this.prefetchVerseAudio(nextS, nextV);

    let preambleMs = 0;
    if (this.scriptureResumeTime <= 0.1) {
      preambleMs = this.playScripturePreamble(cur.verse);
    }

    if (preambleMs > 0) {
      await new Promise((r) => setTimeout(r, preambleMs));
    }

    if (myRunId !== this.scriptureRunId || !this.scriptureEnabled) {
      this.scripturePlaying = false;
      this.refreshBgVolume();
      this.emitScriptureState();
      return;
    }

    await new Promise((resolve) => {
      let settled = false;
      let audioRef = null;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(verseGuardTimer);
        if (audioRef) {
          this.activeScriptureAudios.delete(audioRef);
          if (this.currentScriptureAudio === audioRef) this.currentScriptureAudio = null;
        }
        if (myRunId === this.scriptureRunId && ok) {
          this.scriptureResumeTime = 0;
          this.advanceScriptureCursor();
        }
        resolve(ok);
      };
      const verseGuardTimer = setTimeout(() => {
        if (myRunId === this.scriptureRunId) {
          this.advanceScriptureCursor();
        }
        done(false);
      }, 55000);
      try {
        const audio = new Audio(res.url);
        audioRef = audio;
        audio._doneFn = done;
        this.currentScriptureAudio = audio;
        this.activeScriptureAudios.add(audio);
        audio.volume = this.scriptureVolume;

        audio.onended = () => done(true);
        audio.onerror = () => {
          if (myRunId === this.scriptureRunId) {
            this.advanceScriptureCursor();
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

    if (myRunId !== this.scriptureRunId) return;

    this.scripturePlaying = false;
    this.versesSinceLastTts += 1;
    this.refreshBgVolume();
    this.emitScriptureState();

    if (this.scriptureEnabled) {
      this.scheduleNextScriptureVerse(1100);
    }
  }

  // --------------------------------------------------------------------------
  // 7. CÁC HÀM ĐIỀU KHIỂN HÀNH LỄ THÁNH ĐƯỜNG & HẸN GIỜ TỰ ĐỘNG
  // --------------------------------------------------------------------------
  startMassLiturgy(partIndex = 0, stepIndex = null) {
    if (!this.massLiturgy && window.MASS_LITURGY) {
      this.massLiturgy = window.MASS_LITURGY;
    }
    if (!this.massLiturgy || !Array.isArray(this.massLiturgy.steps) || this.massLiturgy.steps.length === 0) {
      return;
    }

    let targetStep = 0;
    if (typeof stepIndex === 'number' && Number.isFinite(stepIndex)) {
      targetStep = Math.max(0, Math.min(this.massLiturgy.steps.length - 1, Math.floor(stepIndex)));
    } else {
      const pIdx = Math.max(0, Math.min(3, Number(partIndex) || 0));
      const foundIdx = this.massLiturgy.steps.findIndex((s) => s.partIndex === pIdx);
      targetStep = foundIdx >= 0 ? foundIdx : 0;
    }

    this.massStepIndex = targetStep;
    this.massActive = true;
    this.scriptureEnabled = true;
    this.scriptureResumeTime = 0;

    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.ensureContext();
    this.emitScriptureState();
    this.scheduleNextScriptureVerse(150);
  }

  stopMassLiturgy(resumeScripture = true) {
    this.massActive = false;
    this.massStepIndex = 0;
    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.refreshBgVolume();
    this.emitScriptureState();

    if (resumeScripture && this.scriptureEnabled && this.unlocked) {
      this.scheduleNextScriptureVerse(800);
    }
  }

  nextMassPart() {
    if (!this.massLiturgy && window.MASS_LITURGY) {
      this.massLiturgy = window.MASS_LITURGY;
    }
    if (!this.massActive) {
      this.startMassLiturgy(0);
      return;
    }
    const curStep = this.massLiturgy?.steps?.[this.massStepIndex];
    const curPartIndex = curStep?.partIndex ?? 0;
    const nextPartIndex = (curPartIndex + 1) % 4;
    this.startMassLiturgy(nextPartIndex);
  }

  nextMassStep() {
    if (!this.massActive || !this.massLiturgy?.steps?.length) return;
    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    if (this.massStepIndex + 1 < this.massLiturgy.steps.length) {
      this.massStepIndex += 1;
      this.emitScriptureState();
      if (this.scriptureEnabled && this.unlocked) {
        this.scheduleNextScriptureVerse(150);
      }
    } else {
      this.stopMassLiturgy(true);
    }
  }

  prevMassStep() {
    if (!this.massActive || !this.massLiturgy?.steps?.length) return;
    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.massStepIndex = Math.max(0, this.massStepIndex - 1);
    this.emitScriptureState();
    if (this.scriptureEnabled && this.unlocked) {
      this.scheduleNextScriptureVerse(150);
    }
  }

  setMassSchedule(autoSchedule, scheduleHours) {
    if (typeof autoSchedule === 'boolean') {
      this.massAutoSchedule = autoSchedule;
    }
    if (Array.isArray(scheduleHours)) {
      const valid = scheduleHours
        .map((h) => Number(h))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
      if (valid.length > 0) {
        this.massScheduleHours = Array.from(new Set(valid)).sort((a, b) => a - b);
      }
    }
    this.emitScriptureState();
  }

  checkMassAutoSchedule() {
    if (!this.massAutoSchedule || this.massActive || !this.unlocked) return;
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const nextHour = (hour + 1) % 24;
    if (Array.isArray(this.massScheduleHours) && this.massScheduleHours.includes(nextHour) && (minute === 58 || minute === 59)) {
      const preKey = `pre-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;
      if (preKey !== this.lastTriggeredPreMassKey) {
        this.lastTriggeredPreMassKey = preKey;
        console.log(`[MassLiturgyDirector] Thông báo chuẩn bị hành lễ trước 1 phút (${preKey})`);
        this.enqueueTts(
          'Xin thông báo cùng cộng đoàn: Chỉ còn một phút nữa Thánh Đường sẽ bắt đầu cử hành Nghi Thức Hành Lễ Cầu Bình An. Kính mời quý ông bà và anh chị em nán lại phòng phát trực tiếp để cùng hiệp thông và đón nhận phép lành.',
          { voice: 'kimoanh' }
        );
      }
    }
    if (Array.isArray(this.massScheduleHours) && this.massScheduleHours.includes(hour) && minute <= 2) {
      const hourKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}`;
      if (hourKey !== this.lastTriggeredMassHourKey) {
        this.lastTriggeredMassHourKey = hourKey;
        console.log(`[MassLiturgyDirector] Tự động cử hành Thánh Lễ khung giờ ${hour}:00 (${hourKey})`);
        this.startMassLiturgy(0);
      }
    }
  }

  setScriptureEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (nextEnabled && this.scriptureEnabled && (this.scripturePlaying || this.scriptureNextTimer)) {
      return;
    }
    this.scriptureEnabled = nextEnabled;
    if (!this.scriptureEnabled) {
      this.stopAllScriptureAudios();
      this.scripturePlaying = false;
      this.scripturePausedByRitual = false;
      this.refreshBgVolume();
      this.emitScriptureState();
    } else {
      this.ensureContext();
      this.scheduleNextScriptureVerse(250);
    }
  }

  setScriptureVoice(voice) {
    const v = String(voice || 'huuduc').trim().toLowerCase();
    if (!v) return;
    if (this.scriptureVoice === v && (this.scripturePlaying || this.scriptureNextTimer)) {
      return;
    }
    this.scriptureVoice = v;
    try {
      localStorage.setItem('church_scripture_voice', v);
    } catch (_) {}
    if (this.scriptureEnabled) {
      this.scriptureResumeTime = 0;
      this.stopAllScriptureAudios();
      this.scripturePlaying = false;
      this.scheduleNextScriptureVerse(200);
    } else {
      this.emitScriptureState();
    }
  }

  selectScriptureById(scriptureId, verseIndex = 0) {
    if (!this.scriptures || this.scriptures.length === 0) return;
    const idx = this.scriptures.findIndex((s) => s.id === scriptureId);
    if (idx < 0) return;
    this.scriptureIndex = idx;
    const targetSc = this.scriptures[idx];
    this.verseIndex = Math.max(0, Math.min((targetSc.verses?.length || 1) - 1, Number(verseIndex) || 0));
    this.scriptureResumeTime = 0;
    try {
      localStorage.setItem('church_scripture_id', targetSc.id);
    } catch (_) {}

    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.emitScriptureState();
    if (this.scriptureEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextScriptureVerse(200);
    }
  }

  nextScriptureVerse() {
    this.scriptureResumeTime = 0;
    this.advanceScriptureCursor();
    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.emitScriptureState();
    if (this.scriptureEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextScriptureVerse(150);
    }
  }

  prevScriptureVerse() {
    const cur = this.getCurrentScripture();
    if (!cur) return;
    this.scriptureResumeTime = 0;
    if (this.verseIndex > 0) {
      this.verseIndex -= 1;
    } else {
      this.scriptureIndex = (this.scriptureIndex - 1 + this.scriptures.length) % this.scriptures.length;
      const prevSc = this.getCurrentScripture();
      this.verseIndex = Math.max(0, (prevSc?.verses?.length || 1) - 1);
    }
    this.stopAllScriptureAudios();
    this.scripturePlaying = false;
    this.emitScriptureState();
    if (this.scriptureEnabled && this.unlocked && !this.ttsPlaying) {
      this.scheduleNextScriptureVerse(150);
    }
  }
}

window.ChurchAudioEngine = ChurchAudioEngine;
