// Danh sách bài karaoke hay được hát. Chỉ có tên bài, không chứa nhạc hay lời.
//
// Khi có người chọn một bài, server tìm video karaoke tương ứng trên YouTube theo thứ tự:
//   1. `yt` điền sẵn ở đây (ID video 11 ký tự). Nên dùng video từ kênh chính chủ hoặc kênh karaoke có bản quyền.
//   2. YouTube Data API, nếu server có biến môi trường YOUTUBE_API_KEY (chỉ lấy video cho phép nhúng).
//   3. Không có video thì phát "beat tự chế" (nhạc tự sinh, không có lời).
// Người hát cũng có thể dán link YouTube bất kỳ.

export const GENRES = ['Nhạc trẻ', 'Bolero', 'Quẩy bàn nhậu', 'Song ca'];

// Bài mặc định: lên sân khấu là hát bài này ngay.
export const DEFAULT_SONG = 'det-mong-uyen-uong';

export const SONGS = [
  { id: DEFAULT_SONG, title: 'Dệt Mộng Uyên Ương', by: 'Độ Mixi (AI Cover)', genre: 'Nhạc trẻ', yt: 't08wq1Dhsho' },
  // Nhạc trẻ
  { id: 'noi-nay-co-anh', title: 'Nơi Này Có Anh', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ' },
  { id: 'con-mua-ngang-qua', title: 'Cơn Mưa Ngang Qua', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ' },
  { id: 'em-cua-ngay-hom-qua', title: 'Em Của Ngày Hôm Qua', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ' },
  { id: 'chung-ta-cua-hien-tai', title: 'Chúng Ta Của Hiện Tại', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ' },
  { id: 'ngay-dep-troi', title: 'Ngày Đẹp Trời Để Nói Chia Tay', by: 'Lou Hoàng', genre: 'Nhạc trẻ' },
  { id: 'gio-thi', title: 'Giờ Thì', by: 'Bùi Trường Linh', genre: 'Nhạc trẻ' },
  { id: 'le-duong', title: 'Lễ Đường', by: 'Kai Đinh', genre: 'Nhạc trẻ' },
  { id: 'nang-tho', title: 'Nàng Thơ', by: 'Hoàng Dũng', genre: 'Nhạc trẻ' },
  { id: 'co-chang-trai-viet-len-cay', title: 'Có Chàng Trai Viết Lên Cây', by: 'Phan Mạnh Quỳnh', genre: 'Nhạc trẻ' },
  { id: 'hon-ca-yeu', title: 'Hơn Cả Yêu', by: 'Đức Phúc', genre: 'Nhạc trẻ' },
  { id: 'anh-nang-cua-anh', title: 'Ánh Nắng Của Anh', by: 'Đức Phúc', genre: 'Nhạc trẻ' },
  { id: 'la-lung', title: 'Lạ Lùng', by: 'Vũ.', genre: 'Nhạc trẻ' },
  { id: 'buoc-qua-nhau', title: 'Bước Qua Nhau', by: 'Vũ.', genre: 'Nhạc trẻ' },
  { id: 'thang-dien', title: 'Thằng Điên', by: 'JustaTee, Phương Ly', genre: 'Nhạc trẻ' },
  { id: 'di-de-tro-ve', title: 'Đi Để Trở Về', by: 'Soobin Hoàng Sơn', genre: 'Nhạc trẻ' },

  // Bolero / nhạc vàng
  { id: 'duyen-phan', title: 'Duyên Phận', by: 'Thái Thịnh', genre: 'Bolero' },
  { id: 'thanh-pho-buon', title: 'Thành Phố Buồn', by: 'Lam Phương', genre: 'Bolero' },
  { id: 'hoa-no-ve-dem', title: 'Hoa Nở Về Đêm', by: 'Mạnh Phát', genre: 'Bolero' },
  { id: 'rung-la-thap', title: 'Rừng Lá Thấp', by: 'Trần Thiện Thanh', genre: 'Bolero' },
  { id: 'ai-cho-toi-tinh-yeu', title: 'Ai Cho Tôi Tình Yêu', by: 'Trúc Phương', genre: 'Bolero' },
  { id: 'tau-dem-nam-cu', title: 'Tàu Đêm Năm Cũ', by: 'Trúc Phương', genre: 'Bolero' },
  { id: 'noi-buon-hoa-phuong', title: 'Nỗi Buồn Hoa Phượng', by: 'Thanh Sơn', genre: 'Bolero' },
  { id: 'hai-vi-sao-lac', title: 'Hai Vì Sao Lạc', by: 'Anh Việt Thu', genre: 'Bolero' },

  // Quẩy bàn nhậu
  { id: 'nam-anh-em', title: 'Năm Anh Em Trên Một Chiếc Xe Tăng', by: 'Doãn Nho', genre: 'Quẩy bàn nhậu' },
  { id: 'ruou-mung-hanh-phuc', title: 'Rượu Mừng Hạnh Phúc', by: 'Sỹ Đan', genre: 'Quẩy bàn nhậu' },
  { id: 'ly-ruou-mung', title: 'Ly Rượu Mừng', by: 'Phạm Đình Chương', genre: 'Quẩy bàn nhậu' },
  { id: 'khong-say-khong-ve', title: 'Không Say Không Về', by: 'Lâm Chấn Khang', genre: 'Quẩy bàn nhậu' },
  { id: 'say-tinh', title: 'Say Tình', by: 'Đàm Vĩnh Hưng', genre: 'Quẩy bàn nhậu' },
  { id: 'hai-phut-hon', title: 'Hai Phút Hơn', by: 'Pháo', genre: 'Quẩy bàn nhậu' },
  { id: 'see-tinh', title: 'See Tình', by: 'Hoàng Thùy Linh', genre: 'Quẩy bàn nhậu' },
  { id: 'beo-dat-may-troi', title: 'Bèo Dạt Mây Trôi', by: 'Dân ca', genre: 'Quẩy bàn nhậu' },

  // Song ca
  { id: 'sau-tim-thiep-hong', title: 'Sầu Tím Thiệp Hồng', by: 'Lệ Quyên, Quang Lê', genre: 'Song ca' },
  { id: 'chuyen-hen-ho', title: 'Chuyện Hẹn Hò', by: 'Quang Lê', genre: 'Song ca' },
  { id: 'ruoc-tinh-ve', title: 'Rước Tình Về Với Quê Hương', by: 'Hoàng Thi Thao', genre: 'Song ca' },
  { id: 'hay-trao-cho-anh', title: 'Hãy Trao Cho Anh', by: 'Sơn Tùng M-TP', genre: 'Song ca' },
];

export const YT_ID = /^[A-Za-z0-9_-]{11}$/;

// Lấy ID video từ link YouTube (watch?v=, youtu.be/, shorts/, embed/) hoặc từ chính ID.
export function parseYouTube(input) {
  const s = String(input ?? '').trim();
  if (YT_ID.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] || null;
  }
  return id && YT_ID.test(id) ? id : null;
}
