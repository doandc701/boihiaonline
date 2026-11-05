// Trò chơi cho người ngồi cùng bàn. Server tung xúc xắc, quay chai, bốc thăm…; client chỉ hiển thị.
// Luật chung: chủ trò mời cả bàn, ai bấm "Chơi" trong LOBBY_MS thì tham gia (giữ tiền cược nếu có),
// cần ít nhất 2 người. Người thua bị phạt uống cạn một ly; người thắng chia đều tiền cược.

export const GAMES = {
  chai: { icon: '🍾', name: 'Quay chai', bet: true, rule: 'Chai xoay giữa bàn, dừng chỉ vào ai thì người đó uống cạn và nhận một thử thách.' },
  xingau: { icon: '🎲', name: 'Lắc xí ngầu', bet: true, rule: 'Mỗi người lắc 3 viên. Thấp điểm nhất uống, cao điểm nhất ăn tiền cược.' },
  ott: { icon: '✊', name: 'Oẳn tù tì', bet: true, rule: 'Cùng ra Kéo / Búa / Bao. Ai thua phải uống, ai thắng chia tiền cược.' },
  dovui: { icon: '❓', name: 'Đố vui nhậu', bet: true, rule: 'Một câu đố, 10 giây. Sai hoặc không trả lời thì uống, ai đúng chia tiền cược.' },
  bill: { icon: '🧾', name: 'Bốc thăm chịu bill', bet: false, rule: 'Bốc thăm một người trả cả hoá đơn bàn. Chỉ ai ví đủ trả mới được tham gia.' },
};
export const GAME_KINDS = Object.keys(GAMES);
export const BETS = [0, 10000, 20000, 50000];
export const MIN_PLAYERS = 2;
export const LOBBY_MS = 15000; // thời gian nhận lời
export const RPS_MS = 8000; // thời gian chọn kéo/búa/bao mỗi lượt
export const RPS_ROUNDS = 3; // hoà quá số lượt này thì cả bàn cùng uống, hoàn tiền
export const QUIZ_MS = 10000; // thời gian trả lời câu đố
export const SPIN_MS = 4200; // chai xoay / bát xóc / bốc thăm chạy bao lâu trước khi lộ kết quả
export const RESULT_MS = 6000; // kết quả hiện bao lâu rồi bàn mở được trò mới

export const RPS = { keo: { icon: '✌️', name: 'Kéo', beats: 'bao' }, bua: { icon: '✊', name: 'Búa', beats: 'keo' }, bao: { icon: '✋', name: 'Bao', beats: 'bua' } };

// Câu đố vui nhậu: q, a (3 đáp án), c (chỉ số đáp án đúng).
export const QUIZ = [
  { q: 'Bia hơi Hà Nội thường được rót vào loại cốc nào?', a: ['Cốc vại thuỷ tinh', 'Ly có chân', 'Cốc giấy'], c: 0 },
  { q: '"Dzô" là cách nói của vùng nào?', a: ['Miền Bắc', 'Miền Nam', 'Tây Nguyên'], c: 1 },
  { q: 'Một két bia chai thường có bao nhiêu chai?', a: ['12', '20', '24'], c: 2 },
  { q: 'Món nào hay ăn kèm "lẩu thái"?', a: ['Bún', 'Bánh chưng', 'Xôi'], c: 0 },
  { q: 'Nghêu hấp sả thường thêm gì cho thơm?', a: ['Lá chanh', 'Lá bạc hà', 'Quế'], c: 0 },
  { q: 'Bia được làm chủ yếu từ ngũ cốc nào?', a: ['Lúa mạch', 'Ngô', 'Khoai mì'], c: 0 },
  { q: 'Cây hoa bia (hops) cho bia vị gì?', a: ['Đắng', 'Mặn', 'Cay'], c: 0 },
  { q: 'Uống rượu bia xong thì nên làm gì?', a: ['Tự lái xe về', 'Gọi xe ôm, taxi', 'Đi bơi'], c: 1 },
  { q: 'Nước nào nổi tiếng với lễ hội bia Oktoberfest?', a: ['Pháp', 'Đức', 'Ý'], c: 1 },
  { q: '"Một trăm phần trăm" khi nhậu nghĩa là gì?', a: ['Uống cạn ly', 'Uống nửa ly', 'Gọi thêm 100 chai'], c: 0 },
  { q: 'Rượu đế được nấu từ gì?', a: ['Gạo', 'Nho', 'Táo'], c: 0 },
  { q: 'Ốc len thường được nấu món gì?', a: ['Xào dừa', 'Chiên giòn', 'Kho tộ'], c: 0 },
  { q: 'Bánh tráng trộn có nguồn gốc gần nhất với thành phố nào?', a: ['Sài Gòn', 'Huế', 'Hải Phòng'], c: 0 },
  { q: 'Mồi nhắm "khô mực" thường được làm thế nào?', a: ['Nướng rồi xé', 'Luộc', 'Hấp'], c: 0 },
  { q: 'Nhiệt độ uống bia ngon thường khoảng?', a: ['3–7°C', '25–30°C', '50°C'], c: 0 },
  { q: 'Câu "Không say không về" hay được hát ở đâu?', a: ['Bàn nhậu', 'Lớp học', 'Thư viện'], c: 0 },
  { q: 'Đá bỏ vào bia để làm gì?', a: ['Cho lạnh', 'Cho ngọt', 'Cho đắng'], c: 0 },
  { q: 'Gỏi cá trích nổi tiếng ở đâu?', a: ['Phú Quốc', 'Hà Giang', 'Sa Pa'], c: 0 },
  { q: 'Cá nục thường được kho với gì?', a: ['Cà chua', 'Sữa', 'Chocolate'], c: 0 },
  { q: '"Dô ba con năm" là kiểu đếm khi nào?', a: ['Trước khi cụng ly', 'Khi tính tiền', 'Khi hát'], c: 0 },
  { q: 'Lòng nướng hay chấm với gì?', a: ['Muối ớt chanh', 'Sữa đặc', 'Mật ong'], c: 0 },
  { q: 'Nước nào có nhiều kiểu bia đen "stout"?', a: ['Ireland', 'Thái Lan', 'Ai Cập'], c: 0 },
  { q: 'Ly bia nhiều bọt quá thì nên làm gì?', a: ['Rót nghiêng ly', 'Lắc mạnh chai', 'Cho thêm muối'], c: 0 },
  { q: 'Món "ếch chiên bơ" chiên với gì?', a: ['Bơ tỏi', 'Mứt dâu', 'Kem'], c: 0 },
  { q: 'Dê tái chanh thường ăn kèm lá gì?', a: ['Lá tía tô, lá lốt', 'Lá chuối', 'Lá sen'], c: 0 },
  { q: 'Hải sản hay được nướng kiểu gì ở biển Việt Nam?', a: ['Mỡ hành', 'Kho quẹt', 'Hấp bia'], c: 0 },
  { q: 'Người ta hay cụng ly rồi nói gì?', a: ['Dzô!', 'Tạm biệt!', 'Xin lỗi!'], c: 0 },
  { q: 'Uống xen nước lọc khi nhậu giúp gì?', a: ['Đỡ say, đỡ mất nước', 'Say nhanh hơn', 'Không có tác dụng'], c: 0 },
  { q: 'Bia tươi khác bia chai ở điểm nào?', a: ['Không qua thanh trùng lâu', 'Không có cồn', 'Không có bọt'], c: 0 },
  { q: 'Món chân gà sả tắc có vị gì nổi bật?', a: ['Chua cay', 'Ngọt lịm', 'Đắng chát'], c: 0 },
  { q: 'Mực nướng sa tế có vị gì?', a: ['Cay', 'Chua', 'Ngọt'], c: 0 },
  { q: 'Bia hơi thường uống trong ngày vì sao?', a: ['Dễ hỏng, không để lâu', 'Uống ban đêm bị phạt', 'Chỉ bán buổi sáng'], c: 0 },
  { q: 'Cầm ly mời người lớn tuổi thì nên làm gì?', a: ['Cầm hai tay', 'Cầm một ngón', 'Đặt lên đầu'], c: 0 },
  { q: 'Đi nhậu về muộn thì nên làm gì với người nhà?', a: ['Báo trước', 'Tắt máy', 'Ngủ ngoài cửa'], c: 0 },
  { q: 'Đậu hũ chiên giòn hay chấm với gì?', a: ['Mắm tôm hoặc nước tương', 'Sữa chua', 'Siro'], c: 0 },
  { q: 'Bia nào là bia nhẹ, ít cồn hơn?', a: ['Bia lager nhẹ', 'Rượu vang', 'Rượu đế'], c: 0 },
  { q: 'Lẩu dê thường nấu với gì cho thơm?', a: ['Thuốc bắc, chao', 'Socola', 'Bơ đậu phộng'], c: 0 },
  { q: '"Cạn ly" nghĩa là?', a: ['Uống hết ly', 'Đổ ly đi', 'Rửa ly'], c: 0 },
  { q: 'Xoài lắc ăn với gì?', a: ['Muối ớt', 'Nước mắm cá', 'Đường phèn'], c: 0 },
  { q: 'Vừa nhậu vừa hát thì gọi là gì?', a: ['Karaoke', 'Kịch nói', 'Cải lương'], c: 0 },
];

// Thử thách / câu hỏi "Thật hay Thách" cho người bị chai chỉ vào (vui vẻ, không quá đà).
export const DARES = [
  'Kể một kỷ niệm say xỉn nhớ đời!', 'Khen người ngồi bên phải một câu thật lòng.', 'Hát một câu bài bạn thích nhất.',
  'Kể tên người bạn crush hồi đi học.', 'Làm biểu cảm dễ thương nhất có thể.', 'Mời cả bàn một ly nước lọc.',
  'Kể món ăn dở nhất từng ăn.', 'Nói một câu thả thính cho cả bàn nghe.', 'Bắt chước giọng sếp của bạn.',
  'Kể một tật xấu của bản thân.', 'Chúc cả bàn một câu thật hay.', 'Kể lần quê nhất từng gặp.',
];

// Kết quả oẳn tù tì cho một lượt: trả về { winners, losers } hoặc null nếu hoà
// (tất cả giống nhau hoặc đủ cả 3 loại). Người không chọn (move = null) luôn thua.
export function rpsResult(moves) {
  const ids = Object.keys(moves);
  const chosen = ids.filter((id) => RPS[moves[id]]);
  const idle = ids.filter((id) => !RPS[moves[id]]);
  const kinds = new Set(chosen.map((id) => moves[id]));
  if (kinds.size === 1 || kinds.size === 3) {
    if (!idle.length) return null; // hoà
    return { winners: chosen, losers: idle };
  }
  if (!kinds.size) return null; // không ai chọn
  const [a, b] = [...kinds];
  const win = RPS[a].beats === b ? a : b;
  return { winners: chosen.filter((id) => moves[id] === win), losers: [...chosen.filter((id) => moves[id] !== win), ...idle] };
}
