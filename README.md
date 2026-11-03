# Nhậu Online 🍻 · Bơi Hia Dứt Cạn

Quán nhậu 3D trên web nơi nhiều người thật ngồi chung bàn. Trong quán, mọi người giao tiếp bằng hành động: dzô, rót, vẫy chào, vỗ tay, mời ly. Chỉ khi đã ngồi chung bàn mới chat được, và tin nhắn chỉ người cùng bàn nhìn thấy.

Ý tưởng lấy từ [Sansa (산사)](https://sansatemple.com), một ngôi chùa online nơi mọi người ngồi im cùng nhau.

## Chạy

```bash
npm install
npm start            # http://localhost:8000  (đổi cổng: PORT=3000 npm start)
```

**Khi đang phát triển** thì chạy `npm run dev` thay cho `npm start`:
- Sửa file trong `public/` hoặc `shared/`: trình duyệt tự tải lại trang.
- Sửa file trong `server/` hoặc `shared/`: server tự khởi động lại, rồi trình duyệt cũng tự tải lại.

Không cần tắt/bật server bằng tay. `npm start` (chạy thật) không bật tính năng này.

Mở nhiều tab hoặc nhiều máy trong cùng mạng là thấy nhau. Nếu mở `public/` bằng một static server bất kỳ (không có `server/`), game tự chuyển sang chế độ chơi một mình (offline).

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `shared/world.js` | Cấu hình dùng chung cho client và server: quán, bàn, ghế, thực đơn, sân khấu, giờ vàng |
| `server/server.js` | HTTP (file tĩnh + `/api/rooms`) và WebSocket `/ws?room=…` |
| `public/game.js` | Client Three.js: khung cảnh, nhân vật, điều khiển, mạng, âm thanh |

## Triển khai (Vercel + Render)

Vercel chỉ phục vụ trang tĩnh, không giữ được kết nối WebSocket, nên mỗi cơ sở chạy một server riêng trên Render:

| Phần | Nơi chạy | Cấu hình |
|---|---|---|
| Trang web (`public/` + `shared/`) | Vercel | `vercel.json` |
| Cơ sở 1, 2, 3 | Render, mỗi cơ sở một Web Service | `render.yaml`, biến `ROOMS=quan-1`… |

- Địa chỉ server của từng cơ sở nằm ở trường `server` trong `ROOMS` (`shared/world.js`).
- Biến môi trường của server: `ROOMS` (cơ sở mở trên server này), `ALLOWED_ORIGINS` (domain trang web), `TRUST_PROXY=1` (khi chạy sau proxy), `MAX_CONN_PER_IP`, `YOUTUBE_API_KEY`.
- Chạy `npm start` ở máy thì vẫn như cũ: một server mở cả 3 cơ sở, bỏ qua trường `server`.

## Giao diện & thiết bị

- **Sáng / tối theo giờ thật ở Việt Nam (UTC+7, theo đồng hồ server)**, không cần chỉnh tay:
  - 6h–18h là ban ngày, còn lại là ban đêm. Cả quán thấy cùng một cảnh.
  - Bình minh 5h30–6h30 và hoàng hôn 17h30–18h30 chuyển dần, có ráng cam.
  - Giao diện sáng/tối và cảnh 3D đổi cùng nhau. HUD có đồng hồ "☀️ 17:14 · Ban ngày".
  - **Ban ngày:** trời xanh, mặt trời trên biển, biển xanh, khách sạn tường sáng kính xanh, đèn quán dịu đi.
  - **Ban đêm:** trăng và vệt trăng trên biển, sao, đèn thuyền câu mực, khách sạn sáng đèn.
- **Xem trước nhân vật:** ở màn bắt đầu, đổi áo, kiểu tóc hay bụng bia là thấy ngay. Kéo để xoay nhân vật.
- **Responsive:**
  - Máy tính dùng chuột và bàn phím.
  - Điện thoại và máy tính bảng dùng cảm ứng: chạm để đi, vuốt để xoay, chụm hai ngón để zoom, chạm gợi ý 👆 để tương tác, có nút "Đứng dậy".
  - Màn hình dọc thì camera tự mở rộng góc nhìn.
  - Màn hình ngang (điện thoại xoay ngang) có bố cục gọn riêng.
  - Thiết bị cảm ứng render ở độ phân giải thấp hơn cho mượt.

## Âm thanh & cài đặt

- **Nhạc nền quán:** quán tự chơi bằng Web Audio, không dùng bài hát có bản quyền:
  - Vòng hợp âm buồn kiểu bolero (Am, Dm, G, C, F, Dm, E, Am).
  - Guitar rải, bass, pad, shaker, và giai điệu ngũ cung sinh ngẫu nhiên.
  - **Có người lên hát karaoke thì nhạc nền tắt dần**, hát xong thì bật lại.
- **Cài đặt** (nút ⚙️ trên HUD hoặc ở màn bắt đầu), lưu trong trình duyệt:
  - **Âm lượng riêng** cho nhạc nền, không gian (sóng, phố), hiệu ứng (cụng ly, vỗ tay), và karaoke (cả video YouTube lẫn beat tự chế).
  - **Phát tiếp khi chuyển tab:** mặc định tắt. Chuyển sang tab khác thì mọi âm thanh tạm dừng, giống web chùa Sansa.
  - **Đồ hoạ** Đẹp / Tiết kiệm pin. Thiết bị cảm ứng mặc định là Tiết kiệm pin.
  - **Ẩn/hiện tên** mọi người trên đầu.
  - Mục **Cách chơi** và **Thông tin âm nhạc**.

## Toà nhà ven biển Mỹ Khê

**Bãi biển có người:**
- **Cả ngày lẫn đêm:** người đi dạo (có cặp đi cùng nhau), người chạy bộ, ông chụp ảnh.
- **Ban ngày:** bóng chuyền bãi biển 2 đấu 2, trẻ con đá bóng, bé xây lâu đài cát, người nằm tắm nắng dưới dù, người thả diều, người tắm biển (có phao).
- **Ban đêm:** các cặp ngồi trên cát ngắm biển.

Người chơi không xuống bãi được, chỉ ngắm từ quán (hàm `updateBeach`).

**Trò chơi trên biển (ban ngày, hàm `updateSea`):**
- **Cảm giác mạnh:** mô tô nước, dù kéo (cano kéo người bay trên dù), cano kéo phao chuối 5 người, flyboard (bay trên cột nước, thỉnh thoảng lộn vòng), ván lướt phản lực.
- **Nhẹ nhàng:** chèo SUP, kayak, thuyền lặn / đi bộ dưới đáy biển (có cờ lặn và bọt khí).
- **Lướt sóng, lướt ván buồm, lướt ván diều:** chỉ xuất hiện vào mùa sóng đẹp, tháng 3–5 và 8–10 (giờ Việt Nam).
- **Ki-ốt cho thuê đồ chơi biển** trên bãi có bảng giá.

Quán tên **Bơi Hia Dứt Cạn**. Biển hiệu làm theo kiểu biển bia hơi: nền tôn vàng có gân, chữ đỏ có chân viền trắng, khẩu hiệu "Đã Vào Là Dứt · Đã Uống Là Cạn". Trên tường tầng 1 treo 4 **tranh thơ nhậu**, bấm vào tranh để đọc. Ngoài ra có 18 **tranh slogan quán nhậu** treo khắp 3 tầng (`POSTERS` trong `public/game.js`), làm theo 5 kiểu: biển thiếc đỏ, bảng phấn, poster cổ điển, bảng gỗ, đèn neon.

Quán nằm trên đường Võ Nguyên Giáp (Đà Nẵng), nhìn thẳng ra biển Mỹ Khê. Phía bên kia đường là lối đi bộ ven biển có hàng dừa, rồi đến bãi cát và sóng biển. Có trăng mọc trên biển, đèn thuyền câu mực ngoài khơi, và phía bắc là bán đảo Sơn Trà với tượng Phật Quan Âm chùa Linh Ứng. Hai bên quán là các khách sạn cao tầng.

Bố cục khai báo ở `shared/world.js` (`BUILDING`, `TABLES`, `CORE`, `ELEVATOR`, `KITCHEN`, `DUMBWAITER`, `WCS`, `PARKING`, `STAGE`). Toà nhà rộng 36m, sâu 15m, có **40 bàn và 163 ghế**. Mỗi cơ sở nhận tối đa **150 khách** (`CAPACITY`). Số bàn chia theo mô hình quán nhậu 3 tầng:

| Tầng | Số bàn | Ghế | Có gì |
|---|---|---|---|
| **Tầng 1**: đón khách, khu mở | 12 (30%) | 47 | Quầy thu ngân ngay cửa, 4 bàn vỉa hè, 8 bàn trong nhà (gồm bàn chú Ba), **bãi giữ xe** có bác giữ xe, **bếp chính**, kho bia, WC nam/nữ |
| **Tầng 2**: phòng riêng | 18 (45%) | 76 | 6 phòng view biển cho 6 người, 4 phòng VIP (mỗi phòng ghép 3 bàn, cho 10 người), **quầy phục vụ phụ** (tủ mát, thùng đá, tủ bát đĩa, em phục vụ), WC nam/nữ |
| **Tầng 3**: sân thượng | 10 (25%) | 40 | Bàn ngoài trời nhìn ra biển, sân khấu karaoke, WC nam/nữ |

Kết quả thử tải với 149 bot và 1 trình duyệt trong cùng một quán:
- **Server:** khoảng 11.000 tin nhắn/giây, CPU khoảng 5%, RAM khoảng 85 MB.
- **Trình duyệt:** dựng đủ 150 nhân vật, không lỗi.

Lưu ý: 150 nhân vật cùng lúc khá nặng cho máy yếu và điện thoại.

- **Thang tời:** món gọi cho tầng 2 và tầng 3 được gửi lên bằng thang tời. Đèn thang tời ở tầng đó nháy, kêu "ding", rồi món mới ra bàn.
- **Ống hút khói:** đi từ chụp hút ở bếp, lên góc nhà, ra quạt hút trên sân thượng.
- **Phòng riêng:** người ngồi vào đầu tiên làm chủ phòng và bấm 🔒 để khoá. Khi phòng khoá, người khác không vào ngồi được và cửa đóng chặn lối vào. Chủ đứng dậy thì quyền chủ chuyển cho người còn ngồi. Hết người thì phòng tự mở khoá.
- **WC:** rửa mặt hoặc đi vệ sinh để giảm độ say, 20 giây mới dùng lại được một lần.
- **Lên xuống tầng chỉ bằng thang máy kính** (không có cầu thang bộ). Thang nằm ở lõi giữa nhà phía sau (`CORE`, `ELEVATOR`), xuyên cả 3 tầng, bên cạnh là bồn cây xanh (cây bụi, trúc, chuối cảnh, hoa). Bấm vào cửa thang để chọn tầng. Cửa trượt mở, nhân vật bước vào cabin, cửa đóng, có tiếng "ding", rồi cửa mở ở tầng mới và nhân vật bước ra. Người khác thấy bạn đứng trong cabin rồi xuất hiện ở tầng mới.
- **Khi ở trong nhà:** các tầng phía trên, tường mặt tiền và mái hiên tự ẩn để camera nhìn vào được, giống kiểu cắt lớp của The Sims.

## Luật chơi

- **Cơ sở (room):** có 3 cơ sở (Cơ sở 1, 2, 3), mỗi cơ sở tối đa 150 người (`CAPACITY`). Cơ sở đầy thì chọn cơ sở khác.
- **Ghế:** server quyết định ai ngồi ghế nào, mỗi ghế chỉ một người. Bàn trống thì server dọn mồi.
- **Chat trong bàn:** bấm Enter khi đang ngồi để chat. Server chỉ gửi tin nhắn cho người cùng bàn và không lưu lại. Mỗi tin tối đa 140 ký tự. Mỗi người gửi liền tối đa 3 tin, sau đó khoảng 1,5 giây mới gửi thêm được 1 tin.
- **Nhảy theo karaoke:** khi có người hát, ai đứng trên sân thượng sẽ có nút 💃 **Nhảy** (phím 7). Cả quán thấy người đó nhảy. Bấm lại, đi chỗ khác, ngồi xuống hoặc hết bài thì thôi nhảy.
- **Karaoke:** lên sân khấu để chọn bài (danh sách ở `shared/songs.js`) hoặc dán link YouTube, rồi xếp hàng lấy mic. Video karaoke phát trong "TV" ở góc màn hình, đồng bộ theo giờ server nên cả quán xem cùng một đoạn. Ai vào sau cũng nhảy tới đúng chỗ đang hát. Đứng càng gần sân khấu nghe càng to. Video hết hoặc người hát bấm "Dừng hát" thì mic chuyển cho người tiếp theo. Mỗi lượt dài tối đa 7 phút.

  Server tìm video theo thứ tự:
  1. ID video điền sẵn trong trường `yt` của bài.
  2. YouTube Data API, nếu chạy với biến môi trường `YOUTUBE_API_KEY=... npm start`. Chỉ lấy video cho phép nhúng.
  3. Không tìm được video thì phát beat tự chế dài 24 giây, không có lời.

  Link người dùng dán vào được kiểm tra qua oEmbed: video phải tồn tại và cho phép nhúng.

  Lưu ý bản quyền: dự án không lưu nhạc hay lời bài hát. Khi điền `yt`, nên chọn video từ kênh chính chủ hoặc kênh karaoke có bản quyền.
- **Giờ vàng:** cứ 10 phút một lần (theo giờ server), cả quán cùng đếm 3-2-1 rồi dzô.
- **Bao cả quán:** mỗi người được bao tối đa 1 lần/phút. Mọi người đang ngồi được rót đầy ly.
- **Độ say, hoá đơn:** chỉ tính ở máy của từng người. Riêng độ say được gửi lên server để người khác thấy bạn lắc lư.

## Giao thức WebSocket

Client gửi lên server: `hello {name, look}`, `move {x, z, yaw, d}`, `sit {table}`, `stand`, `act {k, to?}`, `order {item}`, `round`, `mic-join {song} | {url}`, `mic-leave`, `chat {text}`, `room-lock {locked}`. Hành động `act` gồm cả `dance` và `dance-stop`. Tin `move` có thêm `f` (tầng).

Server gửi xuống client: `welcome`, `join`, `leave`, `moves` (gộp lại, 10 lần/giây), `seat`, `stand`, `sit-fail`, `act`, `dish`, `dishes`, `round`, `mic`, `notice`, `full`.

Server kiểm tra lại mọi dữ liệu nhận được:
- Tên được lọc ký tự lạ, tối đa 20 ký tự.
- `look` và `act` chỉ nhận giá trị trong danh sách cho phép.
- Toạ độ bị giới hạn trong phạm vi quán.
- Mỗi kết nối gửi tối đa khoảng 20 tin nhắn/giây.
- Mỗi tin nhắn tối đa 2 KB.

## Deploy

Server chỉ cần Node 18 trở lên và một cổng mở. Nó chạy được trên VPS, Render, Fly.io hoặc Railway. Nếu chạy sau reverse proxy, nhớ bật WebSocket upgrade.

Trạng thái quán lưu trong RAM của một tiến trình. Muốn chạy nhiều instance thì phải tách mỗi quán về một instance cố định (ví dụ chuyển sang Cloudflare Durable Objects như Sansa).

Nút 🍺 **Bao chủ quán một ly** (trên HUD và màn bắt đầu) mở bảng ủng hộ giống "cúng dường gạo" của web chùa: thẻ ngân hàng có nút sao chép số tài khoản và mã VietQR. Thông tin tài khoản nằm ở `DONATE` đầu `public/game.js`, ảnh QR là `public/donate-qr.png`.
