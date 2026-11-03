// Danh sách bài karaoke hay được hát. Chỉ có tên bài, không chứa nhạc hay lời.
//
// Khi có người chọn một bài, server tìm video karaoke tương ứng trên YouTube theo thứ tự:
//   1. `yt` điền sẵn ở đây (ID video 11 ký tự). Các video đều đã kiểm tra cho phép nhúng (11/2026);
//      video nào bị gỡ thì thay ID khác, ưu tiên kênh chính chủ hoặc kênh karaoke có bản quyền.
//   2. YouTube Data API, nếu server có biến môi trường YOUTUBE_API_KEY (chỉ lấy video cho phép nhúng).
//   3. Không có video thì phát "beat tự chế" (nhạc tự sinh, không có lời).
// Người hát cũng có thể dán link YouTube bất kỳ.

export const GENRES = ['Nhạc trẻ', 'Remix TikTok', 'Bolero', 'Quẩy bàn nhậu', 'Song ca'];

// Bài mặc định: lên sân khấu là hát bài này ngay.
export const DEFAULT_SONG = 'det-mong-uyen-uong';

export const SONGS = [
  { id: DEFAULT_SONG, title: 'Dệt Mộng Uyên Ương', by: 'Độ Mixi (AI Cover)', genre: 'Nhạc trẻ', yt: 't08wq1Dhsho' },
  // Nhạc trẻ
  { id: 'noi-nay-co-anh', title: 'Nơi Này Có Anh', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ', yt: 'ikW3MzQYJ_M' },
  { id: 'con-mua-ngang-qua', title: 'Cơn Mưa Ngang Qua', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ', yt: 'uMQazJYAOG4' },
  { id: 'em-cua-ngay-hom-qua', title: 'Em Của Ngày Hôm Qua', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ', yt: 'eSSekm3q0Ns' },
  { id: 'chung-ta-cua-hien-tai', title: 'Chúng Ta Của Hiện Tại', by: 'Sơn Tùng M-TP', genre: 'Nhạc trẻ', yt: 'ZGzMEzRFAxI' },
  { id: 'ngay-dep-troi', title: 'Ngày Đẹp Trời Để Nói Chia Tay', by: 'Lou Hoàng', genre: 'Nhạc trẻ', yt: '0kOKtLUaYok' },
  { id: 'gio-thi', title: 'Giờ Thì', by: 'Bùi Trường Linh', genre: 'Nhạc trẻ', yt: 'SvJvO64QwSo' },
  { id: 'le-duong', title: 'Lễ Đường', by: 'Kai Đinh', genre: 'Nhạc trẻ', yt: 'dEnguHPmv-c' },
  { id: 'nang-tho', title: 'Nàng Thơ', by: 'Hoàng Dũng', genre: 'Nhạc trẻ', yt: 'Tqv0x1_QJlo' },
  { id: 'co-chang-trai-viet-len-cay', title: 'Có Chàng Trai Viết Lên Cây', by: 'Phan Mạnh Quỳnh', genre: 'Nhạc trẻ', yt: 'w5B8EqUwfyc' },
  { id: 'hon-ca-yeu', title: 'Hơn Cả Yêu', by: 'Đức Phúc', genre: 'Nhạc trẻ', yt: 'kE-sgixxmGo' },
  { id: 'anh-nang-cua-anh', title: 'Ánh Nắng Của Anh', by: 'Đức Phúc', genre: 'Nhạc trẻ', yt: 'fvrCHVgfSB4' },
  { id: 'la-lung', title: 'Lạ Lùng', by: 'Vũ.', genre: 'Nhạc trẻ', yt: 'FC-mh63WkR4' },
  { id: 'buoc-qua-nhau', title: 'Bước Qua Nhau', by: 'Vũ.', genre: 'Nhạc trẻ', yt: 'fhIq4pHqcsc' },
  { id: 'thang-dien', title: 'Thằng Điên', by: 'JustaTee, Phương Ly', genre: 'Nhạc trẻ', yt: '-GJLiwaRVXc' },
  { id: 'di-de-tro-ve', title: 'Đi Để Trở Về', by: 'Soobin Hoàng Sơn', genre: 'Nhạc trẻ', yt: 'vWSiBNqXznw' },

  // Remix hot TikTok (bản karaoke remix, 11/2026)
  { id: 'thuong-nhau-den-the-remix', title: 'Thương Nhau Đến Thế (Remix)', by: 'Gia Huy', genre: 'Remix TikTok', yt: 'Ytsu_FcJNWU' },
  { id: 'xin-dung-roi-xa-anh-remix', title: 'Xin Đừng Rời Xa Anh (Remix)', by: 'Lê Gia Bảo', genre: 'Remix TikTok', yt: '0kFiEcKfeOI' },
  { id: 'nhuong-lai-noi-dau-remix', title: 'Nhường Lại Nỗi Đau (Remix)', by: 'Ngân Ngân', genre: 'Remix TikTok', yt: 'ZIDL8Z3nx_8' },
  { id: 'tra-cho-anh-remix', title: 'Trả Cho Anh (Remix)', by: 'Nguyễn Thạc Bảo Ngọc', genre: 'Remix TikTok', yt: 'JW1tleNXnZg' },
  { id: 'nhu-mot-nguoi-dung-remix', title: 'Như Một Người Dưng (Remix)', by: 'Nguyễn Thạc Bảo Ngọc', genre: 'Remix TikTok', yt: 'p0P46zKbgEg' },
  { id: 'cho-doi-co-dang-so-remix', title: 'Chờ Đợi Có Đáng Sợ (Remix)', by: 'Andiez', genre: 'Remix TikTok', yt: 'XGB0CtnGtKw' },
  { id: 'su-that-da-bo-quen-remix', title: 'Sự Thật Đã Bỏ Quên (Remix)', by: 'Hà Duy Thái', genre: 'Remix TikTok', yt: 'NeDxuBUmiB0' },

  // Bolero / nhạc vàng
  { id: 'duyen-phan', title: 'Duyên Phận', by: 'Thái Thịnh', genre: 'Bolero', yt: '3C0pTumFiUg' },
  { id: 'thanh-pho-buon', title: 'Thành Phố Buồn', by: 'Lam Phương', genre: 'Bolero', yt: 'R8pGdaL_64U' },
  { id: 'hoa-no-ve-dem', title: 'Hoa Nở Về Đêm', by: 'Mạnh Phát', genre: 'Bolero', yt: 'AIOL-HCFMxE' },
  { id: 'rung-la-thap', title: 'Rừng Lá Thấp', by: 'Trần Thiện Thanh', genre: 'Bolero', yt: 'h-zB7jbzllc' },
  { id: 'ai-cho-toi-tinh-yeu', title: 'Ai Cho Tôi Tình Yêu', by: 'Trúc Phương', genre: 'Bolero', yt: 'mwERSfyliyU' },
  { id: 'tau-dem-nam-cu', title: 'Tàu Đêm Năm Cũ', by: 'Trúc Phương', genre: 'Bolero', yt: 'ZT3xtrqaOXI' },
  { id: 'noi-buon-hoa-phuong', title: 'Nỗi Buồn Hoa Phượng', by: 'Thanh Sơn', genre: 'Bolero', yt: '88Q67KqNNyY' },
  { id: 'hai-vi-sao-lac', title: 'Hai Vì Sao Lạc', by: 'Anh Việt Thu', genre: 'Bolero', yt: 'kcBdA5CAlQo' },
  { id: 'loi-ve-dat-me', title: 'Lối Về Đất Mẹ', by: 'Duy Khánh', genre: 'Bolero', yt: 'ckw7bnF4yoE' },

  // Quẩy bàn nhậu
  { id: 'nam-anh-em', title: 'Năm Anh Em Trên Một Chiếc Xe Tăng', by: 'Doãn Nho', genre: 'Quẩy bàn nhậu', yt: 'H5Jmy7aCEDU' },
  { id: 'ruou-mung-hoa-nguoi-dung', title: 'Rượu Mừng Hóa Người Dưng', by: 'TLong', genre: 'Quẩy bàn nhậu', yt: 'YZ_tMZtDdKc' },
  { id: 'ly-ruou-mung', title: 'Ly Rượu Mừng', by: 'Phạm Đình Chương', genre: 'Quẩy bàn nhậu', yt: 'Mm8lMkZJUiw' },
  { id: 'khong-say-khong-ve', title: 'Không Say Không Về', by: 'Lâm Chấn Khang', genre: 'Quẩy bàn nhậu', yt: 'gxKnxsHJ9Lo' },
  { id: 'say-tinh', title: 'Say Tình', by: 'Đàm Vĩnh Hưng', genre: 'Quẩy bàn nhậu', yt: 'mCof2sHiHu0' },
  { id: 'hai-phut-hon', title: 'Hai Phút Hơn', by: 'Pháo', genre: 'Quẩy bàn nhậu', yt: 'NpIB8pLVWpU' },
  { id: 'see-tinh', title: 'See Tình', by: 'Hoàng Thùy Linh', genre: 'Quẩy bàn nhậu', yt: 'z6HE1dr4S84' },
  { id: 'beo-dat-may-troi', title: 'Bèo Dạt Mây Trôi', by: 'Dân ca', genre: 'Quẩy bàn nhậu', yt: 'o2Yr_qroit0' },
  { id: 'an-tu-hinh', title: 'Án Tử Hình', by: 'Lã Phong Lâm', genre: 'Quẩy bàn nhậu', yt: 'ec2qol4wWUE' },

  // Song ca
  { id: 'sau-tim-thiep-hong', title: 'Sầu Tím Thiệp Hồng', by: 'Lệ Quyên, Quang Lê', genre: 'Song ca', yt: 'LPrOVzOHgZQ' },
  { id: 'chuyen-hen-ho', title: 'Chuyện Hẹn Hò', by: 'Quang Lê', genre: 'Song ca', yt: 'HlBXbBSk_t8' },
  { id: 'ruoc-tinh-ve', title: 'Rước Tình Về Với Quê Hương', by: 'Hoàng Thi Thao', genre: 'Song ca', yt: '7mcZA1wwJ8s' },
  { id: 'hay-trao-cho-anh', title: 'Hãy Trao Cho Anh', by: 'Sơn Tùng M-TP', genre: 'Song ca', yt: '4q-OkPsdpsM' },
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
