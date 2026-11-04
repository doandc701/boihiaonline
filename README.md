# Bơi Hia Dứt Cạn 🍻

Quán nhậu 3D trên web, nhiều người thật ngồi chung bàn. Ngoài quán giao tiếp bằng hành động (dzô, rót, vẫy chào, vỗ tay, mời ly). Ngồi chung bàn thì chat được với nhau.

## Chạy

```bash
npm install
npm start      # http://localhost:8000
npm run dev    # khi phát triển: sửa file là tự cập nhật
```

Mở nhiều tab hoặc nhiều máy trong cùng mạng là thấy nhau.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `shared/world.js` | Cấu hình chung: cơ sở, bàn ghế, thực đơn, giá, luật chơi |
| `shared/songs.js` | Danh sách bài karaoke |
| `server/server.js` | Server HTTP + WebSocket |
| `public/` | Giao diện (Three.js) |

## Quán

- **3 tầng, 40 bàn, 163 ghế, tối đa 150 khách mỗi cơ sở.**
  - Tầng 1: vỉa hè, trong nhà, quầy thu ngân, bếp, bãi giữ xe.
  - Tầng 2: phòng riêng (khoá được) và phòng VIP.
  - Tầng 3: sân thượng, sân khấu karaoke.
- Lên xuống tầng bằng thang máy. Mỗi tầng có WC nam/nữ.
- Sáng/tối theo giờ thật ở Việt Nam. Bãi biển có người đi dạo và chơi trò chơi.

## Luật chơi

- **Ngồi bàn:** click vào bàn để ngồi ghế trống.
- **Dzô:** một người dzô là cả bàn dzô theo, ly ai rỗng thì tự rót đầy (tính vào hoá đơn). Bấm 🤝 (phím 8) chọn người cùng bàn để mời, đồng ý là cùng dzô.
- **Chat:** kênh 🌏 Cả quán ai trong cơ sở cũng thấy, kênh 🪑 Bàn chỉ người cùng bàn thấy.
- **Thoại:** chọn kênh 🎧 Bàn hoặc Cả quán phía trên khung chat, bấm 🎙️ (phím V) để nói. Có thể tắt tiếng từng người trong danh sách 👥.
- **Karaoke:** lên sân khấu chọn bài và xếp hàng. Người đứng dưới bấm 💃 để nhảy theo.
- **Giờ vàng:** cứ 10 phút, cả quán cùng dzô.
- **Ví tiền:** mỗi người vào được 1.000.000đ ảo. Hết tiền thì ra biển câu cá (đứng sát mép nước) hoặc nhặt cua, ốc, vỏ sò, chai trôi dạt trên bãi rồi mang ra sạp Bà Tư (chân bậc xuống biển) bán. Cá hiếm (cá mú, tôm hùm) được giá cao.
- **Tính tiền:**
  - Bàn phải gọi món rồi mới tính tiền được.
  - Một người trả cho cả bàn. Ai trả trước thì người khác không trả được nữa.

## Cấu hình server

| Biến môi trường | Ý nghĩa |
|---|---|
| `PORT` | Cổng (mặc định 8000) |
| `ROOMS` | Cơ sở mở trên server này, ví dụ `quan-1` |
| `ALLOWED_ORIGINS` | Domain trang web được phép kết nối |
| `TRUST_PROXY=1` | Khi chạy sau reverse proxy |
| `MAX_CONN_PER_IP` | Số kết nối tối đa mỗi IP |
| `WALLET_FILE` | File lưu ví người chơi (mặc định `data/wallets.json`) |
| `YOUTUBE_API_KEY` | Không bắt buộc. Có key thì tìm bài trên YouTube bằng API chính thức (ổn định hơn) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Lưu ví, hoá đơn, mồi trên bàn lên Upstash Redis để deploy lại không mất. Không có thì lưu file `data/state.json` |
| `HOLD_MS` | Thời gian giữ chỗ bàn chưa trả tiền, mặc định 180000 (3 phút) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Bật thoại (nói chuyện bằng giọng) qua LiveKit. Thiếu thì ẩn thoại |

## Triển khai

- **Trang web:** Vercel (`vercel.json`).
- **Server:** Render, mỗi cơ sở một server (`render.yaml`).
- Địa chỉ server từng cơ sở khai báo ở `ROOMS` trong `shared/world.js`.

## Ủng hộ

Nút 🍺 **Bao chủ quán một ly** hiện số tài khoản và mã QR. Đổi thông tin ở `DONATE` trong `public/game.js` và ảnh `public/donate-qr.png`.
