/**
 * Church Live 9:16 Client Controller — Thánh Đường Hồng Ân & Lễ Đài Chúa Giêsu
 * - Hiển thị 6 Bục Quỳ Ân Nhân VIP (Top 6 Bảng Vàng Ân Phúc)
 * - Hiển thị 40 Giáo Dân mặc lễ phục trắng quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng Tín hữu tiến bước dọc thảm đỏ lên trước Lễ Đài thắp nến & quỳ cầu nguyện
 * - Giọng đọc ZeroTTS (Mai Chi / Hữu Đức) + Nhạc Thánh Ca Đàn Đại Phong Cầm & Chuông Thánh Đường
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const isObsMode = params.get('obs') === '1' || window.location.pathname === '/church-live';

  if (isObsMode) {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16) & Full Khung trong TikTok Live Studio
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    if (isObsMode) {
      const vw = window.innerWidth || stageWrapper.clientWidth || 1080;
      const vh = window.innerHeight || stageWrapper.clientHeight || 1920;
      const scaleX = vw / 1080;
      const scaleY = vh / 1920;
      stage9x16.style.transform = `translate(0px, 0px) scale(${scaleX}, ${scaleY})`;
      return;
    }
    const rect = stageWrapper.getBoundingClientRect();
    const scale = Math.min(rect.width / 1080, rect.height / 1920);
    const offsetX = Math.max(0, (rect.width - 1080 * scale) / 2);
    const offsetY = Math.max(0, (rect.height - 1920 * scale) / 2);
    stage9x16.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  if (typeof ResizeObserver !== 'undefined' && stageWrapper) {
    new ResizeObserver(fitStage).observe(stageWrapper);
  }
  fitStage();

  // 2. Khởi tạo Particle Engine & ChurchAudioEngine
  const canvas = document.getElementById('churchCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  // Tùy chỉnh cánh hoa rơi thành Hoa Huệ Trắng & Hoa Hồng Vàng Thánh Đường
  particles.pinkPetalSprite = particles.createPetalSprite('rgba(255, 252, 245, 0.88)');
  particles.goldPetalSprite = particles.createPetalSprite('rgba(255, 224, 120, 0.85)');

  const audio = new window.ChurchAudioEngine();
  const isMutedParam = params.get('mute') === '1';

  if (isMutedParam) {
    audio.ttsEnabled = false;
    audio.bgMusicEnabled = false;
    audio.sfxEnabled = false;
    audio.scriptureEnabled = false;
  } else if (isObsMode) {
    setTimeout(() => {
      try {
        unlockAudioOnce();
      } catch (_) {}
    }, 600);
  }

  let lastMassActiveState = false;
  let lastLocalMassControlAt = 0;

  function shortenSpeechBubble(str, maxLen = 250) {
    const clean = String(str || '').trim();
    return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
  }

  function syncMassSanctuaryActors(st) {
    if (!st || !st.massActive) return;
    const priestStack = document.getElementById('massPriestSpriteStack');
    if (priestStack) {
      const targetPose = st.priestPose || 'orans';
      priestStack.querySelectorAll('.mass-priest-pose').forEach((img) => {
        img.classList.toggle('active', img.getAttribute('data-priest-pose') === targetPose);
      });
    }

    const priestActor = document.getElementById('massPriestActor');
    const priestRoleTag = document.getElementById('massPriestRoleTag');
    const priestBubble = document.getElementById('massPriestBubble');
    const lectorActor = document.getElementById('massLectorActor');
    const lectorRoleTag = document.getElementById('massLectorRoleTag');
    const lectorNameTag = document.getElementById('massLectorNameTag');
    const lectorBubble = document.getElementById('massLectorBubble');
    const congBanner = document.getElementById('massCongregationBanner');
    const congText = document.getElementById('massCongregationText');
    const serverLeftSprite = document.getElementById('massServerLeftSprite');
    const serverRightSprite = document.getElementById('massServerRightSprite');

    if (serverLeftSprite && serverRightSprite && st.fx !== 'sanctusBell3') {
      serverLeftSprite.src = '/assets/catholic_male_kneel.png?v=23';
      serverRightSprite.src = '/assets/catholic_male_kneel.png?v=23';
    }

    const actor = st.activeActor || 'priest';
    if (actor === 'priest') {
      priestActor?.classList.add('active-speaker');
      if (priestRoleTag) priestRoleTag.textContent = `✝️ ${st.massRole || 'LINH MỤC CHỦ TẾ'}`;
      if (priestBubble && st.verseText) {
        priestBubble.textContent = `“${shortenSpeechBubble(st.verseText, 250)}”`;
      }
      lectorActor?.classList.remove('active-speaker');
      if (st.fx === 'sanctusBell3' || st.fx === 'grandBlessingRain') {
        congBanner?.classList.add('visible');
        if (congText) {
          congText.textContent = `“${shortenSpeechBubble(st.hallBubble || 'Lạy Chúa của con, lạy Thiên Chúa của con!', 250)}”`;
        }
      } else {
        congBanner?.classList.remove('visible');
      }
    } else if (actor === 'lector') {
      lectorActor?.classList.add('active-speaker');
      if (lectorRoleTag) lectorRoleTag.textContent = `📖 ${st.massRole || 'ĐỌC SÁCH THÁNH'}`;
      if (lectorNameTag) {
        lectorNameTag.textContent = 'Ca Trưởng Kim Oanh';
      }
      if (lectorBubble && st.verseText) {
        lectorBubble.textContent = `“${shortenSpeechBubble(st.verseText, 250)}”`;
      }
      priestActor?.classList.remove('active-speaker');
      congBanner?.classList.remove('visible');
    } else if (actor === 'congregation') {
      priestActor?.classList.remove('active-speaker');
      lectorActor?.classList.remove('active-speaker');
      congBanner?.classList.add('visible');
      if (congText) {
        congText.textContent = `“${shortenSpeechBubble(st.verseText || st.hallBubble || 'Amen.', 250)}”`;
      }
    }
  }

  // Đồng bộ hiển thị Cuộn Kinh Thánh, Phụ Đề Lời Chúa & Nghi Thức Hành Lễ
  function renderScriptureScrollBanner(st) {
    const banner = document.getElementById('scriptureScrollBanner');
    const badge = document.getElementById('scriptureStatusBadge');
    const titleEl = document.getElementById('scriptureBannerTitle');
    const counterEl = document.getElementById('scriptureVerseCounter');
    const textEl = document.getElementById('scriptureVerseText');
    const dockMassStatusLine = document.getElementById('dockMassStatusLine');
    const btnStartMassNow = document.getElementById('btnStartMassNow');
    const btnToggleMassSchedule = document.getElementById('btnToggleMassSchedule');

    if (st) {
      const nextMassActive = Boolean(st.massActive);
      if (stage9x16) {
        stage9x16.classList.toggle('mass-liturgy-mode', nextMassActive);
      }
      if (nextMassActive !== lastMassActiveState) {
        lastMassActiveState = nextMassActive;
        if (typeof renderCongregationHall === 'function' && typeof latestHallState !== 'undefined') {
          renderCongregationHall(latestHallState.lb, latestHallState.pewViewers, true);
        }
      }
      if (nextMassActive) {
        syncMassSanctuaryActors(st);
      }
    }

    if (banner && st) {
      banner.classList.toggle('disabled', !st.enabled && !isObsMode);
      banner.classList.toggle('speaking', Boolean(st.playing));
      banner.classList.toggle('paused-by-ritual', Boolean(st.pausedByRitual));
      banner.classList.toggle('mass-active', Boolean(st.massActive));

      if (st.massActive) {
        if (badge) {
          badge.textContent = '⛪ ' + String(st.massRole || 'THÁNH LỄ PHỤNG VỤ').toUpperCase();
        }
        if (titleEl) {
          titleEl.textContent = st.massPartTitle || 'THÁNH LỄ TRỌNG THỂ';
        }
        if (counterEl) {
          counterEl.textContent = `Bước ${(st.massStepIndex ?? 0) + 1}/${st.massTotalSteps || 48}`;
        }
        if (textEl && st.verseText) {
          textEl.textContent = `“${st.verseText}”`;
        }
      } else {
        if (badge) {
          if (st.pausedByRitual) {
            badge.textContent = '🙏 DÂNG Ý NGUYỆN TÍN HỮU';
          } else if (st.playing) {
            badge.textContent = '📖 ĐANG ĐỌC LỜI CHÚA';
          } else {
            badge.textContent = '✝️ LỜI CHÚA & THÁNH VỊNH';
          }
        }
        if (titleEl && st.scriptureTitle) {
          titleEl.textContent = st.scriptureTitle;
        }
        if (counterEl && st.totalVerses > 0) {
          counterEl.textContent = `Câu ${st.verseIndex + 1}/${st.totalVerses}`;
        }
        if (textEl && st.verseText) {
          textEl.textContent = `“${st.verseText}”`;
        }
      }
    }

    if (dockMassStatusLine && st) {
      if (st.massActive) {
        dockMassStatusLine.innerHTML = `Đang cử hành: <strong>${escapeHtml(st.massPartTitle || 'Thánh Lễ')} (Bước ${(st.massStepIndex ?? 0) + 1}/${st.massTotalSteps || 48})</strong>`;
      } else {
        dockMassStatusLine.innerHTML = `Trạng thái: <strong>📖 Chế độ Đọc Kinh Thường</strong>`;
      }
    }

    if (btnStartMassNow && st) {
      btnStartMassNow.textContent = st.massActive
        ? '⛪ Đang Hành Lễ (Bấm Để Làm Lại Từ Đầu)'
        : '🔔 Bắt Đầu Hành Lễ Ngay';
    }

    if (btnToggleMassSchedule && st) {
      const autoOn = st.massAutoSchedule !== false;
      btnToggleMassSchedule.textContent = autoOn
        ? '⏰ Tự Động Mở Lễ Đúng Giờ (5h–7h, 12h, 17h–22h): BẬT'
        : '⏰ Tự Động Mở Lễ Đúng Giờ (5h–7h, 12h, 17h–22h): TẮT';
      btnToggleMassSchedule.classList.toggle('active-toggle', autoOn);
    }

    const selectDeck = document.getElementById('selectScriptureDeck');
    if (selectDeck && st && !st.massActive && st.scriptureId && selectDeck.value !== st.scriptureId) {
      selectDeck.value = st.scriptureId;
    }
    const selectVoice = document.getElementById('selectScriptureVoice');
    if (selectVoice && st && !st.massActive && st.voice && selectVoice.value !== st.voice) {
      selectVoice.value = st.voice;
    }
    const btnToggleScripture = document.getElementById('btnToggleScripture');
    if (btnToggleScripture && st) {
      if (st.playing) {
        btnToggleScripture.textContent = st.massActive ? '⛪ Hành Lễ: ĐANG ĐỌC' : '📖 Lời Chúa: ĐANG ĐỌC';
      } else if (st.enabled) {
        btnToggleScripture.textContent = '▶️ Bấm Để Đọc Lời Chúa';
      } else {
        btnToggleScripture.textContent = '📖 Lời Chúa: TẮT';
      }
      btnToggleScripture.classList.toggle('active-toggle', Boolean(st.enabled && st.playing));
      btnToggleScripture.classList.toggle('gold', Boolean(st.enabled && !st.playing));
    }
  }

  audio.onScriptureStateChange = (st) => {
    renderScriptureScrollBanner(st);
  };

  audio.onScriptureVisualBeat = (beatType) => {
    if (beatType === 'bell') {
      particles.spawnBellWave(540, 255, 3);
      const haloSys = document.getElementById('christHaloSystem');
      if (haloSys) {
        haloSys.classList.add('flare');
        setTimeout(() => haloSys.classList.remove('flare'), 2800);
      }
    } else if (beatType === 'rosary') {
      pulseHallBowing();
    }
  };
  renderScriptureScrollBanner(audio.getScriptureStatus());

  function unlockAudioOnce() {
    audio.ensureContext();
    if (window.innerWidth <= 900 && !document.fullscreenElement) {
      const el = document.documentElement;
      const reqFs = el.requestFullscreen || el.webkitRequestFullscreen;
      if (reqFs) {
        try {
          reqFs.call(el).catch(() => {});
        } catch (_) {}
      }
    }
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = '✅ Âm Thanh Thánh Đường Đã Sẵn Sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // 3. Vẽ Giàn Nến Phụng Vụ Đang Cháy Lung Linh Trên Lễ Đài (x=540, y=895)
  const candlesHolder = document.getElementById('votiveCandlesHolder');
  let renderedCandleCount = 0;

  function renderVotiveCandles(count) {
    if (!candlesHolder) return;
    const target = Math.max(6, Math.min(40, Number(count) || 16));
    if (target === renderedCandleCount && candlesHolder.children.length > 0) return;
    renderedCandleCount = target;
    candlesHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const candle = document.createElement('div');
      candle.className = 'votive-candle';

      const spread = target === 1 ? 0 : i / (target - 1) - 0.5;
      const row = i % 3;
      const leftPx = 105 + spread * 185;
      const heightPx = 32 + row * 10 + (i % 4) * 3;
      const bottomPx = row * 11;

      candle.style.left = `${leftPx}px`;
      candle.style.bottom = `${bottomPx}px`;
      candle.style.height = `${heightPx}px`;

      const flame = document.createElement('div');
      flame.className = 'candle-flame';
      flame.style.animationDelay = `${(i * 0.17) % 1.4}s`;
      candle.appendChild(flame);
      candlesHolder.appendChild(candle);

      const tipX = 540 + (leftPx - 105);
      const tipY = 895 - bottomPx - heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  // 4. BỘ NHẬN DIỆN GIỚI TÍNH NAM / NỮ & LỄ PHỤC THÁNH ĐƯỜNG CÔNG GIÁO 100%
  // (Nam: Áo lễ Ca đoàn trắng choàng khăn xanh Mẹ Maria / đỏ Thánh Tâm / vàng; Nữ: Áo dài trắng khăn voan ren Nhà Thờ)
  const MALE_CATHOLIC_SPRITES = [
    '/assets/catholic_male_1.png?v=21',
    '/assets/catholic_male_2.png?v=21',
    '/assets/catholic_male_3.png?v=21'
  ];
  const FEMALE_CATHOLIC_SPRITES = [
    '/assets/catholic_female_1.png?v=21',
    '/assets/catholic_female_2.png?v=21',
    '/assets/catholic_female_3.png?v=21'
  ];

  function detectClientGender(rawName = '', explicitGender = null) {
    if (explicitGender === 'female' || explicitGender === 2) return 'female';
    if (explicitGender === 'male' || explicitGender === 1) return 'male';
    const combined = String(rawName || '').toLowerCase().normalize('NFC');
    const femaleKw = [
      'maria', 'anna', 'têrêsa', 'teresa', 'cecilia', 'monica', 'rosa', 'clara', 'lucia', 'marta',
      'thị', 'ngọc', 'linh', 'thảo', 'thao', 'trang', 'huyền', 'huyen', 'vy', 'vi', 'nhi', 'phương', 'phuong',
      'lan', 'mai', 'hương', 'huong', 'hằng', 'hang', 'nhung', 'yến', 'yen', 'oanh', 'trinh', 'liễu', 'lieu',
      'quyên', 'quyen', 'ngân', 'ngan', 'hà', 'ha', 'diệu', 'dieu', 'thư', 'thu', 'bích', 'bich', 'tuyết', 'tuyet',
      'trâm', 'tram', 'nguyệt', 'nguyet', 'loan', 'kiều', 'kieu', 'hạnh', 'hanh', 'duyên', 'duyen', 'my',
      'quỳnh', 'quynh', 'diễm', 'diem', 'thúy', 'thuy', 'thủy', 'nga', 'chị', 'cô', 'bé', 'mẹ', 'bà', 'lily', 'na'
    ];
    const maleKw = [
      'giuse', 'phêrô', 'phero', 'phaolô', 'phaolo', 'gioan', 'antôn', 'anton', 'phanxicô', 'đaminh', 'vinhsơn', 'micae',
      'văn', 'tuấn', 'tuan', 'kiệt', 'kiet', 'quân', 'quan', 'nam', 'đạt', 'dat', 'thắng', 'thang', 'hùng', 'hung',
      'dũng', 'cường', 'cuong', 'tùng', 'tung', 'sơn', 'son', 'hải', 'hai', 'long', 'vũ', 'vu', 'phong',
      'đức', 'duc', 'thịnh', 'thinh', 'trí', 'tri', 'huy', 'hoàng', 'hoang', 'hiếu', 'hieu', 'trọng', 'trong',
      'tài', 'phúc', 'khánh', 'toàn', 'trung', 'kiên', 'khôi', 'hào', 'lâm', 'bách', 'tú', 'anh', 'chú', 'ông', 'adam', 'lee'
    ];
    for (const kw of femaleKw) {
      if (combined.includes(kw)) return 'female';
    }
    for (const kw of maleKw) {
      if (combined.includes(kw)) return 'male';
    }
    let h = 0;
    for (let i = 0; i < combined.length; i++) h = (h * 31 + combined.charCodeAt(i)) | 0;
    return Math.abs(h) % 2 === 0 ? 'female' : 'male';
  }

  function pickCatholicSpriteForViewer(viewer, slotIndex = 0) {
    const gender = detectClientGender(viewer?.name || viewer?.user || '', viewer?.gender);
    let h = slotIndex;
    const nameStr = String(viewer?.name || viewer?.user || '');
    for (let i = 0; i < nameStr.length; i++) h = (h * 17 + nameStr.charCodeAt(i)) | 0;
    const variantIdx = Math.abs(h) % 3;
    return gender === 'female' ? FEMALE_CATHOLIC_SPRITES[variantIdx] : MALE_CATHOLIC_SPRITES[variantIdx];
  }

  // Tám Đệm Quỳ Danh Dự Đầu Cung Thánh (Top 8 Bảng Vàng Ân Phúc quỳ cân đối 4 Trái - 4 Phải trên đệm nhung đỏ y=1204)
  const VIP_PEW_COORDS = [
    { x: 372, y: 1204, rank: 1, title: 'ĐẠI ÂN NHÂN' },
    { x: 636, y: 1204, rank: 2, title: 'ĐẠI ÂN NHÂN' },
    { x: 278, y: 1204, rank: 3, title: 'ÂN PHÚC LỚN' },
    { x: 730, y: 1204, rank: 4, title: 'ÂN PHÚC LỚN' },
    { x: 184, y: 1204, rank: 5, title: 'TÍN HỮU VIP' },
    { x: 824, y: 1204, rank: 6, title: 'TÍN HỮU VIP' },
    { x: 92,  y: 1204, rank: 7, title: 'TÍN HỮU VIP' },
    { x: 916, y: 1204, rank: 8, title: 'TÍN HỮU VIP' }
  ];

  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = VIP_PEW_COORDS.map((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return '';
      const spriteUrl = pickCatholicSpriteForViewer(dev, idx);
      const genderAttr = detectClientGender(dev.name, dev.gender);
      return `
        <div class="vip-devotee-slot pew-vip-slot" data-gender="${genderAttr}" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${15 + idx};">
          <div class="vip-head-halo"></div>
          <img src="${spriteUrl}" data-orig-src="${spriteUrl}" alt="Tín hữu VIP" class="pew-seated-sprite" />
          <div class="vip-rank-pill">
            <div class="vip-rank-top-row">
              <span class="vip-rank-num">#${slot.rank}</span>
              <span class="vip-rank-title">${slot.title}</span>
            </div>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 13))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Đại Sảnh Đá Cẩm Thạch 40 Vị Trí Quỳ Hiệp Thông Hai Bên Thảm Đỏ
  // QUY TẮC: KHÔNG LÀM SẴN NGƯỜI NGỒI TRỐNG! Ai bước vào Thánh Đường thực tế -> lên thảm đỏ thắp nến xong -> mới vào ngồi chỗ trống kèm tên & đúng giới tính Nam/Nữ!
  const congregationHall = document.getElementById('congregationHall');
  const HALL_PEW_COORDS = [];

  (function buildGrandHallGrid() {
    const rows = 5;
    const colsPerSide = 4;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa y=1380) -> 1 (gần y=1712)
      const y = Math.round(1380 + progress * 332);
      const scale = +(0.82 + progress * 0.25).toFixed(2);

      // Cánh trái thảm đỏ (nằm trọn trong vùng an toàn điện thoại x=88..328)
      const leftOuterX = 88;
      const leftInnerX = Math.round(328 - progress * 44);
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
        HALL_PEW_COORDS.push({ side: 'L', row: r + 1, col: c, x, y, scale });
      }

      // Cánh phải thảm đỏ (nằm trọn trong vùng an toàn điện thoại x=752..992)
      const rightInnerX = Math.round(752 + progress * 44);
      const rightOuterX = 992;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
        HALL_PEW_COORDS.push({ side: 'R', row: r + 1, col: c, x, y, scale });
      }
    }
  })();

  // Thứ tự ưu tiên lấp đầy ghế từ sát thảm đỏ và hàng trên xuống hàng dưới (để ai mới vào cũng được ngồi vị trí đẹp nhất trước!)
  const SEAT_FILL_PRIORITY = [
    3, 4, 2, 5, 1, 6, 0, 7,
    11, 12, 10, 13, 9, 14, 8, 15,
    19, 20, 18, 21, 17, 22, 16, 23,
    27, 28, 26, 29, 25, 30, 24, 31,
    35, 36, 34, 37, 33, 38, 32, 39
  ];

  let lastRenderedLeaderboardJson = '';
  const pendingCarpetWalkers = new Set();
  const seatedOnceUsers = new Set();
  let latestHallState = { lb: [], pewViewers: [] };

  function getViewerRoleTag(viewer, rankIdx, now) {
    if (!viewer) return 'HIỆP THÔNG';
    const isFresh = viewer.lastActiveAt && (now - viewer.lastActiveAt < 25000);
    const wish = String(viewer.lastWish || '');
    if (viewer.gifts > 0 || wish.includes('tiến dâng')) return '🌹 ÂN NHÂN';
    if (isFresh && wish.includes('Đã vào Thánh Đường')) return '✨ MỚI BƯỚC VÀO';
    if (isFresh) return '🕯️ VỪA CẦU NGUYỆN';
    if (rankIdx < 6) return '🙏 LÒNG THÀNH';
    return '✝️ TÍN HỮU';
  }

  function renderCongregationHall(leaderboard = [], pewViewers = null, forceRender = false) {
    if (!congregationHall) return;
    latestHallState = { lb: leaderboard, pewViewers };

    let sourceViewers = [];
    if (audio.massActive) {
      // Khi đang ở Chế độ Hành Lễ: Gộp cả Top 8 VIP và pewViewers vào Cộng Đoàn Giáo Dân để toàn bộ giáo dân quỳ hiệp thông hai bên thảm đỏ hướng lên Cha Chủ Tế
      const seenKeys = new Set();
      const pushUniqueViewer = (v) => {
        if (!v) return;
        const k = String(v.uniqueId || v.name || '').trim().toLowerCase();
        if (!k || seenKeys.has(k)) return;
        seenKeys.add(k);
        sourceViewers.push(v);
      };
      if (Array.isArray(leaderboard)) {
        leaderboard.slice(0, 8).forEach(pushUniqueViewer);
      }
      if (Array.isArray(pewViewers)) {
        pewViewers.forEach(pushUniqueViewer);
      }
    } else if (Array.isArray(pewViewers)) {
      sourceViewers = pewViewers;
    }

    const rawViewers = sourceViewers.slice(0, HALL_PEW_COORDS.length);
    // Ai đang bước trên thảm đỏ dâng nến lần đầu (pendingCarpetWalkers) thì đợi dâng nến xong (3.85s) mới bước vào ngồi ghế trống!
    const hallViewers = rawViewers.filter((v) => {
      if (audio.massActive) return true;
      const uKey = String(v.name || '').trim().toLowerCase();
      if (pendingCarpetWalkers.has(uKey) && !seatedOnceUsers.has(uKey)) {
        return false;
      }
      return true;
    });

    const sig = `${audio.massActive ? 'M1' : 'M0'}::` + JSON.stringify(hallViewers.map((d) => `${d.name}:${d.gender || ''}:${d.grace || d.merit}:${d.lastActiveAt || 0}`));
    if (!forceRender && sig === lastRenderedLeaderboardJson) return;
    lastRenderedLeaderboardJson = sig;

    const seatViewerMap = new Map();
    const seatRankMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < SEAT_FILL_PRIORITY.length) {
        const targetSeatIdx = SEAT_FILL_PRIORITY[idx];
        seatViewerMap.set(targetSeatIdx, viewer);
        seatRankMap.set(targetSeatIdx, idx);
        seatedOnceUsers.add(String(viewer.name || '').trim().toLowerCase());
      }
    });

    const now = Date.now();
    congregationHall.innerHTML = HALL_PEW_COORDS.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      // KHÔNG LÀM SẴN: Nếu ghế này chưa có khán giả thực tế vào ngồi thì để trống sàn đá cẩm thạch!
      if (!viewer) return '';

      const rankIdx = seatRankMap.get(idx) || 0;
      const isRecent = viewer.lastActiveAt && (now - viewer.lastActiveAt < 14000);
      const roleLabel = getViewerRoleTag(viewer, rankIdx, now);
      const spriteUrl = pickCatholicSpriteForViewer(viewer, idx);
      const genderAttr = detectClientGender(viewer.name, viewer.gender);

      return `
        <div
          class="hall-seat${isRecent ? ' newly-seated' : ''}"
          data-seat-idx="${idx}"
          data-gender="${genderAttr}"
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${16 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale});"
        >
          <div class="seat-liturgy-bubble"></div>
          <img
            src="${spriteUrl}"
            data-orig-src="${spriteUrl}"
            alt="Tín hữu quỳ hiệp thông"
            class="pew-seated-sprite"
          />
          <div class="seat-badge">
            <span class="seat-badge-role">${roleLabel}</span>
            <div class="seat-badge-main">
              <span class="seat-avatar">${
                viewer.avatar
                  ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                  : escapeHtml(String(viewer.name || 'T').charAt(0).toUpperCase())
              }</span>
              <span class="seat-username">${escapeHtml(shortenName(viewer.name, 12))}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Preload trọn bộ 8 frame Nam & 8 frame Nữ Công Giáo để bước đi và quỳ lạy mượt 0ms
  const SPRITE_FRAMES_BY_GENDER = {
    male: {
      walk1: '/assets/catholic_male_walk.png?v=21',
      walk2: '/assets/catholic_male_walk_2.png?v=21',
      kneelDown: '/assets/catholic_male_kneel_down.png?v=21',
      kneel: '/assets/catholic_male_kneel.png?v=21',
      forehead: '/assets/catholic_male_bow.png?v=21',
      bowMid: '/assets/catholic_male_bow_mid.png?v=21',
      prostrate: '/assets/catholic_male_prostrate.png?v=21',
      prostrateDeep: '/assets/catholic_male_prostrate_deep.png?v=21'
    },
    female: {
      walk1: '/assets/catholic_female_walk.png?v=21',
      walk2: '/assets/catholic_female_walk_2.png?v=21',
      kneelDown: '/assets/catholic_female_kneel_down.png?v=21',
      kneel: '/assets/catholic_female_kneel.png?v=21',
      forehead: '/assets/catholic_female_bow.png?v=21',
      bowMid: '/assets/catholic_female_bow_mid.png?v=21',
      prostrate: '/assets/catholic_female_prostrate.png?v=21',
      prostrateDeep: '/assets/catholic_female_prostrate_deep.png?v=21'
    }
  };
  [...Object.values(SPRITE_FRAMES_BY_GENDER.male), ...Object.values(SPRITE_FRAMES_BY_GENDER.female), ...MALE_CATHOLIC_SPRITES, ...FEMALE_CATHOLIC_SPRITES].forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  function applyGenderSpritesToStack(stackId, gender) {
    const stack = document.getElementById(stackId);
    if (!stack) return;
    const frameMap = gender === 'female' ? SPRITE_FRAMES_BY_GENDER.female : SPRITE_FRAMES_BY_GENDER.male;
    stack.querySelectorAll('.pose-frame').forEach((img) => {
      const pose = img.getAttribute('data-pose');
      if (pose && frameMap[pose]) {
        img.src = frameMap[pose];
      }
    });
  }

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 3 !== 0) return;
      const img = el.querySelector('.pew-seated-sprite');
      if (!img) return;
      const origSrc = img.getAttribute('data-orig-src') || img.getAttribute('src');
      const g = el.getAttribute('data-gender') === 'female' ? 'female' : 'male';
      const fSet = SPRITE_FRAMES_BY_GENDER[g];
      const delay = (i % 4) * 85;
      setTimeout(() => { img.src = fSet.forehead; }, delay);
      setTimeout(() => { img.src = fSet.bowMid; }, delay + 160);
      setTimeout(() => { img.src = fSet.prostrate; }, delay + 340);
      setTimeout(() => { img.src = fSet.bowMid; }, delay + 660);
      setTimeout(() => { img.src = origSrc; }, delay + 840);
    });
  }

  // Đồng bộ tư thế toàn bộ giáo dân trong khán đài & Bục Quỳ VIP theo từng bước Hành Lễ
  function triggerMassHallPosture(hallPose, hallBubble, roleTitle = '') {
    const centralLane = WORSHIPPER_LANES[0];
    if (hallBubble) {
      const wishEl = document.getElementById('centralWishBubble');
      const actEl = document.getElementById('centralAction');
      if (wishEl) wishEl.textContent = `“${hallBubble}”`;
      if (actEl && roleTitle) actEl.textContent = `⛪ ${roleTitle}`;
      if (centralLane && Date.now() >= centralLane.busyUntil) {
        clearLaneTimers(centralLane);
        const centralEl = document.getElementById('centralWorshipper');
        if (centralEl) centralEl.classList.remove('walking-up');
        if (hallPose === 'prostrateDeep') {
          scheduleLanePose(centralLane, 0, 'forehead');
          scheduleLanePose(centralLane, 180, 'bowMid');
          scheduleLanePose(centralLane, 360, 'prostrateDeep');
          scheduleLanePose(centralLane, 2950, 'bowMid');
          scheduleLanePose(centralLane, 3250, 'kneel');
        } else if (hallPose === 'prostrate') {
          scheduleLanePose(centralLane, 0, 'forehead');
          scheduleLanePose(centralLane, 180, 'bowMid');
          scheduleLanePose(centralLane, 360, 'prostrate');
          scheduleLanePose(centralLane, 1750, 'bowMid');
          scheduleLanePose(centralLane, 2000, 'kneel');
        } else {
          playLanePrayerSequence(centralLane, 0);
        }
      }
    }

    if (!hallPose || !['bow', 'prostrate', 'prostrateDeep'].includes(hallPose)) {
      return;
    }

    const allSlots = [
      ...Array.from(document.querySelectorAll('#vipCushionsLayer .vip-devotee-slot')),
      ...Array.from(document.querySelectorAll('#congregationHall .hall-seat'))
    ];

    const holdMs = hallPose === 'prostrateDeep' ? 2600 : hallPose === 'prostrate' ? 1400 : 750;
    allSlots.forEach((el, i) => {
      const img = el.querySelector('.pew-seated-sprite');
      if (!img) return;
      const origSrc = img.getAttribute('data-orig-src') || img.getAttribute('src');
      const g = el.getAttribute('data-gender') === 'female' ? 'female' : 'male';
      const fSet = SPRITE_FRAMES_BY_GENDER[g];
      const delay = (i % 5) * 65;

      setTimeout(() => { img.src = fSet.forehead; }, delay);
      setTimeout(() => { img.src = fSet.bowMid; }, delay + 160);
      if (hallPose === 'prostrateDeep') {
        setTimeout(() => { img.src = fSet.prostrateDeep; }, delay + 340);
      } else if (hallPose === 'prostrate') {
        setTimeout(() => { img.src = fSet.prostrate; }, delay + 340);
      }
      setTimeout(() => { img.src = fSet.bowMid; }, delay + 340 + holdMs);
      setTimeout(() => { img.src = origSrc; }, delay + 540 + holdMs);
    });
  }

  // Cung cấp danh sách tên khán giả thực tế cho Lời Nguyện Tín Hữu (Phần II)
  audio.getRecentParishionerNames = () => {
    const names = [];
    const seen = new Set();
    const pushUnique = (list) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        if (names.length >= 4) break;
        const n = String(item?.name || item?.user || '').trim();
        if (!n) continue;
        const k = n.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          names.push(n);
        }
      }
    };
    pushUnique(latestHallState.pewViewers);
    if (names.length < 4) {
      pushUnique(latestHallState.lb);
    }
    return names.join(', ');
  };

  // Đồng bộ Hiệu Ứng Ánh Sáng, Chuông & Tư Thế Khán Đài theo từng bước Hành Lễ
  audio.onMassStepVisual = (step) => {
    if (!step) return;
    const haloSys = document.getElementById('christHaloSystem');
    const sacredHeart = document.getElementById('sacredHeartHalo');
    const beam = document.getElementById('sacredLightBeam');
    const serverLeftSprite = document.getElementById('massServerLeftSprite');
    const serverRightSprite = document.getElementById('massServerRightSprite');
    const congBanner = document.getElementById('massCongregationBanner');
    const congText = document.getElementById('massCongregationText');

    syncMassSanctuaryActors(audio.getScriptureStatus());

    if (step.fx === 'sanctusBell3') {
      if (serverLeftSprite) serverLeftSprite.src = '/assets/catholic_male_prostrate_deep.png?v=23';
      if (serverRightSprite) serverRightSprite.src = '/assets/catholic_male_prostrate_deep.png?v=23';
      setTimeout(() => {
        if (serverLeftSprite) serverLeftSprite.src = '/assets/catholic_male_kneel.png?v=23';
        if (serverRightSprite) serverRightSprite.src = '/assets/catholic_male_kneel.png?v=23';
      }, 3400);
      if (congBanner) congBanner.classList.add('visible');
      if (congText) {
        congText.textContent = `“${step.hallBubble || 'Lạy Chúa của con, lạy Thiên Chúa của con!'}”`;
      }
    }

    if (step.activeActor === 'congregation' || step.fx === 'sanctusBell3' || step.fx === 'grandBlessingRain') {
      const bubbleStr = step.hallBubble || 'Amen!';
      const seats = document.querySelectorAll('#congregationHall .hall-seat');
      seats.forEach((seatEl, i) => {
        if (i >= 10) return;
        const bEl = seatEl.querySelector('.seat-liturgy-bubble');
        if (!bEl) return;
        bEl.textContent = bubbleStr;
        bEl.classList.add('visible');
        setTimeout(() => {
          bEl.classList.remove('visible');
        }, 2900);
      });
    }

    if (step.fx === 'cathedralBell3' || step.fx === 'sanctusBell3') {
      particles.spawnBellWave(540, 255, 4);
      if (haloSys) {
        haloSys.classList.add('flare');
        setTimeout(() => haloSys.classList.remove('flare'), 4200);
      }
      if (sacredHeart) {
        sacredHeart.classList.add('flare');
        setTimeout(() => sacredHeart.classList.remove('flare'), 4200);
      }
      if (beam) {
        beam.classList.add('intense');
        setTimeout(() => beam.classList.remove('intense'), 4200);
      }
    } else if (step.fx === 'haloFlare') {
      if (haloSys) {
        haloSys.classList.add('flare');
        setTimeout(() => haloSys.classList.remove('flare'), 3500);
      }
      if (sacredHeart) {
        sacredHeart.classList.add('flare');
        setTimeout(() => sacredHeart.classList.remove('flare'), 3500);
      }
    } else if (step.fx === 'incenseBurst') {
      particles.spawnIncenseBurst(540, 895);
    } else if (step.fx === 'grandBlessingRain') {
      particles.spawnGrandCeremonyRain();
      showGrandBlessingBanner(
        'CỘNG ĐOÀN THÁNH ĐƯỜNG',
        'Phép Lành Trọng Thể Nhân Danh Cha Và Con Và Thánh Thần',
        100
      );
    }

    triggerMassHallPosture(step.hallPose, step.hallBubble, step.role);
  };

  // =========================================================================
  // HỆ THỐNG 3 VỊ TRÍ DÂNG NẾN SONG SONG (GIỮA - TRÁI - PHẢI) + HÀNG CHỜ TRANG NGHIÊM
  // Mỗi tín hữu bước lên được bảo vệ trọn vẹn 3.8 giây (không bao giờ bị đẩy ra giữa chừng!)
  // =========================================================================
  const WORSHIPPER_LANES = [
    {
      index: 0,
      rootId: 'centralWorshipper',
      stackId: 'centralSpriteStack',
      nameId: 'centralName',
      actionId: 'centralAction',
      wishId: 'centralWishBubble',
      avatarId: 'centralAvatar',
      isPrimary: true,
      busyUntil: 0,
      timers: [],
      hideTimer: null
    },
    {
      index: 1,
      rootId: 'leftWorshipper',
      stackId: 'leftSpriteStack',
      nameId: 'leftName',
      actionId: 'leftAction',
      wishId: 'leftWishBubble',
      avatarId: 'leftAvatar',
      isPrimary: false,
      busyUntil: 0,
      timers: [],
      hideTimer: null
    },
    {
      index: 2,
      rootId: 'rightWorshipper',
      stackId: 'rightSpriteStack',
      nameId: 'rightName',
      actionId: 'rightAction',
      wishId: 'rightWishBubble',
      avatarId: 'rightAvatar',
      isPrimary: false,
      busyUntil: 0,
      timers: [],
      hideTimer: null
    }
  ];

  const LANE_RITUAL_DURATION_MS = 3850;
  const walkerQueue = [];
  let walkerQueueDrainTimer = null;
  let nextLaneCursor = 0;

  function findNextFreeLane(now) {
    for (let offset = 0; offset < WORSHIPPER_LANES.length; offset++) {
      const idx = (nextLaneCursor + offset) % WORSHIPPER_LANES.length;
      if (now >= WORSHIPPER_LANES[idx].busyUntil) {
        nextLaneCursor = (idx + 1) % WORSHIPPER_LANES.length;
        return WORSHIPPER_LANES[idx];
      }
    }
    return null;
  }

  function clearLaneTimers(lane) {
    while (lane.timers.length > 0) {
      clearTimeout(lane.timers.pop());
    }
    if (lane.hideTimer) {
      clearTimeout(lane.hideTimer);
      lane.hideTimer = null;
    }
  }

  function setLanePose(lane, poseKey) {
    const stack = document.getElementById(lane.stackId);
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function scheduleLanePose(lane, ms, poseKey) {
    lane.timers.push(
      setTimeout(() => {
        setLanePose(lane, poseKey);
      }, ms)
    );
  }

  function playLanePrayerSequence(lane, startDelayMs = 0) {
    scheduleLanePose(lane, startDelayMs, 'kneelDown');
    scheduleLanePose(lane, startDelayMs + 180, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1750];
    bowOffsets.forEach((t0) => {
      scheduleLanePose(lane, t0, 'forehead');
      scheduleLanePose(lane, t0 + 210, 'bowMid');
      scheduleLanePose(lane, t0 + 490, 'prostrate');
      scheduleLanePose(lane, t0 + 780, 'bowMid');
      scheduleLanePose(lane, t0 + 980, 'forehead');
      scheduleLanePose(lane, t0 + 1180, 'kneel');
    });
  }

  function updateWalkerQueueBadge() {
    const badge = document.getElementById('walkerQueueBadge');
    const countEl = document.getElementById('walkerQueueCount');
    if (!badge || !countEl) return;
    if (walkerQueue.length > 0) {
      countEl.textContent = String(walkerQueue.length);
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function updateLaneAppearance(lane, user, avatar, actionLabel, wish, gender = null) {
    const rootEl = document.getElementById(lane.rootId);
    const nameEl = document.getElementById(lane.nameId);
    const actEl = document.getElementById(lane.actionId);
    const wishEl = document.getElementById(lane.wishId);
    const avatarEl = document.getElementById(lane.avatarId);

    if (rootEl) {
      rootEl.style.display = 'flex';
    }
    const safeUser = sanitizeClientUser(user);
    const safeWish = wish && !isClientToxicText(wish) ? wish : 'Lạy Chúa Giêsu, con tín thác vào Chúa';
    const resolvedGender = detectClientGender(safeUser, gender);
    applyGenderSpritesToStack(lane.stackId, resolvedGender);

    if (nameEl) nameEl.textContent = safeUser;
    if (actEl) actEl.textContent = actionLabel || '🕯️ Dâng nến phụng vụ';
    if (wishEl) wishEl.textContent = `“${safeWish}”`;

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
        avatarEl.textContent = String(safeUser || '✝️').trim().charAt(0).toUpperCase();
      }
    }

    const beam = document.getElementById('sacredLightBeam');
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 3800);
    }

    const haloSys = document.getElementById('christHaloSystem');
    const sacredHeart = document.getElementById('sacredHeartHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3400);
    }
    if (sacredHeart) {
      sacredHeart.classList.add('flare');
      setTimeout(() => sacredHeart.classList.remove('flare'), 3400);
    }
    particles.spawnBellWave(540, 255, 2);

    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Tín Hữu';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng nến tạ ơn Chúa';
  }

  function startWalkerOnLane(lane, item) {
    const rootEl = document.getElementById(lane.rootId);
    if (!rootEl) return;

    const uKey = String(item.user || '').trim().toLowerCase();
    if (uKey) {
      pendingCarpetWalkers.add(uKey);
      renderCongregationHall(latestHallState.lb, latestHallState.pewViewers, true);
    }

    clearLaneTimers(lane);
    lane.busyUntil = Date.now() + LANE_RITUAL_DURATION_MS;
    updateLaneAppearance(lane, item.user, item.avatar, item.actionLabel, item.wish, item.gender);

    rootEl.classList.remove('walking-up');
    void rootEl.offsetWidth;
    rootEl.classList.add('walking-up');

    setLanePose(lane, 'walk1');
    for (let step = 1; step <= 10; step++) {
      scheduleLanePose(lane, step * 180, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    lane.timers.push(
      setTimeout(() => {
        rootEl.classList.remove('walking-up');
      }, 2000)
    );
    playLanePrayerSequence(lane, 1950);

    // Sau khi hoàn tất 3.85s dâng nến trên thảm đỏ: tín hữu rời thảm đỏ để bước vào ngồi vị trí trống trong Đại Sảnh!
    lane.timers.push(
      setTimeout(() => {
        lane.busyUntil = 0;
        if (uKey) {
          pendingCarpetWalkers.delete(uKey);
          renderCongregationHall(latestHallState.lb, latestHallState.pewViewers, true);
        }
        if (!lane.isPrimary && walkerQueue.length === 0) {
          rootEl.style.display = 'none';
        }
        processWalkerQueue();
      }, LANE_RITUAL_DURATION_MS)
    );
  }

  function processWalkerQueue() {
    updateWalkerQueueBadge();
    if (walkerQueue.length === 0) return;

    const now = Date.now();
    while (walkerQueue.length > 0) {
      const freeLane = findNextFreeLane(now);
      if (!freeLane) break;
      const nextItem = walkerQueue.shift();
      updateWalkerQueueBadge();
      startWalkerOnLane(freeLane, nextItem);
    }

    if (walkerQueue.length > 0 && !walkerQueueDrainTimer) {
      walkerQueueDrainTimer = setTimeout(() => {
        walkerQueueDrainTimer = null;
        processWalkerQueue();
      }, 450);
    }
  }

  function animateWalkerOnCarpet(user, avatar, actionLabel, wish, isPriorityGift = false, gender = null) {
    const now = Date.now();
    const uKey = String(user || '').trim().toLowerCase();
    if (uKey) {
      pendingCarpetWalkers.add(uKey);
    }
    const freeLane = findNextFreeLane(now);
    if (freeLane && walkerQueue.length === 0) {
      startWalkerOnLane(freeLane, { user, avatar, actionLabel, wish, isPriorityGift, gender });
      return;
    }

    // Nếu người này đã có trong hàng chờ thì cập nhật lời cầu nguyện mới nhất thay vì xếp trùng
    const existingInQueue = walkerQueue.find((w) => String(w.user || '').trim().toLowerCase() === uKey);
    if (existingInQueue) {
      existingInQueue.actionLabel = actionLabel || existingInQueue.actionLabel;
      existingInQueue.wish = wish || existingInQueue.wish;
      existingInQueue.gender = gender || existingInQueue.gender;
      if (isPriorityGift) existingInQueue.isPriorityGift = true;
      updateWalkerQueueBadge();
      return;
    }

    // Ưu tiên Ân Nhân Tặng Quà lên đầu hàng chờ dâng nến
    const queueItem = { user, avatar, actionLabel, wish, isPriorityGift, gender };
    if (isPriorityGift) {
      const firstNonGiftIdx = walkerQueue.findIndex((w) => !w.isPriorityGift);
      if (firstNonGiftIdx === -1) {
        walkerQueue.push(queueItem);
      } else {
        walkerQueue.splice(firstNonGiftIdx, 0, queueItem);
      }
    } else {
      walkerQueue.push(queueItem);
    }

    if (walkerQueue.length > 18) {
      walkerQueue.length = 18;
    }
    processWalkerQueue();
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doPrayerMotion = true, gender = null) {
    const centralLane = WORSHIPPER_LANES[0];
    updateLaneAppearance(centralLane, user, avatar, actionLabel, wish, gender);
    if (doPrayerMotion && Date.now() >= centralLane.busyUntil) {
      clearLaneTimers(centralLane);
      const centralEl = document.getElementById('centralWorshipper');
      if (centralEl) centralEl.classList.remove('walking-up');
      playLanePrayerSequence(centralLane, 0);
    }
  }

  // 6. Cập nhật giao diện theo State từ Server
  function updateUIState(st) {
    if (!st) return;

    document.getElementById('statCandles').textContent = Number(st.totalCandles || 0).toLocaleString('vi-VN');
    document.getElementById('statGrace').textContent = Number(st.totalGrace || 0).toLocaleString('vi-VN');
    document.getElementById('statRosary').textContent = Number(st.rosaryBeads || 0).toLocaleString('vi-VN');

    renderVotiveCandles(st.activeCandles || 12);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    renderVipCushions(lb);
    renderCongregationHall(lb, st.pewViewers);

    // Cập nhật Dải Chào Đón Tín Hữu Mới Vào Phòng trên cao (giống Chùa Online)
    const welcomeNamesEl = document.getElementById('welcomeTickerNames');
    const welcomeBarEl = document.getElementById('welcomeTickerBar');
    if (welcomeNamesEl) {
      const recentList = Array.isArray(st.pewViewers) && st.pewViewers.length > 0
        ? st.pewViewers.slice(0, 4)
        : lb.slice(0, 4);
      if (recentList.length > 0) {
        const namesStr = recentList.map((u) => shortenName(u.name, 14)).join(', ');
        const newText = `Chào đón ${namesStr} hiệp thông cầu nguyện`;
        if (welcomeNamesEl.textContent !== newText) {
          welcomeNamesEl.textContent = newText;
          if (welcomeBarEl) {
            welcomeBarEl.classList.add('flash-welcome');
            setTimeout(() => welcomeBarEl.classList.remove('flash-welcome'), 1400);
          }
        }
      }
    }

    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      lbList.innerHTML = lb
        .slice(0, 4)
        .map(
          (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.grace || item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
        )
        .join('');
    }

    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    if (st.tiktok?.connected) {
      liveDot.classList.add('connected');
      liveText.textContent = `LIVE @${st.tiktok.username} • ${st.tiktok.viewerCount || 0} mắt`;
    } else if (st.tiktok?.connecting) {
      liveDot.classList.remove('connected');
      liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
    } else {
      liveDot.classList.remove('connected');
      liveText.textContent = st.settings?.autoSim
        ? 'THÁNH ĐƯỜNG HỒNG ÂN • TỰ ĐỘNG GIẢ LẬP GIÁO DÂN'
        : 'THÁNH ĐƯỜNG HỒNG ÂN • LỄ ĐÀI CHÚA GIÊSU';
    }

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? '🤖 Tự động Giả lập Giáo Dân: ĐANG BẬT'
        : '🤖 Tự động Giả lập Giáo Dân: TẮT';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }

    if (st.settings && (typeof st.settings.massAutoSchedule === 'boolean' || Array.isArray(st.settings.massScheduleHours))) {
      audio.setMassSchedule(st.settings.massAutoSchedule, st.settings.massScheduleHours);
    }

    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      ingestLiveFeedEvents(st.recentEvents);
      if (!feed.matches(':hover')) {
        renderEventFeedList();
      }
    }
  }

  const seenLiveFeedIds = new Set();
  const pinnedGiftFeedEvents = [];
  const commentFeedEvents = [];
  const announcedEventIds = new Set();

  function ingestLiveFeedEvents(events) {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (!ev || !ev.id || seenLiveFeedIds.has(ev.id)) continue;
      seenLiveFeedIds.add(ev.id);
      ev.user = sanitizeClientUser(ev.user);
      if (ev.type === 'offerGift' || ev.type === 'grandBlessing') {
        pinnedGiftFeedEvents.unshift(ev);
        if (pinnedGiftFeedEvents.length > 15) pinnedGiftFeedEvents.length = 15;
      } else if (ev.type !== 'prayRosary') {
        if (ev.wish && isClientToxicText(ev.wish)) continue;
        commentFeedEvents.unshift(ev);
        if (commentFeedEvents.length > 20) commentFeedEvents.length = 20;
      }
    }
  }

  function renderEventFeedList() {
    const feed = document.getElementById('eventFeed');
    if (!feed) return;
    const combined = [...pinnedGiftFeedEvents.slice(0, 8), ...commentFeedEvents.slice(0, 14)];
    feed.innerHTML = combined
      .map((ev) => {
        const isDone = announcedEventIds.has(ev.id);
        const isGift = ev.type === 'offerGift' || ev.type === 'grandBlessing';
        return `
          <div class="event-feed-item" data-event-id="${escapeHtml(ev.id || '')}" style="${isGift ? 'border-left: 3px solid #ffd55a; background: rgba(244,196,78,0.14);' : ''}">
            <div class="event-feed-text">${formatEventSummary(ev)}</div>
            <button
              type="button"
              class="btn-announce-tts${isDone ? ' speaking' : ''}"
              data-event-id="${escapeHtml(ev.id || '')}"
              data-user="${escapeHtml(ev.user || '')}"
              data-wish="${escapeHtml(ev.wish || '')}"
              data-gift="${escapeHtml(ev.giftName || '')}"
              data-is-gift="${isGift ? '1' : '0'}"
              data-tts="${escapeHtml(ev.suggestedTts || '')}"
              title="Bấm để giọng Mai Chi xướng tên khán giả này"
            >${isDone ? '✅ Đã xướng' : isGift ? '🎁 Xướng Quà' : '🔊 Xướng tên'}</button>
          </div>
        `;
      })
      .join('');
  }

  document.getElementById('eventFeed')?.addEventListener('mouseleave', () => {
    renderEventFeedList();
  });

  document.getElementById('eventFeed')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-announce-tts');
    if (!btn) return;
    audio.ensureContext();
    const eventId = btn.getAttribute('data-event-id') || '';
    const user = btn.getAttribute('data-user') || 'Tín Hữu';
    const wish = btn.getAttribute('data-wish') || '';
    const giftName = btn.getAttribute('data-gift') || '';
    const isGift = btn.getAttribute('data-is-gift') === '1';

    if (eventId) announcedEventIds.add(eventId);
    btn.classList.add('speaking');
    btn.textContent = '🎙️ Đang đọc...';

    const speechText = isGift
      ? `Cảm tạ ân nhân ${user} tặng quà dâng Chúa, xin Chúa chúc lành.`
      : '';

    await callRpc('church.announceViewer', {
      eventId,
      user,
      wish,
      text: speechText,
      voice: 'maichi',
      broadcast: true
    });
    btn.textContent = '✅ Đã xướng';
  });

  document.getElementById('btnSpeakCustomMaiChi')?.addEventListener('click', async () => {
    const inp = document.getElementById('inputCustomMaiChi');
    const text = inp?.value.trim();
    if (!text) return;
    audio.ensureContext();
    await callRpc('church.announceViewer', {
      text,
      voice: 'maichi',
      broadcast: true
    });
    if (inp) inp.value = '';
  });

  function formatEventSummary(ev) {
    const pts = ev.grace || ev.merit || 10;
    switch (ev.type) {
      case 'lightCandle':
        return `🕯️ <strong>${escapeHtml(ev.user)}</strong> thắp ${ev.count} ngọn nến (+${pts} ÂP)`;
      case 'prayRosary':
        return `📿 <strong>${escapeHtml(ev.user)}</strong> lần ${ev.count} hạt Mân Côi (+${pts} ÂP)`;
      case 'ringChurchBell':
        return `🔔 <strong>${escapeHtml(ev.user)}</strong> ngân Chuông Thánh Đường (+${pts} ÂP)`;
      case 'sendPrayer':
        return `🕊️ <strong>${escapeHtml(ev.user)}</strong> cầu nguyện: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandBlessing':
        return `🌹 <strong>${escapeHtml(ev.user)}</strong> tiến dâng <em>${escapeHtml(ev.giftName)}</em> (+${pts} ÂP)`;
      case 'drawBibleBlessing':
        return `📜 <strong>${escapeHtml(ev.user)}</strong> hái Lộc Thánh số ${ev.blessing?.number} (${ev.blessing?.reference})`;
      case 'requestScripture':
        return `📖 <strong>${escapeHtml(ev.user)}</strong> thỉnh <em>${escapeHtml(ev.scriptureShortTitle || 'Lời Chúa')}</em> (+${pts} ÂP)`;
      default:
        return `✨ <strong>${escapeHtml(ev.user || 'Tín hữu')}</strong> hiệp thông`;
    }
  }

  // 7. Xử lý hiệu ứng khi có Nghi Thức Phụng Vụ mới
  let blessingTimer = null;
  let grandTimer = null;

  function triggerRitualVisuals(ev) {
    if (!ev) return;
    const pts = ev.grace || ev.merit || 10;

    if (ev.ttsText && ev.type !== 'drawBibleBlessing') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi' });
    }

    switch (ev.type) {
      case 'lightCandle': {
        audio.playCandleHarp();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${pts} Ân Phúc`, 540, 860, '#fff0a8');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🕯️ Thắp ${ev.count} nến cầu nguyện (+${pts} ÂP)`, ev.wish, false, ev.gender);
        break;
      }

      case 'prayRosary': {
        audio.playRosaryBead();
        pulseHallBowing();
        particles.spawnFloatingMerit(`+${pts} Ân Phúc`, 890, 935, '#ffe57f');
        break;
      }

      case 'ringChurchBell': {
        audio.playCathedralBell(1.0);
        pulseHallBowing();
        particles.spawnBellWave(540, 480, 4);
        particles.spawnFloatingMerit(`+${pts} Ân Phúc`, 190, 935, '#fff5b8');
        updateCentralWorshipper(ev.user, ev.avatar, `🔔 Ngân Chuông Thánh Đường (+${pts} ÂP)`, ev.wish, true, ev.gender);
        break;
      }

      case 'sendPrayer': {
        audio.playCandleHarp();
        spawnWhiteDovePrayer(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${pts} Ân Phúc`, 540, 920, '#b3e5fc');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🕊️ Dâng ý nguyện (+${pts} ÂP)`, ev.wish, false, ev.gender);
        break;
      }

      case 'offerGift': {
        audio.playCandleHarp();
        audio.playCathedralBell(0.85);
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${pts} Ân Phúc`, 540, 840, '#fff5b8');
        animateWalkerOnCarpet(ev.user, ev.avatar, `🌹 Dâng ${ev.giftName} (+${pts} ÂP)`, ev.wish, true, ev.gender);
        break;
      }

      case 'grandBlessing': {
        audio.playCathedralBell(1.2);
        setTimeout(() => audio.playCathedralBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandBlessingBanner(ev.user, ev.giftName, pts);
        animateWalkerOnCarpet(ev.user, ev.avatar, `👼 ${ev.giftName} (+${pts} ÂP)`, ev.wish, true, ev.gender);
        break;
      }

      case 'requestScripture': {
        audio.playCandleHarp();
        audio.playCathedralBell(0.8);
        pulseHallBowing();
        particles.spawnBellWave(540, 255, 3);
        particles.spawnFloatingMerit(`+${pts} Ân Phúc Lời Chúa`, 540, 840, '#fff0a8');
        animateWalkerOnCarpet(
          ev.user,
          ev.avatar,
          `📖 Thỉnh ${ev.scriptureShortTitle || 'Lời Chúa'} (+${pts} ÂP)`,
          ev.wish,
          false,
          ev.gender
        );
        if (ev.scriptureId) {
          audio.selectScriptureById(ev.scriptureId, 0);
        }
        break;
      }

      case 'drawBibleBlessing': {
        audio.playBlessingChime();
        updateCentralWorshipper(
          ev.user,
          ev.avatar,
          `📜 Đang hái Lộc Thánh Lời Chúa...`,
          `Tín hữu ${ev.user} đang thành tâm đón nhận Lời Chúa...`,
          false,
          ev.gender
        );
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          onStart: () => {
            audio.playCandleHarp();
            showBibleBlessingModal(ev.user, ev.blessing);
            updateCentralWorshipper(
              ev.user,
              ev.avatar,
              `📜 Lộc Thánh #${ev.blessing?.number} (${ev.blessing?.reference})`,
              ev.blessing?.meaning || '',
              true,
              ev.gender
            );
          },
          onEnd: () => {
            clearTimeout(blessingTimer);
            blessingTimer = setTimeout(() => {
              document.getElementById('blessingModal')?.classList.remove('visible');
            }, 1800);
          }
        });
        break;
      }
    }
  }

  function spawnWhiteDovePrayer(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    const card = document.createElement('div');
    card.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    card.style.left = `${leftPos}px`;
    card.innerHTML = `
      <div class="sky-lantern-user">✝️ ${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(card);
    setTimeout(() => {
      card.remove();
    }, 10600);
  }

  function showBibleBlessingModal(user, blessing) {
    if (!blessing) return;
    const modal = document.getElementById('blessingModal');
    document.getElementById('blessingRankBadge').textContent = `${blessing.rank.toUpperCase()} • ${blessing.reference}`;
    document.getElementById('blessingTitle').textContent = `Lộc Thánh Số ${blessing.number} — ${blessing.title}`;
    document.getElementById('blessingDevotee').textContent = `Tín hữu đón nhận Lời Chúa: ${user}`;
    document.getElementById('blessingPoem').textContent = blessing.poem;
    document.getElementById('blessingMeaning').textContent = `Suy niệm chúc lành: ${blessing.meaning}`;

    modal.classList.add('visible');
    clearTimeout(blessingTimer);
    blessingTimer = setTimeout(() => {
      modal.classList.remove('visible');
    }, 15000);
  }

  document.getElementById('blessingModal')?.addEventListener('click', () => {
    document.getElementById('blessingModal').classList.remove('visible');
  });

  function showGrandBlessingBanner(user, giftName, grace) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = `👼 ${giftName.toUpperCase()} 👼`;
    document.getElementById('grandSub').textContent = `Ân Nhân ${user} • Hồng Ân Thiên Chúa (+${grace} ÂP)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsQuery = isObsMode ? '?workflow=church&mode=obs&v=13' : '?workflow=church&v=13';
    ws = new WebSocket(`${proto}//${window.location.host}/ws${wsQuery}`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.method === 'church.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'church.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) triggerRitualVisuals(msg.params.event);
        } else if (msg.method === 'church.ttsPlay' || msg.method === 'tts.play') {
          if (msg.params?.user) {
            updateCentralWorshipper(
              msg.params.user,
              '',
              '🎙️ Đang xướng tên hiệp thông cầu nguyện',
              msg.params.wish || msg.params.text || 'Tạ ơn Chúa. Amen.'
            );
          }
          if (msg.params?.url) {
            audio.ttsEnabled = true;
            if (audio.ttsVolume < 0.5) audio.ttsVolume = 0.88;
            audio.enqueueTts(msg.params.text || 'Tạ ơn Chúa', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url
            });
          }
        } else if (msg.method === 'church.scriptureControl') {
          const p = msg.params || {};
          if (typeof p.enabled === 'boolean' && !isObsMode) {
            audio.setScriptureEnabled(p.enabled);
          }
          if (p.voice && p.voice !== audio.scriptureVoice) {
            audio.setScriptureVoice(p.voice);
          }
          if (typeof p.volume === 'number') {
            audio.setScriptureVolume(p.volume);
          }
          if (p.scriptureId && p.scriptureId !== audio.getCurrentScripture()?.id) {
            audio.selectScriptureById(p.scriptureId, p.verseIndex || 0);
          } else if (p.action === 'nextVerse') {
            audio.nextScriptureVerse();
          } else if (p.action === 'prevVerse') {
            audio.prevScriptureVerse();
          }
          renderScriptureScrollBanner(audio.getScriptureStatus());
        } else if (msg.method === 'church.massControl') {
          const p = msg.params || {};
          if (typeof p.massAutoSchedule === 'boolean' || Array.isArray(p.massScheduleHours)) {
            audio.setMassSchedule(p.massAutoSchedule, p.massScheduleHours);
          }
          if (Date.now() - lastLocalMassControlAt >= 1200) {
            if (p.action === 'start') {
              audio.startMassLiturgy(p.partIndex || 0, p.stepIndex);
            } else if (p.action === 'stop') {
              audio.stopMassLiturgy(true);
            } else if (p.action === 'nextPart') {
              audio.nextMassPart();
            } else if (p.action === 'nextStep') {
              audio.nextMassStep();
            } else if (p.action === 'prevStep') {
              audio.prevMassStep();
            }
          }
          renderScriptureScrollBanner(audio.getScriptureStatus());
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const res = await fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data?.result?.state) updateUIState(data.result.state);
    if (data?.result?.event) triggerRitualVisuals(data.result.event);
    return data;
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Maria_Thảo';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Xin Chúa chúc lành cho gia đình luôn bình an, mạnh khỏe và tràn đầy hồng ân';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD
  document.getElementById('candleAltarZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.lightCandle', { user, count: 3, wish });
  });

  document.getElementById('cardCandle')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.lightCandle', { user, count: 3, wish });
  });

  document.getElementById('cardPrayer')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.sendPrayer', { user, wish });
  });

  document.getElementById('cardLily')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.offerGift', {
      user,
      giftType: 'lily',
      coins: 20,
      giftName: 'Bó Hoa Huệ Trắng Tinh Khôi',
      wish
    });
  });

  document.getElementById('rosaryStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('church.prayRosary', { user, count: 1 });
  });

  document.getElementById('churchBellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.ringChurchBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('bibleBlessingStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.drawBibleBlessing', { user, topic: wish });
  });

  document.getElementById('scriptureStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    const list = audio.scriptures || [];
    const nextIdx = (audio.scriptureIndex + 1) % Math.max(1, list.length);
    const nextSc = list[nextIdx];
    callRpc('church.requestScripture', {
      user,
      scriptureId: nextSc ? nextSc.id : '',
      wish: nextSc ? `Hiệp ý lắng nghe ${nextSc.shortTitle}` : 'Hiệp ý lắng nghe Lời Chúa'
    });
  });

  // Các nút điều khiển Nghi Thức Hành Lễ Nhà Thờ (12–15 Phút) trên Quick Dock
  document.getElementById('btnStartMassNow')?.addEventListener('click', () => {
    lastLocalMassControlAt = Date.now();
    audio.ensureContext();
    audio.startMassLiturgy(0);
    callRpc('church.massControl', { action: 'start', partIndex: 0 });
  });

  document.getElementById('btnStopMassNow')?.addEventListener('click', () => {
    lastLocalMassControlAt = Date.now();
    audio.ensureContext();
    audio.stopMassLiturgy(true);
    callRpc('church.massControl', { action: 'stop' });
  });

  document.getElementById('btnNextMassPart')?.addEventListener('click', () => {
    lastLocalMassControlAt = Date.now();
    audio.ensureContext();
    audio.nextMassPart();
    callRpc('church.massControl', { action: 'nextPart' });
  });

  document.getElementById('btnNextMassStep')?.addEventListener('click', () => {
    lastLocalMassControlAt = Date.now();
    audio.ensureContext();
    audio.nextMassStep();
    callRpc('church.massControl', { action: 'nextStep' });
  });

  document.getElementById('btnToggleMassSchedule')?.addEventListener('click', () => {
    audio.ensureContext();
    const nextState = !audio.massAutoSchedule;
    audio.setMassSchedule(nextState);
    callRpc('church.massControl', { action: 'setSchedule', massAutoSchedule: audio.massAutoSchedule });
  });

  // Các nút điều khiển Đọc Lời Chúa trên Quick Dock
  document.getElementById('btnToggleScripture')?.addEventListener('click', () => {
    const wasPlaying = audio.scripturePlaying;
    audio.ensureContext();
    if (!wasPlaying) {
      audio.setScriptureEnabled(true);
    } else {
      audio.setScriptureEnabled(!audio.scriptureEnabled);
    }
    callRpc('church.controlScripture', { enabled: audio.scriptureEnabled });
  });

  document.getElementById('btnRpcRequestScripture')?.addEventListener('click', () => {
    const { user } = getFormInput();
    const selectedId = document.getElementById('selectScriptureDeck')?.value || '';
    callRpc('church.requestScripture', {
      user,
      scriptureId: selectedId
    });
  });

  document.getElementById('selectScriptureDeck')?.addEventListener('change', (e) => {
    const scriptureId = e.target.value;
    audio.ensureContext();
    audio.selectScriptureById(scriptureId, 0);
    callRpc('church.controlScripture', { scriptureId, verseIndex: 0 });
  });

  document.getElementById('selectScriptureVoice')?.addEventListener('change', (e) => {
    const voice = e.target.value;
    audio.ensureContext();
    audio.setScriptureVoice(voice);
    callRpc('church.controlScripture', { voice });
  });

  document.getElementById('btnScripturePrev')?.addEventListener('click', () => {
    audio.ensureContext();
    audio.prevScriptureVerse();
  });

  document.getElementById('btnScriptureNext')?.addEventListener('click', () => {
    audio.ensureContext();
    audio.nextScriptureVerse();
  });

  const sliderScriptureVol = document.getElementById('sliderScriptureVol');
  const valScriptureVol = document.getElementById('valScriptureVol');
  if (sliderScriptureVol && valScriptureVol) {
    const initPct = Math.round(audio.scriptureVolume * 100);
    sliderScriptureVol.value = String(initPct);
    valScriptureVol.textContent = `${initPct}%`;
    sliderScriptureVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valScriptureVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setScriptureVolume(pct / 100);
    });
    sliderScriptureVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('church.controlScripture', { volume: +(pct / 100).toFixed(2) });
    });
  }

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcSeatViewer')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.lightCandle', {
      user,
      count: 1,
      wish: wish || 'Đã vào ghế Thánh Đường hiệp thông cầu nguyện',
      readTts: false
    });
  });

  document.getElementById('btnRpcCandle')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.lightCandle', { user, count: 3, wish });
  });

  document.getElementById('btnRpcDove')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.sendPrayer', { user, wish });
  });

  document.getElementById('btnRpcRosary')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('church.prayRosary', { user, count: 5 });
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.ringChurchBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('btnRpcBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.drawBibleBlessing', { user, topic: wish });
  });

  document.getElementById('btnRpcGiftLily')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.offerGift', {
      user,
      giftType: 'lily',
      coins: 20,
      giftName: 'Bó Hoa Huệ Trắng Tinh Khôi',
      wish
    });
  });

  document.getElementById('btnRpcGrandBlessing')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('church.grandBlessing', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Ánh Sáng Phục Sinh & Phép Lành Trọng Thể',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) return;
    callRpc('church.connect', { username });
  });

  let autoSimState = false;
  document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
    autoSimState = !autoSimState;
    callRpc('church.setAutoSim', { enabled: autoSimState });
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `🎙️ Giọng Đọc: ${audio.ttsEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.startSacredAmbience();
    } else {
      audio.stopSacredAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `🎵 Thánh Ca: ${audio.bgMusicEnabled ? 'BẬT' : 'TẮT'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
  });

  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('church.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('church.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  const CLIENT_STANDALONE_TOKENS = [
    'đm', 'dm', 'đmm', 'dmm', 'đkm', 'dkm', 'đcm', 'dcm', 'đcmm', 'dcmm', 'đklm',
    'vcl', 'vl', 'vkl', 'vler', 'vll', 'vcc', 'vc', 'cc', 'cl', 'clm', 'cmm', 'cml',
    'đéo', 'deo', 'đếch', 'đệch', 'đệt', 'đjt', 'djt', 'dit', 'đit', 'địt',
    'lồn', 'lon', 'loz', 'lờ', 'cặc', 'cac', 'cak', 'cẹc', 'buồi', 'buoi',
    'dái', 'cứt', 'cut', 'đái', 'đĩ', 'điếm', 'phò', 'cave', 'chịch', 'xoạc',
    'nứng', 'dâm', 'sục', 'đụ', 'đù', 'đụmá', 'đụmẹ', 'đmá', 'đmẹ', 'mịa',
    'clgt', 'wtf', 'wth', 'lol', 'lmao', 'ngu', 'đần', 'cút', 'bịp', 'sex', 'porn', 'jav',
    'haha', 'hehe', 'hihi', 'ohehe', 'hoho', 'kaka', 'sặc'
  ];
  const CLIENT_SPACED_PHRASES = [
    'bóp dái', 'đá dái', 'vãi l', 'vãi c', 'vãi đ', 'vãi chưởng', 'cái lồn', 'con cặc',
    'đầu buồi', 'ăn cứt', 'chi cứt', 'cục cứt', 'con đĩ', 'con phò', 'thằng chó', 'con chó',
    'chó đẻ', 'óc chó', 'óc lợn', 'súc vật', 'khốn nạn', 'mẹ kiếp', 'mẹ mày', 'má mày',
    'bố mày', 'cha mày', 'chết tiệt', 'chết mẹ', 'hiếp dâm', 'ấu dâm', 'khiêu dâm',
    'i cư', 'kimochi', 'yamate', 'yamete', 'tài xỉu', 'cá độ', 'nổ hũ', 'nhà cái',
    'lừa đảo', 'lừa à', 'telegram', 'bố là trùm', 'hết trò', 'làm trò', 'trò hề',
    'câu view', 'câu like', 'nhảm nhí', 'xàm xí', 'tào lao', 'vớ vẩn', 'rảnh háng',
    'báng bổ', 'phỉ báng', 'dị giáo', 'tà đạo', 'giả tạo', 'diễn sâu', 'như thật',
    'chịu đấy', 'chịu luôn', 'vụ này luôn', 'hết chùa', 'sang nhà thờ', 'chúa giả',
    'phật giả', 'tẩy chay', 'rác rưởi', 'ủa alo', 'ủa rồi', 'lạy luôn'
  ];
  const CLIENT_COMPACT_SUBS = [
    'bópdái', 'bopdai', 'đádái', 'dadai', 'đầubuồi', 'daubuoi', 'cáilồn', 'concặc',
    'ăncứt', 'chicứt', 'cụccứt', 'conđĩ', 'conphò', 'chóđẻ', 'ócchó', 'súcvật',
    'khốnnạn', 'mẹkiếp', 'mẹmày', 'bốmày', 'chếttiệt', 'chếtmẹ', 'hiếpdâm', 'ấudâm',
    'xnxx', 'xvideos', 'pornhub', 'yamate', 'yamete', 'kimochi', 'tàixỉu', 'nổhũ',
    'kubet', 'sunwin', 'go88', 'lừađảo', 'telegram', 'bốlàtrùm', 'đụmá', 'đụmẹ',
    'địtmẹ', 'vãilồn', 'vãicặc', 'hếttrò', 'nhưthật', 'chịuđấy', 'hếtchùa',
    'sangnhàthờ', 'ohehe'
  ];
  const CLIENT_MOCK_EMOJI_RE = /[🤣😂😆😜🤪🤡💩🖕🤮🤢]/u;

  function isClientToxicText(rawText) {
    if (!rawText) return true;
    const s = String(rawText).trim();
    if (!s || s.startsWith('@') || CLIENT_MOCK_EMOJI_RE.test(s) || /\?\s*\?+/.test(s)) return true;
    const lower = s.normalize('NFKC').normalize('NFC').toLowerCase();
    const words = lower.replace(/[^0-9a-zA-ZÀ-ỹĂăĐđĨĩŨũƠơƯư]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!words) return true;
    const spaced = ` ${words} `;
    const compact = words.replace(/\s+/g, '');
    const collapsedSpaced = ` ${words.replace(/(.)\1{2,}/g, '$1')} `;
    const collapsedCompact = compact.replace(/(.)\1{2,}/g, '$1');
    for (const tk of CLIENT_STANDALONE_TOKENS) {
      const needle = ` ${tk} `;
      if (spaced.includes(needle) || collapsedSpaced.includes(needle)) return true;
    }
    for (const p of CLIENT_SPACED_PHRASES) {
      const needle = ` ${p} `;
      if (spaced.includes(needle) || collapsedSpaced.includes(needle)) return true;
    }
    for (const sub of CLIENT_COMPACT_SUBS) {
      if (compact.includes(sub) || collapsedCompact.includes(sub)) return true;
    }
    return false;
  }

  function sanitizeClientUser(name) {
    const s = String(name || '').trim();
    if (!s || isClientToxicText(s)) return 'Tín Hữu Tâm Thành';
    return s;
  }

  function shortenName(name, maxLen = 13) {
    const str = sanitizeClientUser(name);
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
