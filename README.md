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
- **Dzô:** một người dzô là cả bàn dzô theo. Bấm 🤝 (phím 8) chọn người cùng bàn để mời, đồng ý là cùng dzô.
- **Chat:** kênh 🌏 Cả quán ai trong cơ sở cũng thấy, kênh 🪑 Bàn chỉ người cùng bàn thấy.
- **Karaoke:** lên sân khấu chọn bài và xếp hàng. Người đứng dưới bấm 💃 để nhảy theo.
- **Giờ vàng:** cứ 10 phút, cả quán cùng dzô.
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
| `YOUTUBE_API_KEY` | Tự tìm video karaoke trên YouTube |

## Triển khai

- **Trang web:** Vercel (`vercel.json`).
- **Server:** Render, mỗi cơ sở một server (`render.yaml`).
- Địa chỉ server từng cơ sở khai báo ở `ROOMS` trong `shared/world.js`.

## Ủng hộ

Nút 🍺 **Bao chủ quán một ly** hiện số tài khoản và mã QR. Đổi thông tin ở `DONATE` trong `public/game.js` và ảnh `public/donate-qr.png`.
