# ⛪🪷 TikTok Live Temple & Church RPC — Hệ Thống Livestream Tâm Linh Tương Tác Kép (9:16)

Hệ thống phát trực tiếp tương tác (**Interactive TikTok Live Stream & JSON-RPC 2.0**) chuẩn khung dọc **9:16 (`1080×1920`)** dành cho **OBS Studio / TikTok Live Studio**, vận hành song song **2 không gian tâm linh độc lập** trên cùng một Server Node.js/Bun.js siêu nhẹ, tích hợp giọng đọc AI tiếng Việt **ZeroTTS (`zeroweight-ai/ZeroTTS` v8)**:

1. **⛪ Thánh Đường Hồng Ân Online (`/church` & `/church-admin`)**:
   - **Mô phỏng Nghi Thức Hành Lễ Thánh Đường Công Giáo Thực Tế (12–15 phút, 4 Phần Phụng Vụ, 48 Bước — `MASS_LITURGY`)**:
     * **Phần I — Nghi Thức Đầu Lễ & Sám Hối**: Thông báo chuẩn bị lễ, Chuông Thánh Đường 3 hồi, Làm Dấu Thánh Giá, Kinh Thú Nhận (2 phần), Kinh Thương Xót, Kinh Vinh Danh (2 phần), Lời Tổng Nguyện.
     * **Phần II — Phụng Vụ Lời Chúa**: Bài Đọc Sách Thánh (2 phần), Đáp Ca Thánh Vịnh 23, Tung Hô Tin Mừng (*Alleluia*), Công bố Tin Mừng Thánh Gioan (2 phần), Giảng Lễ suy niệm (2 phần), Kinh Tin Kính (2 phần), Lời Nguyện Tín Hữu (tự động xướng danh các tín hữu thật đang hiện diện trong phòng LIVE).
     * **Phần III — Phụng Vụ Thánh Thể**: Dâng Lễ Vật (hương trầm bay lên), Kinh Thánh Thánh Thánh, **Truyền Phép Mình Máu Thánh Chúa** (3 hồi Chuông Bạc Cung Thánh `playSanctusBell` + toàn bộ Lễ Sinh và Cộng đoàn cúi rạp thờ lạy), Tung Hô Mầu Nhiệm Đức Tin, Kinh Lạy Cha (2 phần), Nghi Thức Chúc Bình An, Kinh Chiên Thiên Chúa, Kinh Rước Lễ Thiêng Liêng (2 phần).
     * **Phần IV — Nghi Thức Kết Lễ & Phép Lành Trọng Thể**: Lời Nguyện Hiệp Lễ, **Phép Lành Trọng Thể** (Cha Chủ Tế giơ tay ban phép lành + mưa hoa hồng ân rơi khắp Cung Thánh), Giải Tán và tự động chuyển mượt mà về **Chế độ Đọc Kinh Thường**.
   - **Lịch Tự Động Mở Lễ Đúng Giờ (`5h, 6h, 7h, 12h, 17h, 18h, 19h, 20h, 21h, 22h`) + Thông Báo Trước 1 Phút**: Tự động phát thông báo mời cộng đoàn chuẩn bị tâm hồn vào phút `58–59` trước giờ lễ và tự động khởi lễ đúng giờ.
   - **Chuẩn Hóa 2 Giọng Đọc Tự Nhiên Nhất**:
     * **Cha Chủ Tế (`huuduc`)**: Giọng nam trầm ấm, uy nghiêm đứng chính diện trước Bàn Thờ Chúa với 4 tư thế chuyển động (`orans`, `folded`, `elevation`, `blessing`).
     * **Ca Trưởng & Cộng Đoàn (`kimoanh`)**: Giọng nữ Kim Oanh trang nghiêm đảm nhiệm phần Đọc Sách Thánh, Đáp Ca, Dẫn Lễ và Cộng đoàn đồng thanh thưa đáp.
   - **Nhận Diện Giới Tính Nam/Nữ & Lễ Phục Công Giáo 3D Tự Động**:
     * **Nam**: Áo lễ ca đoàn trắng trang nghiêm choàng khăn xanh Mẹ Maria / đỏ Thánh Tâm / vàng hoàng gia.
     * **Nữ**: Áo dài trắng truyền thống đội khăn voan ren trắng Nhà Thờ, chắp tay cầu nguyện.
   - **Thảm Đỏ Dâng Nến 3 Làn Song Song & Đại Sảnh 48 Chỗ Ngồi**:
     * Khán giả vào xem, thả tim, bình luận hoặc tặng quà sẽ bước dọc thảm đỏ lên trước Bàn Thờ Chúa Giêsu thắp nến, cúi mình cầu nguyện rồi tự động vào ngồi tại hàng ghế gỗ hai bên (8 ghế danh dự đầu Cung Thánh + 40 ghế giáo dân).

2. **🪷 Chùa Linh Ứng Online (`/live` & `/admin`)**:
   - 🔥 **Thắp hương & Đảnh lễ Tam Bái (8-Frame Walking & Prostration)** trên Chánh Điện **Đức Phật A Di Đà**.
   - 🏮 **Thả Đèn Hoa Đăng / Sớ Cầu Nguyện**, 🎋 **Xin Xăm / Gieo Quẻ Đầu Năm**, 🪵 **Gõ Mõ & 🔔 Thỉnh Đại Hồng Chung**.
   - 📜 **Bảng Vàng Công Đức & 6 Đệm Quỳ VIP** trước bàn thờ Phật cùng chế độ **Giảng Kinh Phật & Pháp Thoại Tự Động (`sutras.js`)**.

---

## ⚡ Kiến Trúc & Cải Tiến Kỹ Thuật Nổi Bật (`v2.0`)

- **ZeroTTS Worker `v8_full` Chống Cắt Ngắn Câu Kinh & Lời Cầu Nguyện Dài (`tts_worker.py`)**:
  - Chuyển đổi tự động các dấu `:`, `;`, `—`, `–`, `-` thành dấu phẩy `, ` giữ nhịp nghỉ tự nhiên.
  - Hàm `split_into_speakable_segments(norm_text)` tách từng câu độc lập (`split_sentences`), gom các vế dấu phẩy thành cụm tự nhiên $\le 165$ ký tự, gộp đuôi `", Amen."` liền hơi và khử 100% dấu `.` / `!` / `?` nằm giữa thân segment — ngăn chặn triệt để lỗi bộ giải mã ZeroTTS phát tín hiệu `<eoa>` sớm làm cụt đuôi câu kinh.
  - Nâng giới hạn văn bản lên `550–650` ký tự và ghép nối các cụm âm thanh bằng khoảng lặng mềm `0.16s` (`concat_with_silence`).
- **Hệ Thống Hàng Đợi Ba Tầng & Thăng Hạng Ưu Tiên Tức Thì (`server.js`)**:
  - Tách biệt 3 hàng đợi: `highQueue` (Bước lễ đang phát / Admin bấm đọc ngay), `lowQueue` (Lời cầu nguyện tự động), và `prewarmQueue` (Pre-warm tuần tự 48 bước Thánh Lễ & Kinh Thánh).
  - Cơ chế **Priority Promotion**: Khi một câu đang nằm trong `prewarmQueue` được gọi trực tiếp với `priority: 'high'`, job đó được rút ngay lên đầu `highQueue`, đảm bảo Bước 0 Đầu Lễ phát tức thì không bao giờ bị nghẽn.
- **Đọc Trọn Vẹn Lời Cầu Nguyện Dài (`public/church-admin.html` & `server.js`)**:
  - Nâng giới hạn tên tín hữu lên `38` ký tự và lời cầu nguyện lên **180 ký tự** (cắt thông minh theo khoảng trắng từ gần nhất, không cắt ngang từ), kèm `guardTimer` `45s–55s` và bộ giữ tham chiếu `activeTtsAudios` chống Garbage Collection khi phát câu dài.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Nhanh

### 1. Yêu cầu hệ thống
- **Node.js** (`>= 18`) hoặc **Bun.js** (`>= 1.1`)
- **Python `3.10+`** & môi trường `.venv` đã cài đặt `zerotts`

### 2. Cài đặt thư viện
```bash
npm install
# Tạo môi trường Python .venv và cài đặt ZeroTTS
uv venv .venv
uv pip install --python .venv/Scripts/python.exe zerotts pillow
```

### 3. Khởi chạy Server
```bash
npm start
# Hoặc chạy trực tiếp:
node server.js
```

Mặc định server lắng nghe tại cổng `3000`:
- **⛪ Thánh Đường Hồng Ân (Live + Quick Dock)**: [http://localhost:3000/church](http://localhost:3000/church)
- **⛪ Thánh Đường OBS 9:16 Sạch (`1080×1920`)**: [http://localhost:3000/church?obs=1](http://localhost:3000/church?obs=1)
- **⛪ Bảng Điều Khiển Admin Nhà Thờ & Duyệt Đọc TTS**: [http://localhost:3000/church-admin](http://localhost:3000/church-admin)
- **🪷 Chùa Linh Ứng (Live + Quick Dock)**: [http://localhost:3000/live](http://localhost:3000/live)
- **🪷 Chùa Linh Ứng OBS 9:16 Sạch (`1080×1920`)**: [http://localhost:3000/live?obs=1](http://localhost:3000/live?obs=1)
- **🪷 Bảng Điều Khiển Admin Chùa**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔌 Giao Thức JSON-RPC 2.0 (`POST /rpc` & `ws://localhost:3000/ws`)

### Các phương thức RPC Nhà Thờ (`church.*`):
- `church.getState`: Lấy trạng thái Thánh Đường, Bảng Vàng Ân Phúc, danh sách giáo dân và tiến độ Thánh Lễ.
- `church.massControl`: Điều khiển Nghi Thức Hành Lễ 4 Phần (`action`: `'start'` | `'stop'` | `'nextPart'` | `'nextStep'` | `'prevStep'` | `'setSchedule'`, `partIndex`, `stepIndex`, `massAutoSchedule`, `massScheduleHours`).
- `church.getMassLiturgy`: Lấy toàn bộ kịch bản 4 Phần (48 bước) của `MASS_LITURGY`.
- `church.lightCandle`: Thắp nến phụng vụ & bước lên thảm đỏ cầu nguyện (`user`, `count`, `wish`, `gender`).
- `church.sendPrayer`: Dâng ý nguyện & thả chim bồ câu trắng (`user`, `wish`).
- `church.prayRosary`: Lần hạt Mân Côi (`user`, `count`).
- `church.ringChurchBell`: Thỉnh Chuông Thánh Đường ngân vang (`user`, `count`, `wish`).
- `church.drawBibleBlessing`: Đón nhận Lộc Thánh Lời Chúa (`user`, `topic`).
- `church.offerGift` / `church.grandBlessing`: Dâng Hoa Huệ Trắng / Đại Lễ Ánh Sáng Phục Sinh.
- `church.controlScripture`: Điều khiển Đọc Kinh Thánh Thường (`enabled`, `voice`, `volume`, `scriptureId`, `verseIndex`).
- `church.announceViewer` / `church.speak`: Đọc lời cảm tạ và lời cầu nguyện dài (tối đa 180 ký tự) của tín hữu.
- `church.connect` / `church.disconnect`: Kết nối / Ngắt kết nối phòng TikTok Live Nhà Thờ.

### Các phương thức RPC Chùa (`temple.*` & `live.*`):
- `temple.getState`, `temple.burnIncense`, `temple.sendPrayer`, `temple.drawFortune`, `temple.strikeWoodenFish`, `temple.ringBell`, `temple.offerGift`, `temple.grandCeremony`, `temple.controlSutra`, `temple.announceViewer`, `live.connect`, `live.disconnect`.

---

## 📁 Cấu Trúc Thư Mục

```text
├── server.js                  # Node/Bun HTTP + WebSocket JSON-RPC 2.0 Server (Chùa + Nhà Thờ + ZeroTTS Manager)
├── tts_worker.py              # Tiến trình Python ZeroTTS v8_full (Tách câu thông minh, khử <eoa> sớm, chống clipping)
├── data/
│   ├── merit-state.json       # Lưu trữ bền vững Bảng Vàng Công Đức Chùa
│   ├── church-state.json      # Lưu trữ bền vững Bảng Vàng Ân Phúc & Trạng thái Thánh Đường
│   └── tts-cache/             # Bộ đệm file âm thanh WAV đã tổng hợp
├── public/
│   ├── church.html            # Giao diện Thánh Đường Chúa Giêsu 9:16 + Sân khấu Cung Thánh Hành Lễ + Quick Dock
│   ├── church-admin.html      # Bảng Quản Trị Nhà Thờ & Hàng Đợi Xướng Tên / Cầu Nguyện Khán Giả
│   ├── index.html             # Giao diện Chánh Điện Chùa 9:16 + Quick Dock
│   ├── admin.html             # Bảng Quản Trị JSON-RPC 2.0 Chùa
│   ├── css/
│   │   ├── church.css         # Stylesheet Thánh Đường 9:16, Cung Thánh Hành Lễ & Đại Sảnh 48 chỗ
│   │   └── live.css           # Stylesheet Chánh Điện Chùa 9:16
│   ├── js/
│   │   ├── mass-liturgy.js    # Kịch bản Thánh Lễ Công Giáo Trọng Thể 4 Phần (48 bước, giọng huuduc & kimoanh)
│   │   ├── scriptures.js      # Bộ Kinh Thánh, Thánh Vịnh & Suy Niệm Lời Chúa
│   │   ├── church-audio.js    # Động cơ âm thanh Thánh Đường, Chuông Bạc Truyền Phép, Đạo diễn Hành Lễ & Lịch tự động
│   │   ├── church-live.js     # Điều phối Sân khấu Cung Thánh, 3 làn dâng nến, nhận diện Nam/Nữ & Đại Sảnh 48 ghế
│   │   ├── sutras.js          # Bộ Kinh Phật & Pháp Thoại
│   │   ├── audio.js           # Động cơ âm thanh Chùa & Pháp khí Web Audio
│   │   ├── live.js            # Điều phối Chánh Điện Chùa & Đạo Tràng 40 chỗ
│   │   └── particles.js       # 30 FPS Offscreen-Sprite Particle Engine
│   └── assets/                # Hình nền Cung Thánh/Chánh Điện, Sprite Cha Chủ Tế, Giáo dân Nam/Nữ 3D & Phật tử
└── docs/
    ├── demo/                  # Hình ảnh chụp màn hình demo
    └── superpowers/specs/     # Tài liệu thiết kế kỹ thuật (Design Spec)
```
