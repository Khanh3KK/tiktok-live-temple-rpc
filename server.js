const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const SUTRA_DECK = require('./public/js/sutras.js');
const SCRIPTURE_DECK = require('./public/js/scriptures.js');
const MASS_LITURGY = require('./public/js/mass-liturgy.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const STATE_FILE = path.join(DATA_DIR, 'merit-state.json');
const CHURCH_STATE_FILE = path.join(DATA_DIR, 'church-state.json');

process.on('unhandledRejection', (reason) => {
  console.warn('[Process UnhandledRejection]', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.warn('[Process UncaughtException]', err?.message || err);
});

fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

// ============================================================================
// 1. BỘ 18 QUẺ LINH XĂM CHÙA LINH ỨNG (FORTUNE STICKS DECK)
// ============================================================================
const FORTUNE_DECK = [
  {
    number: 1,
    rank: 'Thượng Thượng Cát',
    title: 'Nhật Xuất Đông Phương — Mặt Trời Mọc Phương Đông',
    poem: 'Đông phương nhật xuất chiếu Càn Khôn\nHoa nở đầy cành rạng sắc xuân\nCông danh tài lộc đều viên mãn\nGia đạo bình an phúc lộc tồn.',
    meaning: 'Mọi sự mưu cầu đều đại cát đại lợi. Công việc hanh thông, quý nhân phù trợ, gia đình hòa thuận ấm êm.',
    ttsSummary: 'Quẻ số 1, Thượng Thượng Cát, Nhật Xuất Đông Phương. Mọi sự mưu cầu đều đại cát đại lợi, công danh tài lộc viên mãn, quý nhân phù trợ.'
  },
  {
    number: 8,
    rank: 'Thượng Cát',
    title: 'Kim Liên Khai Nở — Sen Vàng Tỏa Ngát',
    poem: 'Sen vàng nở rộ giữa hồ trong\nHương thơm lan tỏa khắp non sông\nLòng thành thắp nén nhang cầu nguyện\nTrời Phật chứng tri thỏa ước mong.',
    meaning: 'Tâm thiện lành ắt gặp phước báu. Cầu tài đắc tài, cầu bình an đắc bình an, bệnh tật tiêu trừ.',
    ttsSummary: 'Quẻ số 8, Thượng Cát, Kim Liên Khai Nở. Tâm thiện lành ắt gặp phước báu, cầu tài đắc tài, cầu bình an đắc bình an.'
  },
  {
    number: 12,
    rank: 'Đại Cát',
    title: 'Long Vân Tương Hội — Rồng Mây Gặp Gỡ',
    poem: 'Rồng thiêng gặp hội tầng mây xanh\nVượt Vũ Môn Quan rạng rỡ danh\nThí chủ kiên tâm hành thiện đạo\nPhúc dày lộc vượng khắp gia đình.',
    meaning: 'Thời vận đang lên mạnh mẽ. Thi cử đỗ đạt, kinh doanh phát đạt, gặp cơ hội lớn đổi đời.',
    ttsSummary: 'Quẻ số 12, Đại Cát, Long Vân Tương Hội. Thời vận đang lên mạnh mẽ, thi cử đỗ đạt, kinh doanh phát đạt.'
  },
  {
    number: 18,
    rank: 'Thượng Cát',
    title: 'Xuân Phong Đắc Ý — Gió Xuân Thuận Buồm',
    poem: 'Thuận buồm xuôi gió vượt trùng khơi\nBến giác bình yên nắng rạng ngời\nTài lộc dồi dào nhân duyên tốt\nBốn mùa hưng thịnh rộn niềm vui.',
    meaning: 'Đi xa gặp may, buôn bán thuận lợi, tình duyên êm đẹp, người thân mạnh khỏe.',
    ttsSummary: 'Quẻ số 18, Thượng Cát, Xuân Phong Đắc Ý. Thuận buồm xuôi gió, tài lộc dồi dào, nhân duyên tốt đẹp.'
  },
  {
    number: 24,
    rank: 'Trung Cát',
    title: 'Vũ Quá Thiên Thanh — Mưa Tạnh Trời Trong',
    poem: 'Mưa qua trời lại sáng trong ngần\nGian khó lùi xa đón phúc phần\nGiữ vững lòng thành đừng nản chí\nHoa thơm trái ngọt đến mười phân.',
    meaning: 'Khó khăn cũ sắp qua đi, vận may mới đang tới. Hãy kiên nhẫn và giữ tâm bình tĩnh.',
    ttsSummary: 'Quẻ số 24, Trung Cát, Vũ Quá Thiên Thanh. Mưa qua trời lại sáng trong, gian khó lùi xa để đón phúc phần mới.'
  },
  {
    number: 36,
    rank: 'Thượng Thượng Cát',
    title: 'Phúc Tinh Cao Chiếu — Sao Phúc Chiếu Mệnh',
    poem: 'Phúc tinh rực sáng giữa đêm rằm\nTừ bi Phật độ suốt quanh năm\nTài lộc tự nhiên về gõ cửa\nTrăm điều như ý vạn điều lành.',
    meaning: 'Sao Phúc chiếu mạng, tai qua nạn khỏi, tiền tài sung túc, gia đạo hưng long.',
    ttsSummary: 'Quẻ số 36, Thượng Thượng Cát, Phúc Tinh Cao Chiếu. Sao Phúc chiếu mạng, tài lộc tự nhiên gõ cửa, trăm điều như ý.'
  },
  {
    number: 52,
    rank: 'Thượng Cát',
    title: 'Ngọc Xuất Côn Sơn — Ngọc Quý Phát Sáng',
    poem: 'Ngọc quý Côn Sơn tỏa ánh ngời\nBấy lâu rèn giũa nay gặp thời\nTri âm tương ngộ cùng nâng đỡ\nSự nghiệp thăng hoa rạng rỡ đời.',
    meaning: 'Nỗ lực bấy lâu nay sắp được đền đáp xứng đáng. Có người tốt nâng đỡ trong công việc và cuộc sống.',
    ttsSummary: 'Quẻ số 52, Thượng Cát, Ngọc Xuất Côn Sơn. Nỗ lực bấy lâu sắp được đền đáp xứng đáng, sự nghiệp thăng hoa.'
  },
  {
    number: 68,
    rank: 'Đại Cát',
    title: 'Lộc Mã Đồng Hương — Lộc Tài Cùng Tới',
    poem: 'Lộc Mã song hành đến tận nhà\nLàm ăn buôn bán nở như hoa\nTâm thành bố thí thêm công đức\nPhú quý vinh hoa khắp một nhà.',
    meaning: 'Quẻ đại lợi về tài lộc và kinh doanh. Nên làm nhiều việc thiện để phúc đức càng thêm bền vững.',
    ttsSummary: 'Quẻ số 68, Đại Cát, Lộc Mã Đồng Hương. Đại lợi về tài lộc và buôn bán, phú quý vinh hoa khắp một nhà.'
  },
  {
    number: 81,
    rank: 'Thượng Cát',
    title: 'Nguyệt Nhập Trung Thiên — Trăng Rằm Giữa Đỉnh',
    poem: 'Trăng tròn vằng vặc giữa trời thu\nSoi sáng muôn phương sạch mây mù\nTình duyên viên mãn gia đình thuận\nTâm an vạn sự chẳng ưu tư.',
    meaning: 'Tình duyên và gia đạo vô cùng tốt đẹp. Người độc thân dễ gặp ý trung nhân, gia đình thêm tin vui.',
    ttsSummary: 'Quẻ số 81, Thượng Cát, Nguyệt Nhập Trung Thiên. Tình duyên viên mãn, gia đình hòa thuận, tâm an vạn sự lành.'
  },
  {
    number: 99,
    rank: 'Thượng Thượng Cát',
    title: 'Vạn Sự Viên Thành — Cửu Cửu Đại Cát',
    poem: 'Chín tầng mây trắng ánh hào quang\nTừ bi Phật Tổ độ nhân gian\nThí chủ lòng thành dâng lễ bái\nTrọn đời trường thọ hưởng vinh khang.',
    meaning: 'Quẻ tối thượng cát tường. Sức khỏe trường thọ, công danh hiển đạt, vạn sự viên thành.',
    ttsSummary: 'Quẻ số 99, Thượng Thượng Cát, Vạn Sự Viên Thành. Quẻ tối thượng cát tường, sức khỏe trường thọ, vạn sự như ý.'
  }
];

// ============================================================================
// 2. ZEROTTS PYTHON WORKER MANAGER (VOICE: MAI CHI)
// ============================================================================
const TTS_CACHE_INDEX_FILE = path.join(TTS_CACHE_DIR, 'cache-index.json');

class ZeroTTSManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.status = 'starting';
    this.voice = 'maichi';
    this.voices = ['maichi'];
    this.model = 'zeroweight-ai/ZeroTTS';
    this.pending = new Map();
    this.inflight = new Map();
    this.memCache = new Map();
    this.highQueue = [];
    this.lowQueue = [];
    this.prewarmQueue = [];
    this.activeJobId = null;
    this.reqCounter = 0;
    this.buffer = '';
    this.saveIndexTimer = null;
    this.loadDiskCacheIndex();
    this.startWorker();
  }

  loadDiskCacheIndex() {
    try {
      if (fs.existsSync(TTS_CACHE_INDEX_FILE)) {
        const raw = JSON.parse(fs.readFileSync(TTS_CACHE_INDEX_FILE, 'utf8'));
        for (const [k, v] of Object.entries(raw || {})) {
          if (v && v.file && fs.existsSync(path.join(TTS_CACHE_DIR, v.file))) {
            this.memCache.set(k, v);
          }
        }
        console.log(`[ZeroTTS] Đã nạp ${this.memCache.size} câu kinh từ bộ nhớ đệm đĩa (0ms delay).`);
      }
    } catch (_) {}
  }

  saveDiskCacheIndex() {
    clearTimeout(this.saveIndexTimer);
    this.saveIndexTimer = setTimeout(() => {
      try {
        const obj = {};
        for (const [k, v] of this.memCache.entries()) {
          obj[k] = v;
        }
        fs.promises.writeFile(TTS_CACHE_INDEX_FILE, JSON.stringify(obj), 'utf8').catch(() => {});
      } catch (_) {}
    }, 1500);
  }

  resolvePythonBin() {
    const candidates = [
      path.join(__dirname, '.venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '.venv', 'bin', 'python')
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  startWorker() {
    const pyBin = this.resolvePythonBin();
    const scriptPath = path.join(__dirname, 'tts_worker.py');
    console.log(`[ZeroTTS] Khởi chạy worker với ${pyBin} (Giọng mặc định: Mai Chi)...`);

    this.status = 'loading';
    this.proc = spawn(pyBin, [scriptPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1'
      }
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.handleWorkerLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[ZeroTTS stderr] ${msg}`);
    });

    this.proc.on('exit', (code) => {
      console.warn(`[ZeroTTS] Worker thoát với mã ${code}`);
      this.ready = false;
      this.status = 'stopped';
      for (const [, item] of this.pending) {
        clearTimeout(item.timer);
        item.resolve({ ok: false, error: 'ZeroTTS worker exited' });
      }
      this.pending.clear();
    });
  }

  handleWorkerLine(line) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'status') {
        this.status = msg.status;
        this.model = msg.model || this.model;
        broadcastNotification('tts.status', this.getStatus());
      } else if (msg.type === 'ready') {
        this.ready = true;
        this.status = 'ready';
        this.voice = msg.voice || 'maichi';
        this.voices = msg.voices || ['maichi'];
        this.model = msg.model || this.model;
        console.log(`[ZeroTTS] Sẵn sàng sau ${msg.loadSec}s! Giọng: ${this.voice} (${this.voices.join(', ')})`);
        broadcastNotification('tts.status', this.getStatus());
        this.dispatchNextJob();
        // Đánh thức tự động mọi trình duyệt / TikTok LIVE Studio đang mở để tiếp tục đọc Kinh ngay lập tức
        setTimeout(() => {
          broadcastNotification('church.scriptureControl', {
            action: 'sync',
            enabled: true,
            voice: churchState.settings?.scriptureVoice || 'huuduc',
            volume: 1.0
          });
          broadcastNotification('temple.sutraControl', {
            action: 'sync',
            enabled: true,
            voice: state.settings?.sutraVoice || 'huuduc',
            volume: 1.0
          });
        }, 250);
        // Pre-warm tuần tự trước các câu Nhắc Nhở Lịch Sự Ngắn Gọn, Nghi thức Hành Lễ 4 Phần & câu kinh Nhà Thờ để phát tức thì 0ms
        setTimeout(async () => {
          try {
            for (const reminder of CHURCH_GENTLE_REMINDERS) {
              await this.synthesize(reminder, 'kimoanh', 'prewarm').catch(() => {});
            }
            for (const reminder of TEMPLE_GENTLE_REMINDERS) {
              await this.synthesize(reminder, 'maichi', 'prewarm').catch(() => {});
            }
            if (MASS_LITURGY && Array.isArray(MASS_LITURGY.steps)) {
              for (const step of MASS_LITURGY.steps) {
                if (step && step.text && !step.text.includes('{{RECENT_PARISHIONERS}}')) {
                  await this.synthesize(step.text, step.voice || 'huuduc', 'prewarm').catch(() => {});
                }
              }
            }
            const scriptureVoice = churchState.settings?.scriptureVoice || 'huuduc';
            const activeScripture = SCRIPTURE_DECK.find((s) => s.id === churchState.settings?.activeScriptureId) || SCRIPTURE_DECK[0];
            if (activeScripture && Array.isArray(activeScripture.verses)) {
              for (const v of activeScripture.verses.slice(0, 4)) {
                if (v && v.text) {
                  await this.synthesize(v.text, scriptureVoice, 'prewarm').catch(() => {});
                }
              }
            }
          } catch (_) {}
        }, 600);
      } else if (msg.type === 'result' && msg.id != null) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          clearTimeout(entry.timer);
          this.pending.delete(msg.id);
          if (msg.ok && msg.url && entry.dedupKey) {
            this.memCache.set(entry.dedupKey, msg);
            this.saveDiskCacheIndex();
          }
          entry.resolve(msg);
        }
        if (this.activeJobId === msg.id) {
          this.activeJobId = null;
          this.dispatchNextJob();
        }
      } else if (msg.type === 'error') {
        console.error('[ZeroTTS Error]', msg.error);
        this.status = 'error';
        broadcastNotification('tts.status', this.getStatus());
      }
    } catch (err) {
      console.log('[ZeroTTS stdout]', line);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      status: this.status,
      engine: 'ZeroTTS (zeroweight-ai/ZeroTTS)',
      voice: state.settings.ttsVoice || this.voice || 'maichi',
      voices: this.voices,
      model: this.model
    };
  }

  dispatchNextJob() {
    if (!this.proc || !this.ready || this.activeJobId !== null) return;
    const nextJob = this.highQueue.shift() || this.lowQueue.shift() || this.prewarmQueue.shift();
    if (!nextJob) return;

    this.activeJobId = nextJob.id;
    const timer = setTimeout(() => {
      this.pending.delete(nextJob.id);
      if (this.activeJobId === nextJob.id) {
        this.activeJobId = null;
        this.dispatchNextJob();
      }
      nextJob.resolve({ ok: false, error: 'ZeroTTS synthesis timeout' });
    }, 60000);

    this.pending.set(nextJob.id, { resolve: nextJob.resolve, timer, dedupKey: nextJob.dedupKey });
    const payload = JSON.stringify({ id: nextJob.id, text: nextJob.text, voice: nextJob.voice }) + '\n';
    try {
      this.proc.stdin.write(payload);
    } catch (err) {
      clearTimeout(timer);
      this.pending.delete(nextJob.id);
      this.activeJobId = null;
      nextJob.resolve({ ok: false, error: err.message });
    }
  }

  synthesize(text, voiceOverride, priorityOverride) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return Promise.resolve({ ok: false, error: 'Empty text' });
    const voice = (voiceOverride || state.settings.ttsVoice || 'maichi').toLowerCase();
    const dedupKey = `v8::${voice}::${cleanText}`;

    if (this.memCache.has(dedupKey)) {
      return Promise.resolve(this.memCache.get(dedupKey));
    }

    if (this.inflight.has(dedupKey)) {
      if (priorityOverride === 'high') {
        const pIdx = this.prewarmQueue.findIndex((j) => j.dedupKey === dedupKey);
        if (pIdx >= 0) {
          const [promoted] = this.prewarmQueue.splice(pIdx, 1);
          this.highQueue.unshift(promoted);
        }
      }
      return this.inflight.get(dedupKey);
    }

    const isPrewarm = priorityOverride === 'prewarm' || priorityOverride === 'low';
    const isHighPriority =
      priorityOverride === 'high' ||
      (!isPrewarm && ['huuduc', 'kimoanh', 'quangminh', 'tiendat', 'giahuy'].includes(voice));

    const promise = new Promise((resolve) => {
      if (!this.proc || this.status === 'error' || this.status === 'stopped') {
        return resolve({ ok: false, error: `ZeroTTS đang ở trạng thái: ${this.status}` });
      }
      const id = ++this.reqCounter;
      const job = { id, text: cleanText, voice, dedupKey, resolve };

      if (isHighPriority) {
        this.highQueue.push(job);
      } else if (isPrewarm) {
        this.prewarmQueue.push(job);
      } else {
        // Chỉ giữ tối đa 2 yêu cầu đọc lời khấn khán giả tự động trong hàng đợi để không làm nghẽn Giọng Kinh!
        while (this.lowQueue.length >= 2) {
          const dropped = this.lowQueue.shift();
          if (dropped) dropped.resolve({ ok: false, error: 'Dropped for newer viewer TTS' });
        }
        this.lowQueue.push(job);
      }

      this.dispatchNextJob();
    }).finally(() => {
      this.inflight.delete(dedupKey);
    });

    this.inflight.set(dedupKey, promise);
    return promise;
  }
}

// ============================================================================
// 3. TRẠNG THÁI CHÙA ONLINE & BẢNG VÀNG CÔNG ĐỨC
// ============================================================================
const DEFAULT_STATE = {
  totalIncense: 108,
  totalMerit: 1080,
  woodenFishHits: 360,
  bellRings: 36,
  lanternCount: 18,
  fortuneCount: 12,
  activeIncenseSticks: 9,
  haloIntensity: 0.45,
  offerings: {
    lotus: 3,
    fruit: 2,
    lamp: 2,
    dragon: 1
  },
  devotees: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    sutraEnabled: true,
    sutraVoice: 'huuduc',
    sutraVolume: 0.95,
    activeSutraId: 'bat_nha_tam_kinh',
    bgMusicEnabled: true,
    musicVolume: 0.45,
    ttsVolume: 0.35,
    sfxEnabled: true,
    smokeDensity: 1.0,
    autoGentleReply: true,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: 'bichlieu90',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_STATE,
        ...saved,
        devotees: saved.devotees || {},
        offerings: { ...DEFAULT_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        tiktok: {
          ...DEFAULT_STATE.tiktok,
          username: saved.tiktokChannel || DEFAULT_STATE.tiktok.username
        }
      };
    }
  } catch (e) {
    console.warn('[State] Không đọc được merit-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

let state = loadState();

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = {
      totalIncense: state.totalIncense,
      totalMerit: state.totalMerit,
      woodenFishHits: state.woodenFishHits,
      bellRings: state.bellRings,
      lanternCount: state.lanternCount,
      fortuneCount: state.fortuneCount,
      activeIncenseSticks: state.activeIncenseSticks,
      offerings: state.offerings,
      devotees: state.devotees,
      settings: state.settings,
      tiktokChannel: state.tiktok?.username || 'bichlieu90'
    };
    fs.promises.writeFile(STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[State] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

function getLeaderboard(limit = 6) {
  return Object.values(state.devotees)
    .sort((a, b) => b.merit - a.merit)
    .slice(0, limit)
    .map((d, index) => ({
      rank: index + 1,
      name: d.name,
      uniqueId: d.uniqueId,
      avatar: d.avatar || '',
      merit: d.merit,
      incense: d.incense || 0,
      lastWish: d.lastWish || ''
    }));
}
// ============================================================================
// BỘ LỌC NGÔN TỪ TRANG NGHIÊM ĐA TẦNG (MULTI-LAYER SACRED SANCTUARY MODERATION)
// ============================================================================
const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}\uFDFD\u2800-\u28FF\u2580-\u259F]|[\u0300-\u036F]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const ALLOWED_VI_TEXT_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s.,!?]/g;
const ALLOWED_VI_NAME_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ\s._-]/g;
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const MODERATION_NON_WORD_RE = /[^0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]+/g;

// Nhóm A: Từ viết tắt tục tĩu / tiếng lóng đứng độc lập (kiểm tra theo ranh giới từ trên spaced & collapsedSpaced)
const STANDALONE_PROFANE_TOKENS = [
  'đm', 'dm', 'đmm', 'dmm', 'đkm', 'dkm', 'đcm', 'dcm', 'đcmm', 'dcmm', 'đklm',
  'vcl', 'vl', 'vkl', 'vler', 'vll', 'vcc', 'vc', 'cc', 'cl', 'clm', 'cmm', 'cml',
  'đéo', 'deo', 'đếch', 'đệch', 'đệt', 'đjt', 'djt', 'dit', 'đit', 'địt',
  'lồn', 'lon', 'loz', 'lòn', 'l0n', 'lờ', 'cặc', 'cac', 'cak', 'cẹc', 'buồi', 'buoi',
  'cu', 'ku', 'bú', 'liếm', 'mút', 'lùa',
  'dái', 'cứt', 'cut', 'đái', 'đĩ', 'điếm', 'phò', 'cave', 'chịch', 'xoạc',
  'nứng', 'dâm', 'sục', 'đụ', 'đù', 'đụmá', 'đụmẹ', 'đmá', 'đmẹ', 'mịa',
  'clgt', 'wtf', 'wth', 'lol', 'lmao', 'ngu', 'đần', 'cút', 'bịp', 'sex', 'porn', 'jav'
];

// Nhóm B1: Cụm từ nhạy cảm, tục tĩu, bạo lực, cờ bạc, lừa đảo (kiểm tra trên spaced & collapsedSpaced)
const PROFANE_SPACED_PHRASES = [
  'bóp dái', 'đá dái', 'vạch cu', 'bú cu', 'con cu', 'cái cu', 'chúa lòn', 'phật lòn',
  'chốn lùa', 'lùa gà', 'cừi ẻ', 'cười ỉa', 'ỉa chảy',
  'vãi l', 'vãi c', 'vãi đ', 'vãi chưởng', 'vãi cả',
  'cái lồn', 'con cặc', 'đầu buồi', 'đầu bùi', 'ăn cứt', 'chi cứt', 'cục cứt',
  'con đĩ', 'con phò', 'thằng chó', 'con chó', 'chó đẻ', 'óc chó', 'óc lợn',
  'súc vật', 'khốn nạn', 'mẹ kiếp', 'mẹ mày', 'má mày', 'bố mày', 'cha mày',
  'ông nội mày', 'bà nội mày', 'cả lò', 'tổ sư', 'tiên sư', 'mả cha', 'mả mẹ',
  'chết tiệt', 'chết bầm', 'chết mẹ', 'chết cha', 'tự tử', 'nhảy cầu', 'máu me',
  'hiếp dâm', 'ấu dâm', 'loạn luân', 'khiêu dâm', 'i cư', 'kimochi', 'yamate', 'yamete',
  'cờ bạc', 'tài xỉu', 'cá độ', 'nổ hũ', 'nhà cái', 'lừa đảo', 'lừa à',
  'te le gram', 'telegram', 'zalo', 'bố là trùm'
];

// Nhóm B2: Chuỗi viết liền không dấu cách (kiểm tra trên compact & collapsedCompact, bắt chuẩn "thòtay sangtrái bópdái bạntrai")
const PROFANE_COMPACT_SUBSTRINGS = [
  'bópdái', 'bopdai', 'đádái', 'dadai', 'đầubuồi', 'daubuoi', 'đầubùi',
  'vạchcu', 'vachcu', 'búcu', 'bucu', 'chúalòn', 'chualon', 'chốnlùa', 'chonlua', 'lùagà', 'luaga', 'cừiẻ',
  'cáilồn', 'cailon', 'concặc', 'concac', 'ăncứt', 'ancut', 'chicứt', 'cụccứt',
  'conđĩ', 'conphò', 'chóđẻ', 'ócchó', 'óclợn', 'súcvật', 'khốnnạn',
  'mẹkiếp', 'mẹmày', 'mámày', 'bốmày', 'chamày', 'mảcha', 'mảmẹ',
  'chếttiệt', 'chếtbầm', 'chếtmẹ', 'chếtcha', 'hiếpdâm', 'ấudâm', 'loạnluân', 'khiêudâm',
  'xnxx', 'xvideos', 'pornhub', 'yamate', 'yamete', 'kimochi',
  'tàixỉu', 'nổhũ', 'nhàcái', 'kubet', 'sunwin', 'go88',
  'lừađảo', 'telegram', 'bốlàtrùm', 'đụmá', 'đụmẹ', 'địtconmẹ', 'địtmẹ', 'ditme',
  'vãilồn', 'vãicặc', 'vãichưởng'
];

// Nhóm C: Bình luận thiếu tôn trọng, giễu cợt, mỉa mai, chế nhạo tôn giáo hoặc tiêu cực
const DISRESPECTFUL_SPACED_PHRASES = [
  'hết trò', 'làm trò', 'trò hề', 'câu view', 'câu like', 'câu tương tác',
  'kiếm tiền', 'ăn xin online', 'ăn mày online', 'nhảm nhí', 'nhảm quá',
  'xàm xí', 'xàm quá', 'xàm l', 'tào lao', 'vớ vẩn', 'rảnh háng', 'rảnh đời', 'rảnh quá',
  'báng bổ', 'phỉ báng', 'dị giáo', 'tà đạo', 'mê tín', 'dị đoan',
  'giả tạo', 'diễn sâu', 'như thật', 'chịu đấy', 'chịu luôn', 'vụ này luôn', 'vụ mới',
  'hết chùa', 'sang nhà thờ', 'chúa giả', 'phật giả', 'ai đọc', 'giọng ai',
  'dẹp cái này', 'dẹp đi', 'dẹp mẹ', 'bày đặt', 'lệch lạc', 'sai giáo lý', 'như cái chùa', 'như chùa', 'ảo ma', 'ảo thật',
  'tẩy chay', 'báo cáo', 'report', 'kinh tởm', 'rác rưởi', 'bẩn thỉu',
  'xuống địa ngục', 'quỷ tha ma bắt', 'ma quỷ', 'quỷ sứ', 'xui xẻo', 'tai họa', 'trù ẻo',
  'chán đời', 'tuyệt vọng', 'muốn chết', 'hận thù', 'oán hận',
  'ủa alo', 'ủa rồi', 'hố hố', 'lạy luôn'
];

const DISRESPECTFUL_COMPACT_SUBSTRINGS = [
  'hếttrò', 'làmtrò', 'tròhề', 'câuview', 'câulike', 'ănxinonline', 'ănmàyonline',
  'nhảmnhí', 'xàmxí', 'tàolao', 'vớvẩn', 'rảnhháng', 'bángbổ', 'phỉbáng',
  'dịgiáo', 'tàđạo', 'mêtín', 'dịđoan', 'giảtạo', 'diễnsâu', 'nhưthật',
  'chịuđấy', 'chịuluôn', 'vụnàyluôn', 'hếtchùa', 'sangnhàthờ', 'chúagiả', 'phậtgiả',
  'dẹpcáinày', 'dẹpđi', 'bàyđặt', 'lệchlạc', 'saigiáolý', 'nhưcáichùa',
  'tẩychay', 'kinhtởm', 'rácrưởi', 'bẩnthỉu', 'xuốngđịangục', 'quỷthama',
  'trùẻo', 'oánhận', 'ủarồi', 'ủaalo', 'ohehe'
];

const MOCKING_LAUGH_TOKENS = [
  'haha', 'hahaha', 'hehe', 'hehehe', 'hihi', 'hihihi', 'ohehe', 'hoho', 'kaka', 'kakaka', 'sặc',
  'kkk', 'kkkk', 'kkkkk', 'hjhj', 'hjx'
];

const MOCKING_EMOJI_RE = /[🤣😂😆😜🤪🤡💩🖕🤮🤢]/u;
const SARCASTIC_QUESTION_RE = /\?\s*\?+/;

function normalizeForModeration(str) {
  const raw = String(str || '');
  const lower = raw.normalize('NFKC').normalize('NFC').toLowerCase();
  const words = lower.replace(MODERATION_NON_WORD_RE, ' ').replace(/\s+/g, ' ').trim();
  const spaced = words ? ` ${words} ` : '';
  const compact = words.replace(/\s+/g, '');
  const collapsedWords = words.replace(/(.)\1{2,}/g, '$1');
  const collapsedSpaced = collapsedWords ? ` ${collapsedWords} ` : '';
  const collapsedCompact = compact.replace(/(.)\1{2,}/g, '$1');
  return { raw, lower, spaced, compact, collapsedSpaced, collapsedCompact };
}

function hasStandaloneToken(norm, tokenList) {
  if (!norm.spaced) return false;
  for (const tk of tokenList) {
    const needle = ` ${tk} `;
    if (norm.spaced.includes(needle) || norm.collapsedSpaced.includes(needle)) {
      return true;
    }
  }
  return false;
}

function hasSpacedPhrase(norm, phraseList) {
  if (!norm.spaced) return false;
  for (const p of phraseList) {
    const needle = ` ${p} `;
    if (norm.spaced.includes(needle) || norm.collapsedSpaced.includes(needle)) {
      return true;
    }
  }
  return false;
}

function hasCompactSubstring(norm, subList) {
  if (!norm.compact) return false;
  for (const sub of subList) {
    if (norm.compact.includes(sub) || norm.collapsedCompact.includes(sub)) {
      return true;
    }
  }
  return false;
}

function isBlockedName(rawName) {
  if (!rawName) return true;
  const s = String(rawName).trim();
  if (!s || WEIRD_SPAM_RE.test(s) || MOCKING_EMOJI_RE.test(s)) return true;
  const norm = normalizeForModeration(s);
  if (!norm.compact) return true;
  if (hasStandaloneToken(norm, STANDALONE_PROFANE_TOKENS)) return true;
  if (hasSpacedPhrase(norm, PROFANE_SPACED_PHRASES)) return true;
  if (hasCompactSubstring(norm, PROFANE_COMPACT_SUBSTRINGS)) return true;
  if (hasSpacedPhrase(norm, DISRESPECTFUL_SPACED_PHRASES)) return true;
  if (hasCompactSubstring(norm, DISRESPECTFUL_COMPACT_SUBSTRINGS)) return true;
  return false;
}

function isNegativeOrDisrespectful(raw) {
  if (!raw) return false;
  const s = String(raw).trim();
  if (!s) return false;
  if (s.startsWith('@')) return true;
  if (MOCKING_EMOJI_RE.test(s)) return true;
  if (SARCASTIC_QUESTION_RE.test(s)) return true;
  const norm = normalizeForModeration(s);
  if (hasStandaloneToken(norm, MOCKING_LAUGH_TOKENS)) return true;
  if (hasSpacedPhrase(norm, DISRESPECTFUL_SPACED_PHRASES)) return true;
  if (hasCompactSubstring(norm, DISRESPECTFUL_COMPACT_SUBSTRINGS)) return true;
  return false;
}

function isBlockedSpamOrToxic(raw) {
  if (!raw) return true;
  const s = String(raw).trim();
  if (!s) return true;
  if (WEIRD_SPAM_RE.test(s)) return true;
  if (isNegativeOrDisrespectful(s)) return true;
  const norm = normalizeForModeration(s);
  if (!norm.compact) return true;
  if (hasStandaloneToken(norm, STANDALONE_PROFANE_TOKENS)) return true;
  if (hasSpacedPhrase(norm, PROFANE_SPACED_PHRASES)) return true;
  if (hasCompactSubstring(norm, PROFANE_COMPACT_SUBSTRINGS)) return true;
  return false;
}

function sanitizeUserName(rawName) {
  const s = String(rawName || '').trim();
  if (!s || isBlockedName(s)) {
    return 'Thí Chủ Hữu Duyên';
  }
  const normalized = s
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 26);

  if (!normalized || isBlockedName(normalized)) {
    return 'Thí Chủ Hữu Duyên';
  }
  const letters = normalized.match(VI_LETTER_RE) || [];
  if (letters.length < 2) {
    return 'Thí Chủ Hữu Duyên';
  }
  return normalized;
}

function sanitizeWishText(rawWish) {
  if (!rawWish) return '';
  const rawStr = String(rawWish).trim();
  if (!rawStr || isBlockedSpamOrToxic(rawStr)) return '';
  const cleaned = rawStr
    .normalize('NFKC')
    .normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(ALLOWED_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, 220);

  if (!cleaned || isBlockedSpamOrToxic(cleaned)) return '';
  const letters = cleaned.match(VI_LETTER_RE) || [];
  if (letters.length < 2) return '';
  return cleaned;
}

function recordDevotee(user, uniqueId, avatar, meritDelta, incenseDelta = 0, giftDelta = 0, wish = '') {
  const displayName = sanitizeUserName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const safeUniqueId = isBlockedName(uniqueId) ? '' : String(uniqueId || '').trim();
  const key = (safeUniqueId || displayName).slice(0, 40);
  if (!state.devotees[key]) {
    state.devotees[key] = {
      name: displayName,
      uniqueId: safeUniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      merit: 0,
      incense: 0,
      gifts: 0,
      lastWish: ''
    };
  }
  const dev = state.devotees[key];
  dev.name = displayName;
  if (avatar) dev.avatar = avatar;
  dev.merit += meritDelta;
  dev.incense += incenseDelta;
  dev.gifts += giftDelta;
  if (cleanWish) dev.lastWish = cleanWish;

  state.totalMerit += meritDelta;
  state.haloIntensity = Math.min(1.0, 0.35 + (state.totalMerit % 1000) / 1400);
  return dev;
}

function pushEventLog(evt) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  state.recentEvents.unshift(entry);
  if (state.recentEvents.length > 35) {
    state.recentEvents.length = 35;
  }
  return entry;
}

function getPublicState() {
  return {
    totalIncense: state.totalIncense,
    totalMerit: state.totalMerit,
    woodenFishHits: state.woodenFishHits,
    bellRings: state.bellRings,
    lanternCount: state.lanternCount,
    fortuneCount: state.fortuneCount,
    activeIncenseSticks: state.activeIncenseSticks,
    haloIntensity: state.haloIntensity,
    offerings: state.offerings,
    leaderboard: getLeaderboard(24),
    recentEvents: state.recentEvents.slice(0, 25),
    settings: state.settings,
    tiktok: state.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
  };
}

// ============================================================================
// 4. NGHI THỨC TƯƠNG TÁC (RITUAL HANDLERS)
// ============================================================================
const Rituals = {
  burnIncense(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Thành tâm dâng hương bái Phật, cầu bình an cát tường';
    const merit = count * 5;

    state.totalIncense += count;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + count);
    const devotee = recordDevotee(user, uniqueId, avatar, merit, count, 0, wish);

    const suggestedTts = `Cảm tạ thí chủ ${devotee.name} thành tâm dâng hương cầu nguyện: ${wish}. Nam mô A Di Đà Phật.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: 'burnIncense',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  strikeWoodenFish(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const merit = count;

    state.woodenFishHits += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0);
    const suggestedTts = `Cảm tạ thí chủ ${devotee.name} thành tâm gõ mõ tụng kinh cầu bình an.`;

    const event = pushEventLog({
      type: 'strikeWoodenFish',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      suggestedTts,
      ttsText: params.forceTts ? suggestedTts : ''
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  ringBell(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Thỉnh chuông Bát Nhã, phiền não tiêu tan, trí tuệ sáng ngời';
    const merit = count * 10;

    state.bellRings += count;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const suggestedTts = `Thí chủ ${devotee.name} thỉnh Đại Hồng Chung cầu nguyện: ${wish}.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: 'ringBell',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      count,
      merit,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Cầu cho quốc thái dân an, gia đình mạnh khỏe hạnh phúc';
    const merit = 10;

    state.lanternCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 1, 0, wish);

    const suggestedTts = `Lời cầu nguyện của thí chủ ${devotee.name}: ${wish}. Nam mô A Di Đà Phật.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: 'sendPrayer',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      wish,
      merit,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const giftType = ['lotus', 'fruit', 'lamp', 'dragon'].includes(params.giftType)
      ? params.giftType
      : (coins >= 100 ? 'dragon' : coins >= 20 ? 'fruit' : coins >= 5 ? 'lamp' : 'lotus');

    const giftLabels = {
      lotus: 'Đài Hoa Sen Vàng',
      fruit: 'Mâm Ngũ Quả Cát Tường',
      lamp: 'Đèn Lưu Ly Trí Tuệ',
      dragon: 'Đại Lễ Kim Long Chầu Phật'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const merit = Math.max(20, coins * multiplier);

    state.offerings[giftType] = (state.offerings[giftType] || 0) + 1;
    state.totalIncense += 3;
    state.activeIncenseSticks = Math.min(36, state.activeIncenseSticks + 3);

    const wish = params.wish || `Dâng cúng ${giftName} lên Tam Bảo`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 3, 1, wish);

    const suggestedTts = `Công đức vô lượng! Cảm tạ thí chủ ${devotee.name} đã phát tâm dâng cúng ${giftName}. Nguyện cầu chư Phật gia hộ vạn sự cát tường.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: giftType === 'dragon' ? 'grandCeremony' : 'offerGift',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      giftType,
      giftName,
      coins,
      merit,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  drawFortune(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đạo, Tài lộc và Bình an';
    const fortune = FORTUNE_DECK[Math.floor(Math.random() * FORTUNE_DECK.length)];
    const merit = 10;

    state.fortuneCount += 1;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, `Xin xăm: Quẻ số ${fortune.number} (${fortune.rank})`);

    const suggestedTts = `Thí chủ ${devotee.name} vừa gieo được ${fortune.ttsSummary}`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: 'drawFortune',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      topic,
      fortune,
      merit,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  grandCeremony(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'dragon',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Hào Quang Vạn Trượng'
    });
  },

  requestSutra(params = {}) {
    const user = sanitizeUserName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const requestedId = String(params.sutraId || '').trim();
    const sutra =
      SUTRA_DECK.find((s) => s.id === requestedId) ||
      SUTRA_DECK[Math.floor(Math.random() * SUTRA_DECK.length)];
    const merit = 15;

    state.settings.sutraEnabled = true;
    state.settings.activeSutraId = sutra.id;

    const wish = sanitizeWishText(params.wish) || `Thành tâm thỉnh pháp: ${sutra.shortTitle}`;
    const devotee = recordDevotee(user, uniqueId, avatar, merit, 0, 0, wish);

    const suggestedTts = `Thí chủ ${devotee.name} thành tâm thỉnh pháp ${sutra.shortTitle}.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushEventLog({
      type: 'requestSutra',
      user: devotee.name,
      uniqueId: devotee.uniqueId,
      avatar: devotee.avatar,
      sutraId: sutra.id,
      sutraTitle: sutra.title,
      sutraShortTitle: sutra.shortTitle,
      merit,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: state.settings.ttsVoice || 'maichi'
    });

    saveState();
    broadcastNotification('temple.event', { event, state: getPublicState() });
    return { event, state: getPublicState() };
  },

  controlSutra(params = {}) {
    if (typeof params.enabled === 'boolean') {
      state.settings.sutraEnabled = params.enabled;
    }
    if (params.voice) {
      state.settings.sutraVoice = String(params.voice).trim().toLowerCase();
    }
    if (typeof params.volume === 'number') {
      state.settings.sutraVolume = Math.max(0, Math.min(1, Number(params.volume)));
    }
    if (params.sutraId) {
      const found = SUTRA_DECK.find((s) => s.id === params.sutraId);
      if (found) {
        state.settings.activeSutraId = found.id;
      }
    }
    saveState();
    broadcastNotification('temple.sutraControl', {
      action: params.action || 'sync',
      sutraId: state.settings.activeSutraId,
      verseIndex: params.verseIndex,
      enabled: state.settings.sutraEnabled,
      voice: state.settings.sutraVoice,
      volume: state.settings.sutraVolume
    });
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  updateSettings(params = {}) {
    state.settings = {
      ...state.settings,
      ...params
    };
    if (typeof params.autoSim === 'boolean') {
      configureAutoSim(params.autoSim);
    }
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  },

  resetMerit() {
    state.totalIncense = 9;
    state.totalMerit = 0;
    state.woodenFishHits = 0;
    state.bellRings = 0;
    state.lanternCount = 0;
    state.fortuneCount = 0;
    state.activeIncenseSticks = 3;
    state.offerings = { lotus: 1, fruit: 1, lamp: 1, dragon: 0 };
    state.devotees = {};
    state.recentEvents = [];
    saveState();
    broadcastNotification('temple.state', getPublicState());
    return getPublicState();
  }
};

// ============================================================================
// 5. TIKTOK LIVE CONNECTOR & COMMENT PARSER
// ============================================================================
let tiktokConn = null;

const commentCooldownMap = new Map();
const GENTLE_REMINDER_COOLDOWN_MS = 90000;

const TEMPLE_GENTLE_REMINDERS = [
  'Đây là không gian nghe kinh thanh tịnh, xin quý vị cùng giữ lời nói hòa ái. A Di Đà Phật.'
];

const CHURCH_GENTLE_REMINDERS = [
  'Đây là không gian chia sẻ Kinh Thánh và lan tỏa Lời Chúa, xin mọi người cùng giữ lời nói hiền hòa. Amen.',
  'Xin anh chị em cùng giữ sự trang nghiêm để cộng đoàn lắng nghe Lời Chúa. Chúa chúc lành cho bạn.'
];

let lastTempleGentleReplyAt = 0;
let templeGentleReplyCursor = 0;
let lastChurchGentleReplyAt = 0;
let churchGentleReplyCursor = 0;

async function triggerTempleGentleReminder(force = false) {
  if (!force) {
    if (state.settings?.autoGentleReply === false) {
      return { ok: false, triggered: false, reason: 'disabled' };
    }
    const now = Date.now();
    if (now - lastTempleGentleReplyAt < GENTLE_REMINDER_COOLDOWN_MS) {
      return { ok: false, triggered: false, reason: 'cooldown' };
    }
    lastTempleGentleReplyAt = now;
  } else {
    lastTempleGentleReplyAt = Date.now();
  }
  const text = TEMPLE_GENTLE_REMINDERS[templeGentleReplyCursor++ % TEMPLE_GENTLE_REMINDERS.length];
  const res = await zeroTts.synthesize(text, 'maichi', 'high');
  if (res.ok && res.url) {
    broadcastNotification('temple.gentleReminder', {
      text,
      voice: 'maichi',
      url: res.url
    });
  }
  return {
    ok: Boolean(res.ok),
    triggered: Boolean(res.ok),
    text,
    voice: 'maichi',
    url: res.url || '',
    autoGentleReply: state.settings?.autoGentleReply !== false
  };
}

function parseViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw) {
    return null;
  }
  if (isBlockedSpamOrToxic(raw)) {
    console.log(`[Bộ Lọc Tịnh Tâm] Đã chặn bình luận không phù hợp từ ${user || uniqueId || 'ẩn danh'}: "${raw}"`);
    triggerTempleGentleReminder(false).catch(() => {});
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) {
    return null;
  }

  // Chống 1 người spam bình luận liên tục làm nghẽn hàng đợi TTS (cooldown 3.5 giây/người)
  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey) {
    const lastTs = commentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) {
      return null;
    }
    commentCooldownMap.set(userKey, now);
    if (commentCooldownMap.size > 600) {
      const oldestKey = commentCooldownMap.keys().next().value;
      commentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeUserName(user);
  const lower = cleanWish.toLowerCase();

  // 1. Xin xăm / Gieo quẻ
  if (
    lower.includes('xin xăm') ||
    lower.includes('xin xam') ||
    lower.includes('gieo quẻ') ||
    lower.includes('gieo que') ||
    lower.includes('rút quẻ') ||
    lower.includes('rut que') ||
    lower.includes('quẻ') ||
    lower.includes('que')
  ) {
    return Rituals.drawFortune({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 2. Thỉnh chuông
  if (lower.includes('chuông') || lower.includes('chuong') || lower.includes('thỉnh chuông')) {
    return Rituals.ringBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 3. Gõ mõ
  if (lower.includes('gõ mõ') || lower.includes('go mo') || lower.includes('tụng kinh')) {
    return Rituals.strikeWoodenFish({ user: cleanUser, uniqueId, avatar, count: 3 });
  }

  // 4. Thắp hương / Bái Phật
  if (
    lower.includes('thắp hương') ||
    lower.includes('thap huong') ||
    lower.includes('dâng hương') ||
    lower.includes('dang huong') ||
    lower.includes('bái phật') ||
    lower.includes('bai phat') ||
    lower.includes('lạy phật') ||
    lower.includes('lay phat')
  ) {
    return Rituals.burnIncense({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
  }

  // 5. Cầu nguyện / Thả đèn hoa đăng (Whitelist nghiêm ngặt chỉ nhận lời cầu nguyện / chúc lành tích cực)
  const TEMPLE_PRAYER_WHITELIST = [
    'cầu', 'cau ', 'nguyện', 'nguyen', 'xin', 'phật', 'phat', 'bồ tát', 'bo tat',
    'quan âm', 'quan am', 'di đà', 'di da', 'nam mô', 'nam mo', 'mô phật', 'mo phat',
    'a di đà', 'a di da', 'bình an', 'binh an', 'sức khỏe', 'suc khoe', 'gia đình', 'gia dinh',
    'gia đạo', 'gia dao', 'cha mẹ', 'bố mẹ', 'ba má', 'ông bà', 'con cái', 'tài lộc', 'tai loc',
    'may mắn', 'may man', 'vạn sự', 'van su', 'như ý', 'nhu y', 'cát tường', 'cat tuong',
    'phù hộ', 'phu ho', 'độ trì', 'do tri', 'công đức', 'cong duc', 'thành tâm', 'thanh tam',
    'cảm tạ', 'cam ta', 'sám hối', 'sam hoi', 'hoan hỷ', 'hoan hy', 'an lạc', 'an lac',
    'tịnh tâm', 'tinh tam', 'chúc', 'lạy', 'kính'
  ];
  if (TEMPLE_PRAYER_WHITELIST.some((kw) => lower.includes(kw))) {
    return Rituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  // Bỏ qua mọi bình luận tán gẫu ngẫu nhiên không nằm trong danh mục cầu nguyện để giữ màn hình trang nghiêm
  return null;
}

const giftComboTracker = new Map();

async function resolveTikTokUsername(rawInput) {
  let input = String(rawInput || '').trim();
  if (!input) {
    throw new Error('Vui lòng nhập @username hoặc link TikTok Live cần kết nối');
  }
  if (input.startsWith('http://') || input.startsWith('https://') || input.includes('tiktok.com/')) {
    const urlToFetch = input.startsWith('http') ? input : `https://${input}`;
    const directMatch = urlToFetch.match(/tiktok\.com\/@([^/?#]+)/i);
    if (directMatch && directMatch[1]) {
      return directMatch[1];
    }
    try {
      const parsed = new URL(urlToFetch);
      if (/(^|\.)tiktok\.com$/i.test(parsed.hostname)) {
        const resp = await fetch(urlToFetch, { redirect: 'follow' });
        const finalUrl = resp.url || '';
        const resolvedMatch = finalUrl.match(/tiktok\.com\/@([^/?#]+)/i);
        if (resolvedMatch && resolvedMatch[1]) {
          return resolvedMatch[1];
        }
      }
    } catch (e) {
      console.warn('[TikTok URL Resolve Warning]', e.message);
    }
  }
  return input.replace(/^@/, '').split(/[/?#]/)[0].trim();
}

function detectViewerGender(rawName = '', uniqueId = '', rawGender = null) {
  if (rawGender === 2 || rawGender === 'female' || rawGender === 'F') return 'female';
  if (rawGender === 1 || rawGender === 'male' || rawGender === 'M') return 'male';

  const combined = `${rawName} ${uniqueId}`.toLowerCase().normalize('NFC');
  const femaleKeywords = [
    'maria', 'anna', 'têrêsa', 'teresa', 'cecilia', 'monica', 'rosa', 'clara', 'lucia', 'marta', 'catarina', 'agnes',
    'thị', 'ngọc', 'linh', 'thảo', 'thao', 'trang', 'huyền', 'huyen', 'vy', 'vi', 'nhi', 'phương', 'phuong',
    'lan', 'mai', 'hương', 'huong', 'hằng', 'hang', 'nhung', 'yến', 'yen', 'oanh', 'trinh', 'liễu', 'lieu',
    'quyên', 'quyen', 'ngân', 'ngan', 'hà', 'ha', 'diệu', 'dieu', 'thư', 'thu', 'bích', 'bich', 'tuyết', 'tuyet',
    'trâm', 'tram', 'nguyệt', 'nguyet', 'loan', 'dung', 'kiều', 'kieu', 'hạnh', 'hanh', 'duyên', 'duyen', 'my',
    'quỳnh', 'quynh', 'diễm', 'diem', 'thúy', 'thuy', 'thủy', 'nga', 'chị', 'cô', 'bé', 'mẹ', 'bà', 'girl', 'queen', 'princess', 'lili', 'lily', 'na'
  ];
  const maleKeywords = [
    'giuse', 'phêrô', 'phero', 'phaolô', 'phaolo', 'gioan', 'antôn', 'anton', 'phanxicô', 'phanxico', 'đaminh', 'daminh',
    'vinhsơn', 'vinhson', 'micae', 'stephano', 'tôma', 'toma', 'martinô', 'martino', 'augustinô',
    'văn', 'tuấn', 'tuan', 'kiệt', 'kiet', 'quân', 'quan', 'nam', 'đạt', 'dat', 'thắng', 'thang', 'hùng', 'hung',
    'dũng', 'dung', 'cường', 'cuong', 'tùng', 'tung', 'sơn', 'son', 'hải', 'hai', 'long', 'vũ', 'vu', 'phong',
    'đức', 'duc', 'thịnh', 'thinh', 'trí', 'tri', 'huy', 'hoàng', 'hoang', 'hiếu', 'hieu', 'trọng', 'trong',
    'tài', 'tai', 'phúc', 'phuc', 'khánh', 'khanh', 'toàn', 'toan', 'trung', 'kiên', 'kien', 'khôi', 'khoi',
    'hào', 'hao', 'lâm', 'lam', 'bách', 'bach', 'tú', 'anh', 'chú', 'ông', 'boy', 'king', 'adam', 'lee'
  ];

  for (const kw of femaleKeywords) {
    const re = new RegExp(`(^|[^a-zà-ỹ])${kw}([^a-zà-ỹ]|$)`, 'i');
    if (re.test(combined) || combined.includes(kw)) return 'female';
  }
  for (const kw of maleKeywords) {
    const re = new RegExp(`(^|[^a-zà-ỹ])${kw}([^a-zà-ỹ]|$)`, 'i');
    if (re.test(combined)) return 'male';
  }
  // Hash ổn định theo tên (50/50 Nam/Nữ cho các nickname trung tính)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'female' : 'male';
}

function extractUserFromEvent(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  const gender = detectViewerGender(user, uniqueId, u.gender ?? data?.gender ?? null);
  return { user, uniqueId, avatar, gender };
}

async function connectTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (tiktokConn) {
    try {
      await tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }

  state.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  broadcastNotification('temple.state', getPublicState());

  tiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  tiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    state.tiktok.lastError = null;
    console.log(`[TikTok Live - Chùa] Đã kết nối phòng @${cleanUser} (roomId: ${state.tiktok.roomId})`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.DISCONNECTED, () => {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    console.log(`[TikTok Live - Chùa] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(ControlEvent.ERROR, (err) => {
    state.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live - Chùa Warning]', state.tiktok.lastError);
    broadcastNotification('temple.state', getPublicState());
  });

  tiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount > 0) {
      state.tiktok.viewerCount = viewerCount;
      broadcastNotification('temple.viewerCount', { viewerCount });
    }
  });

  let lastMemberWalkTs = 0;
  tiktokConn.on(WebcastEvent.MEMBER, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const now = Date.now();
    if (now - lastMemberWalkTs >= 8500) {
      lastMemberWalkTs = now;
      Rituals.burnIncense({
        user,
        uniqueId,
        avatar,
        count: 1,
        wish: 'Đã vào Chánh Điện lễ Phật, cầu bình an cát tường',
        readTts: false
      });
    } else {
      recordDevotee(user, uniqueId, avatar, 1, 0, 0, 'Đã vào Chánh Điện lễ Phật');
      broadcastNotification('temple.state', getPublicState());
    }
  });

  tiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat - Chùa] ${user}: ${commentText}`);
    parseViewerComment(commentText, user, uniqueId, avatar);
  });

  tiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    Rituals.strikeWoodenFish({ user, uniqueId, avatar, count: likeCount });
  });

  const handleSocialEvent = (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    Rituals.ringBell({
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  tiktokConn.on(WebcastEvent.FOLLOW, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SHARE, handleSocialEvent);
  tiktokConn.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleSocialEvent(data);
    }
  });

  tiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    const prevCount = giftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount && data?.repeatEnd) {
      giftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = Math.max(1, repeatCount - prevCount);
    giftComboTracker.set(groupId, repeatCount);
    if (giftComboTracker.size > 500) {
      const firstKey = giftComboTracker.keys().next().value;
      giftComboTracker.delete(firstKey);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
    const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`[TikTok Gift - Chùa] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

    Rituals.offerGift({
      user,
      uniqueId,
      avatar,
      coins: totalCoins,
      giftName: displayGiftName,
      wish: `Thành tâm dâng ${displayGiftName} kính lễ Đức Phật A Di Đà`
    });
  });

  try {
    const roomState = await tiktokConn.connect();
    state.tiktok.connected = true;
    state.tiktok.connecting = false;
    state.tiktok.roomId = roomState?.roomId || tiktokConn?.roomId || null;
    broadcastNotification('temple.state', getPublicState());
    return state.tiktok;
  } catch (err) {
    state.tiktok.connected = false;
    state.tiktok.connecting = false;
    state.tiktok.lastError = err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    broadcastNotification('temple.state', getPublicState());
    throw new Error(state.tiktok.lastError);
  }
}

function disconnectTikTokLive() {
  if (tiktokConn) {
    try {
      tiktokConn.disconnect();
    } catch (_) {}
    tiktokConn = null;
  }
  state.tiktok.connected = false;
  state.tiktok.connecting = false;
  state.tiktok.viewerCount = 0;
  broadcastNotification('temple.state', getPublicState());
  return state.tiktok;
}

// ============================================================================
// 6. AUTO-SIMULATION ENGINE (CHẾ ĐỘ TỰ ĐỘNG GIẢ LẬP ĐÔNG NGƯỜI XEM)
// ============================================================================
let autoSimTimer = null;
let autoSimCursor = 0;
const SIM_DEVOTEES = [
  { user: 'Ngọc Anh Nguyễn', uniqueId: 'ngocanh.98', wish: 'Con thành tâm cầu cho bố mẹ luôn mạnh khỏe, bình an' },
  { user: 'Trần Minh Quân', uniqueId: 'minhquan_bds', wish: 'Cầu tháng mới công việc thuận buồm xuôi gió, tài lộc hanh thông' },
  { user: 'Diệu Thảo Tâm An', uniqueId: 'tam_an_99', wish: 'Nam Mô A Di Đà Phật, nguyện cầu thế giới hòa bình chúng sinh an lạc' },
  { user: 'Lê Hoàng Nam', uniqueId: 'hoangnam.dev', wish: 'Cầu thi cử đỗ đạt điểm cao, sự nghiệp rộng mở' },
  { user: 'Phạm Thanh Hà', uniqueId: 'thanhha.lotus', wish: 'Cầu gia đạo êm ấm, con cái ngoan ngoãn học giỏi' },
  { user: 'Vũ Đức Thịnh', uniqueId: 'ducthinh88', wish: 'Con xin gieo một quẻ cầu tài lộc đầu tháng' },
  { user: 'Nguyễn Khánh Vy', uniqueId: 'khanhvy.sg', wish: 'Cầu cho ông bà cha mẹ bách niên giai lão, sức khỏe dồi dào' },
  { user: 'Đặng Quốc Bảo', uniqueId: 'quocbao_hn', wish: 'Cầu buôn may bán đắt, gặp nhiều quý nhân phù trợ' },
  { user: 'Bùi Phương Linh', uniqueId: 'phuonglinh.95', wish: 'Con thành tâm kính lễ Đức Phật A Di Đà, cầu tâm an vạn sự lành' },
  { user: 'Hoàng Tuấn Kiệt', uniqueId: 'tuankiet.89', wish: 'Cầu công danh sự nghiệp hanh thông, vạn sự cát tường như ý' },
  { user: 'Trịnh Mỹ Duyên', uniqueId: 'myduyen.flower', wish: 'Cầu tình duyên viên mãn, gia đình hòa thuận hạnh phúc' },
  { user: 'Đỗ Minh Trí', uniqueId: 'minhtri.tech', wish: 'Con xin thỉnh chuông cầu bình an cho cả gia đình' }
];

function runSingleSimulationStep() {
  const pick = SIM_DEVOTEES[autoSimCursor % SIM_DEVOTEES.length];
  autoSimCursor++;
  const roll = Math.random();
  if (roll < 0.30) {
    Rituals.burnIncense({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.55) {
    Rituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.75) {
    Rituals.drawFortune({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    Rituals.offerGift({ user: pick.user, uniqueId: pick.uniqueId, giftType: 'lotus', coins: 15, giftName: 'Hoa Sen Vàng Tinh Khiết' });
  } else {
    Rituals.ringBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureAutoSim(enabled) {
  state.settings.autoSim = Boolean(enabled);
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
  }
  if (state.settings.autoSim) {
    runSingleSimulationStep();
    autoSimTimer = setInterval(runSingleSimulationStep, Math.max(16000, state.settings.autoSimIntervalMs || 18000));
  }
}

// ============================================================================
// 6B. WORKFLOW ĐI NHÀ THỜ — THÁNH ĐƯỜNG HỒNG ÂN ONLINE (CHURCH SANCTUARY RPC)
// ============================================================================
const BIBLE_BLESSING_DECK = [
  {
    number: 1,
    rank: 'Hồng Ân Thượng Đẳng',
    title: 'Chúa Là Mục Tử Chăn Dắt Đời Con',
    reference: 'Thánh Vịnh 23:1-2',
    poem: 'Chúa chăn nuôi tôi, tôi chẳng thiếu thốn chi\nĐồng cỏ xanh tươi Người cho tôi nằm nghỉ\nSuối nước trong lành bổ sức tâm hồn tôi\nDẫn lối ngay lành trọn kiếp sống bình an.',
    meaning: 'Mọi bước đường bạn đi đều có bàn tay Chúa Quan Phòng dẫn dắt. Công việc, gia đình và sức khỏe đều được nâng đỡ dư đầy.',
    ttsSummary: 'Lộc Thánh số 1, Hồng Ân Thượng Đẳng, Thánh Vịnh 23. Chúa là Mục Tử chăn dắt tôi, tôi chẳng thiếu thốn chi. Công việc và gia đình được Chúa chúc lành dư đầy.'
  },
  {
    number: 3,
    rank: 'Phúc Lộc Bình An',
    title: 'Ánh Sáng Thế Gian — Muối Cho Đời',
    reference: 'Mátthêu 5:14-16',
    poem: 'Chính anh em là ánh sáng cho trần gian\nNgọn đèn trên cao soi rạng khắp muôn đàng\nViệc lành tỏa sáng giữa lòng người nhân thế\nHồng ân Thiên Chúa tuôn đổ xuống muôn vàn.',
    meaning: 'Nỗ lực ngay lành và tấm lòng thiện tâm của bạn sắp gặt hái trái ngọt. Sự nghiệp thăng tiến, được mọi người yêu mến tín nhiệm.',
    ttsSummary: 'Lộc Thánh số 3, Phúc Lộc Bình An, Tin Mừng Mátthêu. Chính anh em là ánh sáng cho trần gian. Những nỗ lực lương thiện của bạn sắp gặt hái trái ngọt vẻ vang.'
  },
  {
    number: 7,
    rank: 'Ân Sủng Tràn Đầy',
    title: 'Hãy Xin Thì Sẽ Được — Hãy Tìm Sẽ Thấy',
    reference: 'Mátthêu 7:7-8',
    poem: 'Cứ xin đi rồi sẽ được Chúa thương ban\nCứ tìm kiếm sẽ gặp kho báu bình an\nCứ gõ cửa, khung trời mới sẽ mở lối\nCha trên trời luôn ban phát những điều lành.',
    meaning: 'Lời cầu nguyện chân thành của bạn đã thấu tới Tòa Chúa. Những điều bạn đang ấp ủ mưu cầu sẽ sớm thành tựu mỹ mãn.',
    ttsSummary: 'Lộc Thánh số 7, Ân Sủng Tràn Đầy. Anh em cứ xin thì sẽ được, cứ tìm thì sẽ thấy, cứ gõ cửa thì sẽ mở cho. Mọi ước nguyện lành thánh đều sớm thành tựu.'
  },
  {
    number: 9,
    rank: 'Hồng Ân Cứu Độ',
    title: 'Bình An Của Chúa Vượt Mọi Lo Âu',
    reference: 'Gioan 14:27',
    poem: 'Thầy để lại bình an đích thực cho anh em\nGiữa sóng gió đời lòng chẳng chút ưu phiền\nĐừng xao xuyến và đừng sợ hãi chi cả\nCó Chúa đồng hành mưa nắng hóa bình yên.',
    meaning: 'Mọi muộn phiền hay thử thách vừa qua đang khép lại. Tâm hồn đón nhận sự bình an sâu thẳm, gia đạo thuận hòa êm ấm.',
    ttsSummary: 'Lộc Thánh số 9, Hồng Ân Cứu Độ, Tin Mừng Gioan. Thầy để lại bình an cho anh em, lòng anh em đừng xao xuyến. Khó khăn lùi xa, gia đình đón nhận bình an.'
  },
  {
    number: 12,
    rank: 'Đại Phúc Vinh Quang',
    title: 'Kế Hoạch Yêu Thương & Tương Lai Tươi Sáng',
    reference: 'Giêrêmia 29:11',
    poem: 'Ta biết rõ chương trình Ta hoạch định cho con\nChương trình bình an chứ không phải tai ương\nBan cho con một tương lai đầy hy vọng\nVững bước tin yêu đón nhận phước lộc tràn.',
    meaning: 'Một vận hội mới vô cùng tốt đẹp về công danh, học tập và kinh doanh đang mở ra phía trước. Hãy vững lòng tiến bước.',
    ttsSummary: 'Lộc Thánh số 12, Đại Phúc Vinh Quang, Sách Tiên Tri Giêrêmia. Chúa dành sẵn cho bạn chương trình bình an và một tương lai tràn đầy hy vọng.'
  },
  {
    number: 15,
    rank: 'Phúc Lộc Trường Tồn',
    title: 'Tình Yêu Đức Ái Không Bao Giờ Cạn',
    reference: '1 Côrintô 13:4-8',
    poem: 'Đức mến khoan dung, hiền hậu chẳng ghen tương\nTha thứ hết và cậy trông suốt dặm trường\nNơi nào có tình yêu thương chân thật ấy\nThiên Chúa hiện diện chúc phúc khắp bốn phương.',
    meaning: 'Gia đình và tình cảm đôi lứa ngập tràn hạnh phúc. Sự thấu hiểu và yêu thương mang lại phúc lộc bền vững cho cả mái ấm.',
    ttsSummary: 'Lộc Thánh số 15, Phúc Lộc Trường Tồn, Thư Thánh Phaolô. Tình yêu chân thật và lòng bao dung mang lại hồng phúc viên mãn cho gia đình bạn.'
  },
  {
    number: 21,
    rank: 'Hồng Ân Thượng Đẳng',
    title: 'Đôi Cánh Đại Bàng — Sức Mạnh Mới Từ Trời Cao',
    reference: 'Isaia 40:31',
    poem: 'Ai cậy trông Chúa sẽ thêm sức mạnh phi thường\nTung cánh đại bàng vượt gió bão ngàn phương\nChạy không mỏi và bước đi không biết mệt\nSức khỏe dồi dào vạn dặm sáng vầng dương.',
    meaning: 'Sức khỏe thể chất và tinh thần được phục hồi mạnh mẽ. Mọi dự án lớn đều đủ nghị lực và quý nhân đồng hành vượt đích.',
    ttsSummary: 'Lộc Thánh số 21, Hồng Ân Thượng Đẳng, Sách Tiên Tri Isaia. Ai cậy trông vào Chúa sẽ được thêm sức mạnh mới như chim bằng tung cánh.'
  },
  {
    number: 33,
    rank: 'Đại Hồng Phúc',
    title: 'Hồng Ân Chúa Che Chở Đêm Ngày',
    reference: 'Thánh Vịnh 121:7-8',
    poem: 'Chúa giữ gìn bạn khỏi mọi nỗi gian nguy\nCanh giấc tâm hồn trên vạn nẻo đường đi\nLúc ra đi cũng như khi quay trở lại\nTừ giờ này đến muôn thuở chẳng lo chi.',
    meaning: 'Đi xa thượng lộ bình an, làm ăn buôn bán gặp nhiều may mắn, được Thiên Thần Bản Mệnh gìn giữ đêm ngày.',
    ttsSummary: 'Lộc Thánh số 33, Đại Hồng Phúc, Thánh Vịnh 121. Chúa sẽ phù hộ bạn lúc ra đi cũng như lúc trở về, từ giờ này cho đến muôn đời.'
  }
];

const DEFAULT_CHURCH_STATE = {
  totalCandles: 120,
  totalGrace: 1200,
  rosaryBeads: 500,
  bellRings: 33,
  doveCount: 24,
  blessingCount: 15,
  activeCandles: 12,
  haloIntensity: 0.5,
  offerings: {
    lily: 3,
    breadWine: 2,
    chalice: 2,
    archangel: 1
  },
  parishioners: {},
  recentEvents: [],
  settings: {
    ttsEnabled: true,
    ttsVoice: 'maichi',
    scriptureEnabled: true,
    scriptureVoice: 'huuduc',
    scriptureVolume: 0.90,
    activeScriptureId: 'kinh_hoa_binh',
    massAutoSchedule: true,
    massScheduleHours: [5, 6, 7, 12, 17, 18, 19, 20, 21, 22],
    bgMusicEnabled: true,
    sfxEnabled: true,
    autoGentleReply: true,
    autoSim: false,
    autoSimIntervalMs: 9500
  },
  tiktok: {
    connected: false,
    connecting: false,
    username: '',
    roomId: null,
    viewerCount: 0,
    lastError: null
  }
};

function loadChurchState() {
  try {
    if (fs.existsSync(CHURCH_STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CHURCH_STATE_FILE, 'utf8'));
      return {
        ...DEFAULT_CHURCH_STATE,
        ...saved,
        parishioners: saved.parishioners || {},
        offerings: { ...DEFAULT_CHURCH_STATE.offerings, ...(saved.offerings || {}) },
        settings: { ...DEFAULT_CHURCH_STATE.settings, ...(saved.settings || {}) },
        tiktok: { ...DEFAULT_CHURCH_STATE.tiktok, ...(saved.tiktok || {}), connected: false, connecting: false }
      };
    }
  } catch (e) {
    console.warn('[ChurchState] Không đọc được church-state.json, dùng mặc định:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CHURCH_STATE));
}

let churchState = loadChurchState();
let saveChurchTimer = null;

function saveChurchState() {
  clearTimeout(saveChurchTimer);
  saveChurchTimer = setTimeout(() => {
    const toSave = {
      totalCandles: churchState.totalCandles,
      totalGrace: churchState.totalGrace,
      rosaryBeads: churchState.rosaryBeads,
      bellRings: churchState.bellRings,
      doveCount: churchState.doveCount,
      blessingCount: churchState.blessingCount,
      activeCandles: churchState.activeCandles,
      offerings: churchState.offerings,
      parishioners: churchState.parishioners,
      settings: churchState.settings,
      tiktok: {
        username: churchState.tiktok?.username || ''
      }
    };
    fs.promises.writeFile(CHURCH_STATE_FILE, JSON.stringify(toSave, null, 2), 'utf8').catch((e) => {
      console.error('[ChurchState] Lỗi lưu file:', e.message);
    });
  }, 1200);
}

function sanitizeParishionerName(rawName) {
  const cleaned = sanitizeUserName(rawName);
  return cleaned === 'Thí Chủ Hữu Duyên' ? 'Tín Hữu Tâm Thành' : cleaned;
}

function scrubPersistedStates() {
  let templeModified = false;
  if (state.devotees && typeof state.devotees === 'object') {
    for (const [k, dev] of Object.entries(state.devotees)) {
      if (!dev) continue;
      const cleanName = sanitizeUserName(dev.name || k);
      if (dev.name !== cleanName) {
        dev.name = cleanName;
        templeModified = true;
      }
      if (dev.lastWish && isBlockedSpamOrToxic(dev.lastWish)) {
        dev.lastWish = 'Nam Mô A Di Đà Phật, cầu bình an cát tường';
        templeModified = true;
      }
    }
  }
  if (Array.isArray(state.recentEvents)) {
    const beforeLen = state.recentEvents.length;
    state.recentEvents = state.recentEvents.filter((ev) => {
      if (!ev) return false;
      if (ev.wish && isBlockedSpamOrToxic(ev.wish)) return false;
      ev.user = sanitizeUserName(ev.user);
      return true;
    });
    if (state.recentEvents.length !== beforeLen) templeModified = true;
  }
  if (templeModified) saveState();

  let churchModified = false;
  if (churchState.parishioners && typeof churchState.parishioners === 'object') {
    for (const [k, p] of Object.entries(churchState.parishioners)) {
      if (!p) continue;
      const cleanName = sanitizeParishionerName(p.name || k);
      if (p.name !== cleanName) {
        p.name = cleanName;
        churchModified = true;
      }
      if (p.lastWish && isBlockedSpamOrToxic(p.lastWish)) {
        p.lastWish = 'Đã vào Thánh Đường hiệp thông';
        churchModified = true;
      }
    }
  }
  if (Array.isArray(churchState.recentEvents)) {
    const beforeLen = churchState.recentEvents.length;
    churchState.recentEvents = churchState.recentEvents.filter((ev) => {
      if (!ev) return false;
      if (ev.wish && isBlockedSpamOrToxic(ev.wish)) return false;
      ev.user = sanitizeParishionerName(ev.user);
      return true;
    });
    if (churchState.recentEvents.length !== beforeLen) churchModified = true;
  }
  if (churchModified) saveChurchState();
}
scrubPersistedStates();

function recordParishioner(user, uniqueId, avatar, graceDelta, candleDelta = 0, giftDelta = 0, wish = '', gender = null) {
  const displayName = sanitizeParishionerName(user || uniqueId);
  const cleanWish = sanitizeWishText(wish);
  const resolvedGender = gender || detectViewerGender(displayName, uniqueId);
  const safeUniqueId = isBlockedName(uniqueId) ? '' : String(uniqueId || '').trim();
  const key = (safeUniqueId || displayName).slice(0, 40);
  if (!churchState.parishioners[key]) {
    churchState.parishioners[key] = {
      name: displayName,
      uniqueId: safeUniqueId || displayName.toLowerCase().replace(/\s+/g, ''),
      avatar: avatar || '',
      gender: resolvedGender,
      grace: 0,
      candles: 0,
      gifts: 0,
      lastWish: '',
      lastActiveAt: 0
    };
  }
  const p = churchState.parishioners[key];
  p.name = displayName;
  if (avatar) p.avatar = avatar;
  p.gender = gender || p.gender || resolvedGender;
  p.grace += graceDelta;
  p.candles += candleDelta;
  p.gifts += giftDelta;
  p.lastActiveAt = Date.now();
  if (cleanWish) p.lastWish = cleanWish;

  churchState.totalGrace += graceDelta;
  churchState.haloIntensity = Math.min(1.0, 0.4 + (churchState.totalGrace % 1000) / 1400);
  return p;
}

function getChurchLeaderboard(limit = 48) {
  return Object.values(churchState.parishioners)
    .sort((a, b) => b.grace - a.grace)
    .slice(0, limit)
    .map((p, index) => ({
      rank: index + 1,
      name: p.name,
      uniqueId: p.uniqueId,
      avatar: p.avatar || '',
      gender: p.gender || detectViewerGender(p.name, p.uniqueId),
      grace: p.grace,
      merit: p.grace,
      candles: p.candles || 0,
      gifts: p.gifts || 0,
      lastWish: p.lastWish || '',
      lastActiveAt: p.lastActiveAt || 0
    }));
}

let currentChurchSessionStart = Date.now();

function getChurchPewViewers(topVipCount = 8, seatLimit = 40) {
  const allByGrace = Object.values(churchState.parishioners).sort((a, b) => b.grace - a.grace);
  const vipIds = new Set(allByGrace.slice(0, topVipCount).map((p) => p.uniqueId || p.name));
  // KHÔNG LÀM SẴN: Chỉ hiển thị những tín hữu thực sự bước vào phòng / tương tác trong phiên hiện tại!
  const candidates = allByGrace.filter(
    (p) => !vipIds.has(p.uniqueId || p.name) && (p.lastActiveAt || 0) >= currentChurchSessionStart
  );
  candidates.sort((a, b) => {
    const tA = a.lastActiveAt || 0;
    const tB = b.lastActiveAt || 0;
    if (tA !== tB) return tB - tA;
    return b.grace - a.grace;
  });
  return candidates.slice(0, seatLimit).map((p, idx) => ({
    seatNumber: idx + 1,
    name: p.name,
    uniqueId: p.uniqueId,
    avatar: p.avatar || '',
    gender: p.gender || detectViewerGender(p.name, p.uniqueId),
    grace: p.grace,
    gifts: p.gifts || 0,
    lastWish: p.lastWish || '',
    lastActiveAt: p.lastActiveAt || 0
  }));
}

function pushChurchEventLog(evt) {
  const entry = {
    id: `cevt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...evt
  };
  churchState.recentEvents.unshift(entry);
  if (churchState.recentEvents.length > 35) {
    churchState.recentEvents.length = 35;
  }
  return entry;
}

function getChurchPublicState() {
  return {
    totalCandles: churchState.totalCandles,
    totalGrace: churchState.totalGrace,
    rosaryBeads: churchState.rosaryBeads,
    bellRings: churchState.bellRings,
    doveCount: churchState.doveCount,
    blessingCount: churchState.blessingCount,
    activeCandles: churchState.activeCandles,
    haloIntensity: churchState.haloIntensity,
    offerings: churchState.offerings,
    leaderboard: getChurchLeaderboard(48),
    pewViewers: getChurchPewViewers(8, 40),
    recentEvents: churchState.recentEvents.slice(0, 25),
    settings: churchState.settings,
    tiktok: churchState.tiktok,
    tts: zeroTts ? zeroTts.getStatus() : { ready: false, status: 'init', voice: 'maichi' }
  };
}

const ChurchRituals = {
  lightCandle(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 3));
    const wish = sanitizeWishText(params.wish) || 'Lạy Chúa Giêsu, con tín thác vào Chúa. Xin chúc lành cho gia đình con';
    const grace = count * 5;

    churchState.totalCandles += count;
    churchState.activeCandles = Math.min(36, churchState.activeCandles + count);
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, count, 0, wish, params.gender);

    const suggestedTts = `Tạ ơn Chúa. Cảm tạ tín hữu ${parishioner.name} đã dâng nến cầu nguyện: ${wish}. Amen.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: 'lightCandle',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      gender: parishioner.gender,
      count,
      grace,
      merit: grace,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  prayRosary(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(50, Number(params.count) || 1));
    const grace = count;

    churchState.rosaryBeads += count;
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, 0, 0, '', params.gender);
    const suggestedTts = `Cảm tạ tín hữu ${parishioner.name} đã hiệp thông lần hạt Mân Côi kính Đức Mẹ. Amen.`;

    const event = pushChurchEventLog({
      type: 'prayRosary',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      gender: parishioner.gender,
      count,
      grace,
      merit: grace,
      suggestedTts,
      ttsText: params.forceTts ? suggestedTts : ''
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  ringChurchBell(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const count = Math.max(1, Math.min(9, Number(params.count) || 1));
    const wish = sanitizeWishText(params.wish) || 'Ngân vang Chuông Thánh Đường, cầu xin hồng ân Thiên Chúa tuôn đổ trên muôn người';
    const grace = count * 10;

    churchState.bellRings += count;
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, 0, 0, wish, params.gender);

    const suggestedTts = `Tín hữu ${parishioner.name} ngân vang Chuông Thánh Đường hiệp ý cầu nguyện: ${wish}. Amen.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: 'ringChurchBell',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      gender: parishioner.gender,
      count,
      grace,
      merit: grace,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  sendPrayer(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const wish = sanitizeWishText(params.wish) || 'Xin Chúa chúc lành cho cha mẹ và gia đình luôn mạnh khỏe, bình an hạnh phúc';
    const grace = 10;

    churchState.doveCount += 1;
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, 1, 0, wish, params.gender);

    const suggestedTts = `Ý nguyện của tín hữu ${parishioner.name} dâng lên Chúa: ${wish}. Nguyện xin Chúa nhận lời và chúc lành. Amen.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: 'sendPrayer',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      gender: parishioner.gender,
      wish,
      grace,
      merit: grace,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  offerGift(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const coins = Math.max(1, Number(params.coins) || 10);
    const giftType = ['lily', 'breadWine', 'chalice', 'archangel'].includes(params.giftType)
      ? params.giftType
      : (coins >= 100 ? 'archangel' : coins >= 20 ? 'breadWine' : coins >= 5 ? 'chalice' : 'lily');

    const giftLabels = {
      lily: 'Bó Hoa Huệ Trắng Tinh Khôi',
      breadWine: 'Lễ Vật Bánh Rượu Thánh Thể',
      chalice: 'Chén Thánh Vàng Cung Hiến',
      archangel: 'Đại Lễ Ánh Sáng Phục Sinh & Phép Lành Trọng Thể'
    };
    const giftName = params.giftName || giftLabels[giftType];
    const multiplier = coins >= 100 ? 50 : coins >= 10 ? 30 : 20;
    const grace = Math.max(20, coins * multiplier);

    churchState.offerings[giftType] = (churchState.offerings[giftType] || 0) + 1;
    churchState.totalCandles += 3;
    churchState.activeCandles = Math.min(36, churchState.activeCandles + 3);

    const wish = params.wish || `Thành tâm tiến dâng ${giftName} lên Bàn Thờ Chúa`;
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, 3, 1, wish, params.gender);

    const suggestedTts = `Tạ ơn Chúa! Cảm tạ ân nhân ${parishioner.name} đã quảng đại tiến dâng ${giftName}. Nguyện xin Thiên Chúa chúc lành cho gia đình. Amen.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: giftType === 'archangel' ? 'grandBlessing' : 'offerGift',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      gender: parishioner.gender,
      giftType,
      giftName,
      coins,
      grace,
      merit: grace,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  drawBibleBlessing(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const topic = sanitizeWishText(params.topic) || 'Gia đình, Sự nghiệp và Bình an trong tay Chúa';
    const blessing = BIBLE_BLESSING_DECK[Math.floor(Math.random() * BIBLE_BLESSING_DECK.length)];
    const grace = 10;

    churchState.blessingCount += 1;
    const parishioner = recordParishioner(
      user,
      uniqueId,
      avatar,
      grace,
      0,
      0,
      `Lộc Thánh số ${blessing.number}: ${blessing.reference}`
    );

    const suggestedTts = `Tín hữu ${parishioner.name} vừa nhận được ${blessing.ttsSummary}`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: 'drawBibleBlessing',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      topic,
      blessing,
      grace,
      merit: grace,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  grandBlessing(params = {}) {
    return this.offerGift({
      ...params,
      giftType: 'archangel',
      coins: Math.max(100, Number(params.coins) || 199),
      giftName: params.giftName || 'Đại Lễ Ánh Sáng Phục Sinh & Phép Lành Trọng Thể'
    });
  },

  requestScripture(params = {}) {
    const user = sanitizeParishionerName(params.user);
    const uniqueId = params.uniqueId || '';
    const avatar = params.avatar || '';
    const requestedId = String(params.scriptureId || '').trim();
    const scripture =
      SCRIPTURE_DECK.find((s) => s.id === requestedId) ||
      SCRIPTURE_DECK[Math.floor(Math.random() * SCRIPTURE_DECK.length)];
    const grace = 15;

    churchState.settings.scriptureEnabled = true;
    churchState.settings.activeScriptureId = scripture.id;

    const wish = sanitizeWishText(params.wish) || `Hiệp ý lắng nghe Lời Chúa: ${scripture.shortTitle}`;
    const parishioner = recordParishioner(user, uniqueId, avatar, grace, 0, 0, wish);

    const suggestedTts = `Tín hữu ${parishioner.name} thành tâm thỉnh bài đọc ${scripture.shortTitle}.`;
    const ttsText = params.forceTts ? suggestedTts : '';

    const event = pushChurchEventLog({
      type: 'requestScripture',
      user: parishioner.name,
      uniqueId: parishioner.uniqueId,
      avatar: parishioner.avatar,
      scriptureId: scripture.id,
      scriptureTitle: scripture.title,
      scriptureShortTitle: scripture.shortTitle,
      grace,
      merit: grace,
      wish,
      suggestedTts,
      ttsText,
      ttsVoice: churchState.settings.ttsVoice || 'maichi'
    });

    saveChurchState();
    broadcastNotification('church.event', { event, state: getChurchPublicState() });
    return { event, state: getChurchPublicState() };
  },

  controlScripture(params = {}) {
    if (typeof params.enabled === 'boolean') {
      churchState.settings.scriptureEnabled = params.enabled;
    }
    if (params.voice) {
      churchState.settings.scriptureVoice = String(params.voice).trim().toLowerCase();
    }
    if (typeof params.volume === 'number') {
      churchState.settings.scriptureVolume = Math.max(0, Math.min(1, Number(params.volume)));
    }
    if (params.scriptureId) {
      const found = SCRIPTURE_DECK.find((s) => s.id === params.scriptureId);
      if (found) {
        churchState.settings.activeScriptureId = found.id;
      }
    }
    saveChurchState();
    broadcastNotification('church.scriptureControl', {
      action: params.action || 'sync',
      scriptureId: churchState.settings.activeScriptureId,
      verseIndex: params.verseIndex,
      enabled: churchState.settings.scriptureEnabled,
      voice: churchState.settings.scriptureVoice,
      volume: churchState.settings.scriptureVolume
    });
    broadcastNotification('church.state', getChurchPublicState());
    return getChurchPublicState();
  },

  massControl(params = {}) {
    if (typeof params.massAutoSchedule === 'boolean') {
      churchState.settings.massAutoSchedule = params.massAutoSchedule;
    }
    if (Array.isArray(params.massScheduleHours)) {
      const validHours = params.massScheduleHours
        .map((h) => Number(h))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
      if (validHours.length > 0) {
        churchState.settings.massScheduleHours = Array.from(new Set(validHours)).sort((a, b) => a - b);
      }
    }
    saveChurchState();
    const payload = {
      action: params.action || 'sync',
      partIndex: typeof params.partIndex === 'number' ? params.partIndex : undefined,
      stepIndex: typeof params.stepIndex === 'number' ? params.stepIndex : undefined,
      massAutoSchedule: churchState.settings.massAutoSchedule !== false,
      massScheduleHours: Array.isArray(churchState.settings.massScheduleHours)
        ? churchState.settings.massScheduleHours
        : [5, 6, 7, 12, 17, 18, 19, 20, 21, 22]
    };
    broadcastNotification('church.massControl', payload);
    broadcastNotification('church.state', getChurchPublicState());
    return getChurchPublicState();
  },

  updateSettings(params = {}) {
    churchState.settings = {
      ...churchState.settings,
      ...params
    };
    if (typeof params.autoSim === 'boolean') {
      configureChurchAutoSim(params.autoSim);
    }
    saveChurchState();
    broadcastNotification('church.state', getChurchPublicState());
    return getChurchPublicState();
  },

  resetGrace() {
    churchState.totalCandles = 128;
    churchState.totalGrace = 1420;
    churchState.rosaryBeads = 500;
    churchState.bellRings = 33;
    churchState.doveCount = 24;
    churchState.blessingCount = 15;
    churchState.activeCandles = 12;
    churchState.offerings = { lily: 3, breadWine: 2, chalice: 2, archangel: 1 };
    churchState.parishioners = {
      'giuse.quan': {
        name: 'Giuse Trần Minh Quân',
        uniqueId: 'giuse.quan',
        avatar: '',
        grace: 360,
        candles: 18,
        gifts: 2,
        lastWish: 'Lạy Chúa Giêsu, con tín thác vào Chúa'
      },
      'maria.thao98': {
        name: 'Maria Nguyễn Thảo',
        uniqueId: 'maria.thao98',
        avatar: '',
        grace: 310,
        candles: 15,
        gifts: 2,
        lastWish: 'Tạ ơn Chúa và Mẹ Maria vì muôn hồng ân'
      },
      'anna.linh99': {
        name: 'Anna Lê Phương Linh',
        uniqueId: 'anna.linh99',
        avatar: '',
        grace: 240,
        candles: 12,
        gifts: 1,
        lastWish: 'Xin phó dâng gia đình trong Trái Tim Chúa Giêsu'
      },
      'phaolo.nam': {
        name: 'Phaolô Hoàng Nam',
        uniqueId: 'phaolo.nam',
        avatar: '',
        grace: 195,
        candles: 9,
        gifts: 1,
        lastWish: 'Xin ơn Đức Tin, Đức Cậy và Đức Mến'
      },
      'teresa.ha': {
        name: 'Têrêsa Phạm Thanh Hà',
        uniqueId: 'teresa.ha',
        avatar: '',
        grace: 165,
        candles: 6,
        gifts: 1,
        lastWish: 'Nguyện xin Thánh Gia Thất chở che mái ấm'
      },
      'phero.thinh88': {
        name: 'Phêrô Vũ Đức Thịnh',
        uniqueId: 'phero.thinh88',
        avatar: '',
        grace: 150,
        candles: 6,
        gifts: 0,
        lastWish: 'Lời Chúa là ngọn đèn soi cho bước chân con'
      }
    };
    churchState.recentEvents = [];
    saveChurchState();
    broadcastNotification('church.state', getChurchPublicState());
    return getChurchPublicState();
  }
};

const churchCommentCooldownMap = new Map();

async function triggerChurchGentleReminder(force = false) {
  if (!force) {
    if (churchState.settings?.autoGentleReply === false) {
      return { ok: false, triggered: false, reason: 'disabled' };
    }
    const now = Date.now();
    if (now - lastChurchGentleReplyAt < GENTLE_REMINDER_COOLDOWN_MS) {
      return { ok: false, triggered: false, reason: 'cooldown' };
    }
    lastChurchGentleReplyAt = now;
  } else {
    lastChurchGentleReplyAt = Date.now();
  }
  const text = CHURCH_GENTLE_REMINDERS[churchGentleReplyCursor++ % CHURCH_GENTLE_REMINDERS.length];
  const res = await zeroTts.synthesize(text, 'kimoanh', 'high');
  if (res.ok && res.url) {
    broadcastNotification('church.gentleReminder', {
      text,
      voice: 'kimoanh',
      url: res.url
    });
  }
  return {
    ok: Boolean(res.ok),
    triggered: Boolean(res.ok),
    text,
    voice: 'kimoanh',
    url: res.url || '',
    autoGentleReply: churchState.settings?.autoGentleReply !== false
  };
}

function parseChurchViewerComment(commentText, user, uniqueId, avatar) {
  const raw = String(commentText || '').trim();
  if (!raw) return null;
  if (isBlockedSpamOrToxic(raw)) {
    console.log(`[Bộ Lọc Tịnh Tâm] Đã chặn bình luận không phù hợp từ ${user || uniqueId || 'ẩn danh'}: "${raw}"`);
    triggerChurchGentleReminder(false).catch(() => {});
    return null;
  }

  const cleanWish = sanitizeWishText(raw);
  if (!cleanWish || cleanWish.length < 3) return null;

  const userKey = uniqueId || user || '';
  const now = Date.now();
  if (userKey) {
    const lastTs = churchCommentCooldownMap.get(userKey) || 0;
    if (now - lastTs < 3500) return null;
    churchCommentCooldownMap.set(userKey, now);
    if (churchCommentCooldownMap.size > 600) {
      const oldestKey = churchCommentCooldownMap.keys().next().value;
      churchCommentCooldownMap.delete(oldestKey);
    }
  }

  const cleanUser = sanitizeParishionerName(user);
  const lower = cleanWish.toLowerCase();

  // 1. Hái Lộc Thánh / Rút Câu Lời Chúa
  if (
    lower.includes('lộc thánh') ||
    lower.includes('loc thanh') ||
    lower.includes('hái lộc') ||
    lower.includes('hai loc') ||
    lower.includes('câu gốc') ||
    lower.includes('cau goc') ||
    lower.includes('xin lộc') ||
    lower.includes('gieo quẻ') ||
    lower.includes('xin xăm')
  ) {
    return ChurchRituals.drawBibleBlessing({ user: cleanUser, uniqueId, avatar, topic: cleanWish });
  }

  // 2. Ngân Chuông Thánh Đường
  if (lower.includes('chuông') || lower.includes('chuong')) {
    return ChurchRituals.ringChurchBell({ user: cleanUser, uniqueId, avatar, count: 1, wish: cleanWish, readTts: true });
  }

  // 3. Lần Hạt Mân Côi
  if (
    lower.includes('mân côi') ||
    lower.includes('man coi') ||
    lower.includes('lần hạt') ||
    lower.includes('lan hat') ||
    lower.includes('kính mừng') ||
    lower.includes('kinh mung')
  ) {
    return ChurchRituals.prayRosary({ user: cleanUser, uniqueId, avatar, count: 5 });
  }

  // 5. Thắp Nến Cầu Nguyện
  if (
    lower.includes('thắp nến') ||
    lower.includes('thap nen') ||
    lower.includes('dâng nến') ||
    lower.includes('dang nen') ||
    lower.includes('nến') ||
    lower.includes('tạ ơn') ||
    lower.includes('ta on')
  ) {
    return ChurchRituals.lightCandle({ user: cleanUser, uniqueId, avatar, count: 3, wish: cleanWish });
  }

  // 6. Cầu Nguyện / Thả Bồ Câu Trắng (Whitelist nghiêm ngặt chỉ nhận lời cầu nguyện / tạ ơn Chúa trang nghiêm)
  const CHURCH_PRAYER_WHITELIST = [
    'cầu', 'cau ', 'nguyện', 'nguyen', 'xin', 'chúa', 'chua', 'giêsu', 'giesu', 'jesus',
    'mẹ maria', 'đức mẹ', 'duc me', 'maria', 'thánh', 'thanh ', 'giuse', 'amen',
    'alleluia', 'haleluia', 'hallelujah', 'bình an', 'binh an', 'sức khỏe', 'suc khoe',
    'gia đình', 'gia dinh', 'cha mẹ', 'bố mẹ', 'ba má', 'ông bà', 'con cái', 'chúc lành', 'chuc lanh',
    'thương xót', 'thuong xot', 'phù hộ', 'phu ho', 'che chở', 'che cho', 'chở che',
    'hồng ân', 'hong an', 'cảm tạ', 'cam ta', 'ngợi khen', 'ngoi khen', 'vinh danh',
    'tín thác', 'tin thac', 'hiệp thông', 'hiep thong', 'lạy', 'kính', 'dâng', 'chúc'
  ];
  if (CHURCH_PRAYER_WHITELIST.some((kw) => lower.includes(kw))) {
    return ChurchRituals.sendPrayer({ user: cleanUser, uniqueId, avatar, wish: cleanWish });
  }

  // Bỏ qua mọi bình luận tán gẫu ngẫu nhiên không nằm trong danh mục cầu nguyện để giữ màn hình trang nghiêm
  return null;
}

let churchAutoSimTimer = null;
let churchAutoSimCursor = 0;
const SIM_PARISHIONERS = [
  { user: 'Maria Nguyễn Thảo', uniqueId: 'maria.thao98', wish: 'Tạ ơn Chúa và Mẹ Maria vì muôn hồng ân Chúa đã thương ban cho gia đình con' },
  { user: 'Giuse Trần Minh Quân', uniqueId: 'giuse.quan', wish: 'Lạy Chúa Giêsu, con tín thác vào Chúa. Xin chúc lành cho công việc của chúng con' },
  { user: 'Anna Lê Phương Linh', uniqueId: 'anna.linh99', wish: 'Nguyện xin Thánh Tâm Chúa Giêsu và Mẹ Maria chở che gia đình con' },
  { user: 'Phaolô Hoàng Nam', uniqueId: 'phaolo.nam', wish: 'Con xin dâng ngọn nến phụng vụ tạ ơn Thiên Chúa Toàn Năng' },
  { user: 'Têrêsa Phạm Thanh Hà', uniqueId: 'teresa.ha', wish: 'Xin Chúa ban ơn khôn ngoan và thánh đức cho các con trong gia đình' },
  { user: 'Phêrô Vũ Đức Thịnh', uniqueId: 'phero.thinh88', wish: 'Lời Chúa là ngọn đèn soi cho bước chân con và là ánh sáng chỉ đường' },
  { user: 'Monica Khánh Vy', uniqueId: 'monica.vy', wish: 'Xin Chúa thương xót, nâng đỡ và chữa lành mọi tâm hồn đang mỏi mệt' },
  { user: 'Gioan Đặng Quốc Bảo', uniqueId: 'gioan.bao', wish: 'Lạy Chúa, xin dùng con như khí cụ tình thương và ơn cứu độ của Chúa' },
  { user: 'Cecilia Mỹ Duyên', uniqueId: 'cecilia.duyen', wish: 'Cầu xin Thánh Gia Thất giữ gìn gia đình con luôn hiệp nhất yêu thương' },
  { user: 'Antôn Đỗ Minh Trí', uniqueId: 'anton.tri', wish: 'Con xin ngân chuông Thánh Đường hiệp thông cầu nguyện cùng cộng đoàn' }
];

function runSingleChurchSimStep() {
  const pick = SIM_PARISHIONERS[churchAutoSimCursor % SIM_PARISHIONERS.length];
  churchAutoSimCursor++;
  const roll = Math.random();
  if (roll < 0.32) {
    ChurchRituals.lightCandle({ user: pick.user, uniqueId: pick.uniqueId, count: 3, wish: pick.wish });
  } else if (roll < 0.56) {
    ChurchRituals.sendPrayer({ user: pick.user, uniqueId: pick.uniqueId, wish: pick.wish });
  } else if (roll < 0.76) {
    ChurchRituals.drawBibleBlessing({ user: pick.user, uniqueId: pick.uniqueId, topic: pick.wish });
  } else if (roll < 0.90) {
    ChurchRituals.offerGift({ user: pick.user, uniqueId: pick.uniqueId, giftType: 'lily', coins: 15, giftName: 'Bó Hoa Huệ Trắng Tinh Khôi' });
  } else {
    ChurchRituals.ringChurchBell({ user: pick.user, uniqueId: pick.uniqueId, count: 1, wish: pick.wish, readTts: true });
  }
}

function configureChurchAutoSim(enabled) {
  churchState.settings.autoSim = Boolean(enabled);
  if (churchAutoSimTimer) {
    clearInterval(churchAutoSimTimer);
    churchAutoSimTimer = null;
  }
  if (churchState.settings.autoSim) {
    runSingleChurchSimStep();
    churchAutoSimTimer = setInterval(runSingleChurchSimStep, Math.max(16000, churchState.settings.autoSimIntervalMs || 18000));
  }
}

let churchTiktokConn = null;
const churchGiftComboTracker = new Map();

async function connectChurchTikTokLive(usernameOrUrl) {
  const cleanUser = await resolveTikTokUsername(usernameOrUrl);
  if (!cleanUser) {
    throw new Error('Không tìm thấy @username hợp lệ từ dữ liệu nhập vào');
  }

  if (churchTiktokConn) {
    try {
      await churchTiktokConn.disconnect();
    } catch (_) {}
    churchTiktokConn = null;
  }

  churchState.tiktok = {
    connected: false,
    connecting: true,
    username: cleanUser,
    roomId: null,
    viewerCount: 0,
    lastError: null
  };
  saveChurchState();
  broadcastNotification('church.state', getChurchPublicState());

  churchTiktokConn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });

  churchTiktokConn.on(ControlEvent.CONNECTED, (roomState) => {
    churchState.tiktok.connected = true;
    churchState.tiktok.connecting = false;
    churchState.tiktok.roomId = roomState?.roomId || churchTiktokConn?.roomId || null;
    churchState.tiktok.lastError = null;
    console.log(`[TikTok Live - Nhà Thờ] Đã kết nối phòng @${cleanUser} (roomId: ${churchState.tiktok.roomId})`);
    broadcastNotification('church.state', getChurchPublicState());
  });

  churchTiktokConn.on(ControlEvent.DISCONNECTED, () => {
    churchState.tiktok.connected = false;
    churchState.tiktok.connecting = false;
    console.log(`[TikTok Live - Nhà Thờ] Đã ngắt kết nối @${cleanUser}`);
    broadcastNotification('church.state', getChurchPublicState());
  });

  churchTiktokConn.on(ControlEvent.ERROR, (err) => {
    churchState.tiktok.lastError = err?.message || String(err);
    console.warn('[TikTok Live - Nhà Thờ Warning]', churchState.tiktok.lastError);
    broadcastNotification('church.state', getChurchPublicState());
  });

  churchTiktokConn.on(WebcastEvent.ROOM_USER, (data) => {
    const viewerCount = Number(data?.total ?? data?.viewerCount ?? 0);
    if (viewerCount > 0) {
      churchState.tiktok.viewerCount = viewerCount;
      broadcastNotification('church.viewerCount', { viewerCount });
    }
  });

  let lastChurchMemberWalkTs = 0;
  churchTiktokConn.on(WebcastEvent.MEMBER, (data) => {
    const { user, uniqueId, avatar, gender } = extractUserFromEvent(data);
    const now = Date.now();
    if (now - lastChurchMemberWalkTs >= 3200) {
      lastChurchMemberWalkTs = now;
      ChurchRituals.lightCandle({
        user,
        uniqueId,
        avatar,
        gender,
        count: 1,
        wish: 'Đã bước vào Thánh Đường dâng nến cầu bình an',
        readTts: false
      });
    } else {
      recordParishioner(user, uniqueId, avatar, 1, 0, 0, 'Đã vào Thánh Đường hiệp thông', gender);
      broadcastNotification('church.state', getChurchPublicState());
    }
  });

  churchTiktokConn.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar, gender } = extractUserFromEvent(data);
    const commentText = data?.content || data?.comment || '';
    console.log(`[TikTok Chat - Nhà Thờ] ${user}: ${commentText}`);
    parseChurchViewerComment(commentText, user, uniqueId, avatar, gender);
  });

  churchTiktokConn.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar, gender } = extractUserFromEvent(data);
    const likeCount = Math.min(15, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    ChurchRituals.prayRosary({ user, uniqueId, avatar, gender, count: likeCount });
  });

  const handleChurchSocialEvent = (data) => {
    const { user, uniqueId, avatar, gender } = extractUserFromEvent(data);
    ChurchRituals.ringChurchBell({
      user,
      uniqueId,
      avatar,
      gender,
      count: 1,
      wish: 'Hiệp thông nơi Thánh Đường, nguyện xin Chúa chúc lành',
      readTts: false
    });
  };
  churchTiktokConn.on(WebcastEvent.FOLLOW, handleChurchSocialEvent);
  churchTiktokConn.on(WebcastEvent.SHARE, handleChurchSocialEvent);
  churchTiktokConn.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(data?.common?.displayText?.displayType || data?.displayType || '').toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      handleChurchSocialEvent(data);
    }
  });

  churchTiktokConn.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar, gender } = extractUserFromEvent(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    const prevCount = churchGiftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount && data?.repeatEnd) {
      churchGiftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = Math.max(1, repeatCount - prevCount);
    churchGiftComboTracker.set(groupId, repeatCount);
    if (churchGiftComboTracker.size > 500) {
      const firstKey = churchGiftComboTracker.keys().next().value;
      churchGiftComboTracker.delete(firstKey);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Huệ Tâm Thành';
    const displayGiftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`[TikTok Gift - Nhà Thờ] ${user} gửi ${displayGiftName} (${totalCoins} xu)`);

    ChurchRituals.offerGift({
      user,
      uniqueId,
      avatar,
      gender,
      coins: totalCoins,
      giftName: displayGiftName,
      wish: `Thành tâm tiến dâng ${displayGiftName} lên Bàn Thờ Chúa`
    });
  });

  try {
    const roomState = await churchTiktokConn.connect();
    churchState.tiktok.connected = true;
    churchState.tiktok.connecting = false;
    churchState.tiktok.roomId = roomState?.roomId || churchTiktokConn?.roomId || null;
    broadcastNotification('church.state', getChurchPublicState());
    return churchState.tiktok;
  } catch (err) {
    churchState.tiktok.connected = false;
    churchState.tiktok.connecting = false;
    churchState.tiktok.lastError = err?.message || 'Không thể kết nối phòng Live (kiểm tra tài khoản đang phát Live chưa)';
    broadcastNotification('church.state', getChurchPublicState());
    throw new Error(churchState.tiktok.lastError);
  }
}

function disconnectChurchTikTokLive() {
  if (churchTiktokConn) {
    try {
      churchTiktokConn.disconnect();
    } catch (_) {}
    churchTiktokConn = null;
  }
  churchState.tiktok.connected = false;
  churchState.tiktok.connecting = false;
  churchState.tiktok.viewerCount = 0;
  broadcastNotification('church.state', getChurchPublicState());
  return churchState.tiktok;
}

// ============================================================================
// 7. JSON-RPC 2.0 DISPATCHER (HỖ TRỢ ĐỘC LẬP SONG SONG TEMPLE.* & CHURCH.*)
// ============================================================================
async function handleRpcCall(method, params = {}) {
  switch (method) {
    // --- WORKFLOW 1: ĐI CHÙA (CHÁNH ĐIỆN ĐỨC PHẬT A DI ĐÀ) ---
    case 'temple.getState':
      return getPublicState();
    case 'temple.burnIncense':
      return Rituals.burnIncense(params);
    case 'temple.strikeWoodenFish':
      return Rituals.strikeWoodenFish(params);
    case 'temple.ringBell':
      return Rituals.ringBell(params);
    case 'temple.sendPrayer':
      return Rituals.sendPrayer(params);
    case 'temple.offerGift':
      return Rituals.offerGift(params);
    case 'temple.drawFortune':
      return Rituals.drawFortune(params);
    case 'temple.grandCeremony':
      return Rituals.grandCeremony(params);
    case 'temple.requestSutra':
      return Rituals.requestSutra(params);
    case 'temple.controlSutra':
      return Rituals.controlSutra(params);
    case 'temple.getSutras':
      return SUTRA_DECK;
    case 'temple.updateSettings':
      return Rituals.updateSettings(params);
    case 'temple.resetMerit':
      return Rituals.resetMerit();
    case 'temple.comment':
      return parseViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'temple.gentleReminder': {
      if (typeof params.toggleAuto === 'boolean') {
        state.settings.autoGentleReply = params.toggleAuto;
        saveState();
        broadcastNotification('temple.state', getPublicState());
        if (!params.force) {
          return { ok: true, autoGentleReply: state.settings.autoGentleReply, state: getPublicState() };
        }
      }
      return await triggerTempleGentleReminder(Boolean(params.force));
    }
    case 'temple.speak':
    case 'temple.announceViewer': {
      const targetEvt = params.eventId
        ? state.recentEvents.find((e) => e.id === params.eventId)
        : null;
      const user = sanitizeUserName(params.user || targetEvt?.user || 'Thí Chủ');
      const wish = sanitizeWishText(params.wish || targetEvt?.wish || 'Cầu gia đạo bình an');
      const customText = params.text && !isBlockedSpamOrToxic(params.text) ? String(params.text).trim() : '';
      const speechText =
        customText ||
        params.suggestedTts ||
        targetEvt?.suggestedTts ||
        `Cảm tạ thí chủ ${user} thành tâm cầu nguyện: ${wish || 'Cầu gia đạo bình an'}. Nam mô A Di Đà Phật.`;
      const res = await zeroTts.synthesize(speechText, params.voice || 'maichi', 'high');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('tts.play', {
          text: speechText,
          user,
          wish,
          voice: res.voice,
          url: res.url
        });
      }
      return { ...res, text: speechText, user, wish };
    }
    case 'temple.ttsStatus':
      return zeroTts.getStatus();

    // --- WORKFLOW 2: ĐI NHÀ THỜ (THÁNH ĐƯỜNG HỒNG ÂN — LỄ ĐÀI CHÚA GIÊSU) ---
    case 'church.getState':
      return getChurchPublicState();
    case 'church.lightCandle':
      return ChurchRituals.lightCandle(params);
    case 'church.prayRosary':
      return ChurchRituals.prayRosary(params);
    case 'church.ringChurchBell':
      return ChurchRituals.ringChurchBell(params);
    case 'church.sendPrayer':
      return ChurchRituals.sendPrayer(params);
    case 'church.offerGift':
      return ChurchRituals.offerGift(params);
    case 'church.drawBibleBlessing':
      return ChurchRituals.drawBibleBlessing(params);
    case 'church.grandBlessing':
      return ChurchRituals.grandBlessing(params);
    case 'church.requestScripture':
      return ChurchRituals.requestScripture(params);
    case 'church.controlScripture':
    case 'church.scriptureControl':
      return ChurchRituals.controlScripture(params);
    case 'church.massControl':
    case 'church.controlMass':
      return ChurchRituals.massControl(params);
    case 'church.getMassLiturgy':
      return MASS_LITURGY;
    case 'church.getScriptures':
      return SCRIPTURE_DECK;
    case 'church.updateSettings':
      return ChurchRituals.updateSettings(params);
    case 'church.resetGrace':
      return ChurchRituals.resetGrace();
    case 'church.comment':
      return parseChurchViewerComment(params.comment, params.user, params.uniqueId, params.avatar);
    case 'church.gentleReminder': {
      if (typeof params.toggleAuto === 'boolean') {
        churchState.settings.autoGentleReply = params.toggleAuto;
        saveChurchState();
        broadcastNotification('church.state', getChurchPublicState());
        if (!params.force) {
          return { ok: true, autoGentleReply: churchState.settings.autoGentleReply, state: getChurchPublicState() };
        }
      }
      return await triggerChurchGentleReminder(Boolean(params.force));
    }
    case 'church.speak':
    case 'church.announceViewer': {
      const targetEvt = params.eventId
        ? churchState.recentEvents.find((e) => e.id === params.eventId)
        : null;
      const user = sanitizeParishionerName(params.user || targetEvt?.user || 'Tín Hữu');
      const rawWish = sanitizeWishText(params.wish || targetEvt?.wish || '');
      const isGenericWish =
        !rawWish ||
        rawWish.toLowerCase() === 'amen' ||
        rawWish.includes('Hiệp thông nơi Thánh Đường') ||
        rawWish.includes('Lạy Chúa Giêsu, con tín thác vào Chúa');
      let shortWish = rawWish;
      if (shortWish.length > 180) {
        const cut = shortWish.slice(0, 180);
        const lastSpace = cut.lastIndexOf(' ');
        shortWish = lastSpace > 100 ? cut.slice(0, lastSpace) : cut;
      }

      let speechText = params.text && !isBlockedSpamOrToxic(params.text) ? String(params.text).trim() : '';
      if (!speechText) {
        if (targetEvt?.type === 'offerGift' || targetEvt?.type === 'grandBlessing') {
          speechText = `Cảm tạ ân nhân ${user} đã tiến dâng ${targetEvt.giftName || 'lễ vật'}. Amen.`;
        } else if (isGenericWish) {
          speechText = `Cảm tạ tín hữu ${user} đã hiệp thông cầu nguyện. Amen.`;
        } else {
          speechText = `Cảm tạ tín hữu ${user} cầu nguyện, ${shortWish}. Amen.`;
        }
      }

      const res = await zeroTts.synthesize(speechText, params.voice || 'maichi', 'high');
      if (res.ok && params.broadcast !== false) {
        broadcastNotification('church.ttsPlay', {
          text: speechText,
          user,
          wish: rawWish || 'Amen',
          voice: res.voice,
          url: res.url
        });
      }
      return { ...res, text: speechText, user, wish: rawWish };
    }
    case 'church.connect':
      return await connectChurchTikTokLive(params.username);
    case 'church.disconnect':
      return disconnectChurchTikTokLive();
    case 'church.setAutoSim':
      configureChurchAutoSim(Boolean(params.enabled));
      saveChurchState();
      broadcastNotification('church.state', getChurchPublicState());
      return getChurchPublicState();

    // --- KẾT NỐI TIKTOK LIVE CHÙA (TEMPLE) ---
    case 'live.connect':
      return await connectTikTokLive(params.username);
    case 'live.disconnect':
      return disconnectTikTokLive();
    case 'live.setAutoSim':
      configureAutoSim(Boolean(params.enabled));
      saveState();
      broadcastNotification('temple.state', getPublicState());
      return getPublicState();
    default:
      throw new Error(`Không tìm thấy phương thức JSON-RPC: ${method}`);
  }
}

// ============================================================================
// 8. EXPRESS + WEBSOCKET SERVER
// ============================================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/tts-cache', express.static(TTS_CACHE_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/live', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/church', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'church.html'));
});

app.get('/church-live', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'church.html'));
});

app.get('/church-admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'church-admin.html'));
});

// HTTP JSON-RPC 2.0 Endpoint
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (!method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC Request: thiếu method' }
    });
  }
  try {
    const result = await handleRpcCall(method, params || {});
    res.json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      result
    });
  } catch (err) {
    res.status(200).json({
      jsonrpc: jsonrpc || '2.0',
      id: id ?? null,
      error: { code: -32000, message: err.message || 'Server error' }
    });
  }
});

// ZeroTTS HTTP Endpoint (Mai Chi default)
app.all('/api/tts', async (req, res) => {
  const text = (req.body?.text || req.query?.text || '').trim();
  const voice = (req.body?.voice || req.query?.voice || state.settings.ttsVoice || 'maichi').trim();
  const priority = (req.body?.priority || req.query?.priority || '').trim();
  if (!text) {
    return res.status(400).json({ ok: false, error: 'Thiếu nội dung text cần đọc' });
  }
  if (isBlockedSpamOrToxic(text)) {
    return res.status(400).json({ ok: false, error: 'Filtered toxic/inappropriate text' });
  }
  const result = await zeroTts.synthesize(text, voice, priority);
  res.json(result);
});

app.get('/api/state', (_req, res) => {
  res.json(getPublicState());
});

app.get('/api/church/state', (_req, res) => {
  res.json(getChurchPublicState());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function getAudioMasterClient(workflow = 'temple') {
  const openClients = Array.from(wss.clients).filter(
    (c) => c.readyState === 1 && (c.workflow || 'temple') === workflow
  );
  if (openClients.length === 0) return null;
  const obsClients = openClients.filter((c) => c.isObsClient);
  if (obsClients.length > 0) {
    return obsClients[obsClients.length - 1];
  }
  return openClients[openClients.length - 1];
}

function buildClientPayload(client, method, params) {
  const isChurchMethod = method.startsWith('church.');
  const clientWorkflow = client.workflow || 'temple';
  if (isChurchMethod && clientWorkflow !== 'church') {
    return null;
  }
  if (!isChurchMethod && clientWorkflow === 'church') {
    return null;
  }
  if (
    (method === 'church.event' || method === 'temple.event') &&
    !client.supportsParallelTts &&
    params?.event?.ttsText
  ) {
    return JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: {
        ...params,
        event: {
          ...params.event,
          ttsText: ''
        }
      }
    });
  }
  return JSON.stringify({ jsonrpc: '2.0', method, params });
}

function syncAudioMasterRoles() {
  const pubState = getPublicState();
  const churchPubState = getChurchPublicState();

  for (const client of wss.clients) {
    if (client.readyState !== 1) continue;
    const wf = client.workflow || 'temple';
    if (wf === 'church') {
      const statePayload = buildClientPayload(client, 'church.state', churchPubState);
      if (statePayload) client.send(statePayload);
      continue;
    }

    const statePayload = buildClientPayload(client, 'temple.state', pubState);
    if (statePayload) client.send(statePayload);
  }
}

function broadcastNotification(method, params) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      const payload = buildClientPayload(client, method, params);
      if (payload) {
        client.send(payload);
      }
    }
  }
}

wss.on('connection', (ws, req) => {
  const reqUrl = String(req?.url || '');
  const isTunnel = Boolean(req?.headers?.['cf-connecting-ip'] || req?.headers?.['x-forwarded-for']);
  ws.isObsClient = reqUrl.includes('mode=obs') || isTunnel;
  ws.workflow = reqUrl.includes('workflow=church') ? 'church' : 'temple';
  ws.supportsParallelTts = reqUrl.includes('v=13');
  ws.connectedAt = Date.now();

  syncAudioMasterRoles();
  if (ws.workflow === 'church') {
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'church.state',
        params: getChurchPublicState()
      })
    );
    // Đánh thức đúng 1 lần duy nhất khi vừa kết nối để khôi phục nếu client cũ đang bị tạm dừng
    setTimeout(() => {
      if (ws.readyState === 1 && churchState.settings?.scriptureEnabled !== false) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'church.scriptureControl',
            params: {
              enabled: true,
              voice: churchState.settings?.scriptureVoice || 'huuduc',
              volume: 1.0
            }
          })
        );
      }
    }, 900);
  }

  ws.on('close', () => {
    syncAudioMasterRoles();
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch (_) {
      return;
    }
    if (!msg || !msg.method) return;
    try {
      const result = await handleRpcCall(msg.method, msg.params || {});
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result
          })
        );
      }
    } catch (err) {
      if (msg.id !== undefined) {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: err.message || 'RPC Error' }
          })
        );
      }
    }
  });
});

const zeroTts = new ZeroTTSManager();

server.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`🪷 CHÙA ONLINE & ⛪ NHÀ THỜ ONLINE TIKTOK LIVE RPC ĐÃ KHỞI ĐỘNG`);
  console.log(`📺 Đi Chùa Live (9:16 OBS)   : http://localhost:${PORT}`);
  console.log(`⛪ Đi Nhà Thờ Live (9:16 OBS): http://localhost:${PORT}/church`);
  console.log(`🎛️ Admin Chùa / Nhà Thờ      : http://localhost:${PORT}/admin | http://localhost:${PORT}/church-admin`);
  console.log(`🔌 JSON-RPC 2.0 Endpoint     : http://localhost:${PORT}/rpc (ws://localhost:${PORT}/ws)`);
  console.log(`============================================================`);

  const defaultChannel = process.env.TIKTOK_USER || state.tiktok?.username || '';
  if (defaultChannel) {
    connectTikTokLive(defaultChannel).catch((err) => {
      console.warn(`[Auto-Connect @${defaultChannel}] Chưa kết nối được ngay:`, err.message);
    });
  }

  const defaultChurchChannel = churchState.tiktok?.username || '';
  if (defaultChurchChannel) {
    connectChurchTikTokLive(defaultChurchChannel).catch((err) => {
      console.warn(`[Auto-Connect Church @${defaultChurchChannel}] Chưa kết nối được ngay:`, err.message);
    });
  }
});
