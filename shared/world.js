// Cấu hình dùng chung cho server và client: quán, bàn, ghế, thực đơn, luật chơi.

export const CAPACITY = 150; // số khách tối đa mỗi cơ sở (163 ghế)
// server: địa chỉ server riêng của từng cơ sở, dùng khi trang chạy ở host tĩnh (Vercel).
// Chạy bằng `npm start` thì client dùng luôn server đang phục vụ trang, bỏ qua trường này.
export const ROOMS = [
  { id: 'quan-1', name: 'Cơ sở 1', server: 'https://boihia-quan-1.onrender.com' },
  { id: 'quan-2', name: 'Cơ sở 2', server: 'https://boihia-quan-2.onrender.com' },
  { id: 'quan-3', name: 'Cơ sở 3', server: 'https://boihia-quan-3.onrender.com' },
];

// ---------- Toà nhà 3 tầng ----------
// Mặt tiền ở z = -1, vỉa hè từ z = -1 tới 3.2 (chỉ ở tầng 1). Toạ độ y của tầng f là f * FLOOR_H.
export const FLOOR_H = 3.2;
export const FLOOR_NAMES = ['Tầng 1', 'Tầng 2 · Phòng riêng', 'Tầng 3 · Sân thượng'];
export const BUILDING = { minX: -18, maxX: 18, minZ: -16, maxZ: -1 };
// Bờ biển trước quán (theo z): vỉa hè tới 3.3, đường 3.4–10.6, lối đi bộ ven biển tới bờ tường 13.5,
// bãi cát tới mép nước SHORE.seaZ. Tầng 1 đi dạo được ra tới mép nước, rộng ±60 m dọc bờ biển.
export const SHORE = { curbZ: 3.3, roadMaxZ: 10.6, wallZ: 13.5, seaZ: 45, halfW: 60, stairs: [-2.5, 2.5] };
export const FLOOR_BOUNDS = [
  { minX: -SHORE.halfW, maxX: SHORE.halfW, minZ: -15.6, maxZ: SHORE.seaZ + 1.2 },
  { minX: -17.6, maxX: 17.6, minZ: -15.6, maxZ: -1.4 },
  { minX: -17.6, maxX: 17.6, minZ: -15.6, maxZ: -1.4 },
];
// Lõi thang máy ở giữa nhà phía sau: nửa trái là bồn cây xanh, nửa phải là thang máy.
// Quán không có cầu thang bộ, lên xuống các tầng đều bằng thang máy.
export const CORE = { minX: -2, maxX: 2, minZ: -16, maxZ: -12 };
// Thang máy kính trong lõi, xuyên 3 tầng. Cửa quay ra sảnh (doorZ).
export const ELEVATOR = { x: 1, z: -14.8, w: 2, d: 2.4, doorZ: -13.6 };
// Bếp chính ở tầng 1. Thang tời (dumbwaiter) ở góc bếp, xuyên lên tầng 2 và 3 để chuyển món.
export const KITCHEN = { minX: 2, maxX: 12, minZ: -16, maxZ: -12, doorX: [8.5, 10.1] };
export const DUMBWAITER = { x: 2.8, z: -15.4 };
// Mỗi tầng một khu WC chia nam/nữ (divX), cửa ở cạnh doorZ.
export const WCS = [
  { floor: 0, minX: -18, maxX: -12, minZ: -16, maxZ: -12, divX: -15, doorZ: -12 },
  { floor: 1, minX: -18, maxX: -14, minZ: -16, maxZ: -10, divX: -16, doorZ: -10 },
  { floor: 2, minX: -18, maxX: -14, minZ: -16, maxZ: -13.5, divX: -16, doorZ: -13.5 },
];
// Bãi giữ xe trên vỉa hè, bên phải cửa ra vào.
export const PARKING = { minX: 3.6, maxX: 17.6, minZ: 0.2, maxZ: 2.5 };

export const SEAT_RADIUS = 1.05;

// Bàn tròn: r = bán kính mặt bàn. Bàn dài (shape: 'long') là `pieces` bàn vuông ghép lại, ghế ngồi hai bên.
// npcSeats: ghế có NPC ngồi sẵn (chú Ba). private: phòng riêng (chủ phòng khoá được).
// 40 bàn, 163 ghế, chia theo mô hình quán nhậu 3 tầng: tầng 1 30%, tầng 2 45%, tầng 3 25%.
export const TABLES = [];
const addTable = (floor, x, z, name, extra = {}) => TABLES.push({ id: TABLES.length, floor, x, z, seats: 4, r: 0.6, name, ...extra });

// Tầng 1 (12 bàn): khách nhóm nhỏ, ngồi nhanh
[-15.5, -12, -8.5, -5].forEach((x, i) => addTable(0, x, 1.6, `Bàn vỉa hè ${i + 1}`, { area: 'Vỉa hè' }));
[[-15.5, -3.6], [-11, -3.6], [-6.5, -3.6], [-15.5, -7.6], [-11, -7.6], [10.5, -5], [15, -5]]
  .forEach(([x, z], i) => addTable(0, x, z, `Bàn trong nhà ${i + 1}`, { area: 'Trong nhà' }));
addTable(0, -6.5, -7.6, 'Bàn chú Ba', { seats: 4, npcSeats: [0], area: 'Trong nhà' });

// Tầng 2 (18 bàn): phòng riêng. Dãy trước 6 phòng view biển cho 4–6 người,
// dãy sau 4 phòng VIP, mỗi phòng ghép 3 bàn cho 10 người.
const room = (x, z, w, d, doorZ) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, doorZ });
const FRONT_W = 16 / 3;
[-18, -18 + FRONT_W, -18 + 2 * FRONT_W, 2, 2 + FRONT_W, 2 + 2 * FRONT_W].forEach((x0, i) => {
  const x = +(x0 + FRONT_W / 2).toFixed(3);
  addTable(1, x, -4, `Phòng ${i + 1} (view biển)`, {
    area: 'Phòng riêng', private: true, seats: 6, r: 0.7, room: room(x, -4, FRONT_W, 6, -7),
  });
});
[-11, -5, 9, 15].forEach((x, i) => addTable(1, x, -13, `Phòng VIP ${i + 1}`, {
  area: 'Phòng riêng', private: true, shape: 'long', len: 4.2, w: 0.9, seats: 10, pieces: 3, room: room(x, -13, 6, 6, -10),
}));

// Tầng 3 (10 bàn): sân thượng ngoài trời
for (const z of [-3.6, -7.8]) {
  for (const x of [-15.5, -11, -6.5, 6.5, 11]) addTable(2, x, z, `Bàn sân thượng ${TABLES.filter((t) => t.floor === 2).length + 1}`, { area: 'Sân thượng' });
}

// Sân khấu karaoke trên sân thượng.
export const STAGE = { floor: 2, x: 15.6, z: -7, w: 3.2, d: 5, singerX: 16.3, singerZ: -7 };

// Đồ uống theo bàn: bàn chú Ba uống rượu đế chú mời (miễn phí), các bàn khác uống bia.
export const DRINKS = {
  beer: { name: 'Bia Sài Gòn', icon: '🍺', price: 20000, strength: 10, color: 0xe8a317 },
  ruou: { name: 'Rượu đế (chú Ba mời)', icon: '🍶', price: 0, strength: 16, color: 0xeeeedd },
};
export const drinkOfTable = (T) => (T.npcSeats ? DRINKS.ruou : DRINKS.beer);

// Hoá đơn chung của bàn: món đã gọi + số lượt rót. Tính tiền được khi đã gọi ít nhất 1 món;
// một người trả cho cả bàn, gọi thêm sau khi trả thì mở hoá đơn mới.
export function tabTotal(T, tab) {
  return tab.items.reduce((s, i) => s + (MENU[i]?.price || 0), 0) + tab.pours * drinkOfTable(T).price;
}

// Nhóm món để lọc trong thực đơn, theo thứ tự hiển thị.
export const MENU_CATS = ['Khai vị', 'Nướng', 'Hải sản', 'Đồng quê', 'Lẩu', 'Cơm & rau'];
// Client và server gửi món theo chỉ số trong mảng này: món mới thêm vào cuối, không chèn hay đổi thứ tự.
// MENU[0] (lạc rang) còn là món của người bán rong.
export const MENU = [
  { icon: '🥜', name: 'Lạc rang', price: 15000, cat: 'Khai vị' },
  { icon: '🦑', name: 'Mực nướng', price: 120000, cat: 'Nướng' },
  { icon: '🐌', name: 'Ốc len xào dừa', price: 80000, cat: 'Hải sản' },
  { icon: '🍗', name: 'Chân gà nướng', price: 60000, cat: 'Nướng' },
  { icon: '🥩', name: 'Bò nhúng giấm', price: 150000, cat: 'Đồng quê' },
  { icon: '🍢', name: 'Nem chua rán', price: 50000, cat: 'Khai vị' },
  { icon: '🦐', name: 'Tôm nướng muối ớt', price: 140000, cat: 'Hải sản' },
  { icon: '🥒', name: 'Dưa chuột', price: 10000, cat: 'Khai vị' },
  { icon: '🍲', name: 'Lẩu thái', price: 250000, cat: 'Lẩu' },
  { icon: '🐸', name: 'Ếch chiên bơ', price: 110000, cat: 'Đồng quê' },
  { icon: '🧈', name: 'Đậu hũ chiên giòn', price: 35000, cat: 'Khai vị' },
  { icon: '🍟', name: 'Khoai tây chiên', price: 40000, cat: 'Khai vị' },
  { icon: '🦑', name: 'Khô mực nướng', price: 150000, cat: 'Khai vị' },
  { icon: '🥭', name: 'Xoài lắc muối ớt', price: 35000, cat: 'Khai vị' },
  { icon: '🥓', name: 'Ba chỉ nướng', price: 90000, cat: 'Nướng' },
  { icon: '🌭', name: 'Lòng nướng', price: 70000, cat: 'Nướng' },
  { icon: '🌿', name: 'Bò cuốn lá lốt', price: 80000, cat: 'Nướng' },
  { icon: '🍖', name: 'Sườn nướng mật ong', price: 110000, cat: 'Nướng' },
  { icon: '🐔', name: 'Gà nướng muối ớt', price: 180000, cat: 'Nướng' },
  { icon: '🦑', name: 'Mực hấp sả', price: 130000, cat: 'Hải sản' },
  { icon: '🐚', name: 'Nghêu hấp sả', price: 70000, cat: 'Hải sản' },
  { icon: '🐚', name: 'Sò điệp nướng mỡ hành', price: 90000, cat: 'Hải sản' },
  { icon: '🦪', name: 'Hàu nướng phô mai', price: 100000, cat: 'Hải sản' },
  { icon: '🐌', name: 'Ốc hương xào bơ tỏi', price: 150000, cat: 'Hải sản' },
  { icon: '🦀', name: 'Cua rang me', price: 280000, cat: 'Hải sản' },
  { icon: '🍋', name: 'Chân gà ngâm sả tắc', price: 60000, cat: 'Đồng quê' },
  { icon: '🐸', name: 'Da ếch chiên giòn', price: 80000, cat: 'Đồng quê' },
  { icon: '🐐', name: 'Dê tái chanh', price: 160000, cat: 'Đồng quê' },
  { icon: '🥘', name: 'Lòng xào dưa cải', price: 90000, cat: 'Đồng quê' },
  { icon: '🍲', name: 'Lẩu dê', price: 350000, cat: 'Lẩu' },
  { icon: '🐟', name: 'Lẩu cá kèo lá giang', price: 280000, cat: 'Lẩu' },
  { icon: '🦞', name: 'Lẩu hải sản', price: 380000, cat: 'Lẩu' },
  { icon: '🥬', name: 'Rau muống xào tỏi', price: 40000, cat: 'Cơm & rau' },
  { icon: '🍛', name: 'Cơm chiên hải sản', price: 70000, cat: 'Cơm & rau' },
  { icon: '🍜', name: 'Mì xào bò', price: 70000, cat: 'Cơm & rau' },
  { icon: '🥣', name: 'Cháo ngao', price: 50000, cat: 'Cơm & rau' },
];

// ---------- Ví tiền & kiếm tiền ----------
export const START_MONEY = 1000000; // mỗi người mới vào được 1 triệu (tiền ảo)
export const ROUND_PRICE = 500000; // bao cả quán một két
export const VENDOR_PRICE = 15000; // gói lạc của cô bán rong
// Đồ có thể có trong giỏ: cá câu được và đồ nhặt trên bãi. price: bán được bao nhiêu.
// w: độ hay gặp. rare: cá hiếm (giá cao, câu được thì cả quán được báo).
export const FISH = [
  { k: 'dep', icon: '🩴', name: 'Chiếc dép tổ ong', price: 0, w: 6, junk: true, desc: 'Ai vứt dép xuống biển vậy trời! Không bán được, vứt đi cho sạch biển.' },
  { k: 'ca-com', icon: '🐟', name: 'Cá cơm', price: 15000, w: 34, desc: 'Nhỏ xíu nhưng chiên giòn nhắm bia là hết sảy.' },
  { k: 'ca-nuc', icon: '🐟', name: 'Cá nục', price: 30000, w: 26, desc: 'Kho cà hay nướng lá chuối đều đưa cay.' },
  { k: 'muc', icon: '🦑', name: 'Mực ống', price: 60000, w: 15, desc: 'Tươi rói, nướng sa tế là cả bàn tranh nhau.' },
  { k: 'ca-thu', icon: '🐠', name: 'Cá thu', price: 100000, w: 10, desc: 'Thịt chắc, béo, dân biển quý lắm.' },
  { k: 'ca-mu', icon: '🐡', name: 'Cá mú', price: 300000, w: 6, rare: true, desc: 'Cá hiếm! Bà Tư trả giá cao lắm.' },
  { k: 'tom-hum', icon: '🦞', name: 'Tôm hùm', price: 500000, w: 3, rare: true, desc: 'Cực hiếm! Mang ra Bà Tư bán được cả nửa triệu.' },
];
export const BEACH = [
  { k: 'cua', icon: '🦀', name: 'Cua biển', price: 40000, w: 3 },
  { k: 'oc', icon: '🐌', name: 'Ốc gạo', price: 20000, w: 4 },
  { k: 'so', icon: '🐚', name: 'Vỏ sò đẹp', price: 10000, w: 4 },
  { k: 'chai', icon: '🍾', name: 'Chai trôi dạt', price: 5000, w: 2, bottle: true },
];
export const ITEMS = Object.fromEntries([...FISH, ...BEACH].map((it) => [it.k, it]));
export const BAG_MAX = 30;
// Bãi cát nơi đồ trôi dạt xuất hiện, và mép nước nơi câu cá được.
export const BEACH_AREA = { minX: -45, maxX: 45, minZ: SHORE.wallZ + 3, maxZ: SHORE.seaZ - 2 };
export const FISH_ZONE_Z = SHORE.seaZ - 2.5;
// Sạp thu mua của Bà Tư dưới chân bậc xuống biển: phải đến đây mới bán được đồ trong giỏ.
export const TRADER = { x: 5.8, z: 16.4, range: 3.2 };
export const nearTrader = (p) => p.f === 0 && Math.hypot(p.x - TRADER.x, p.z - TRADER.z) <= TRADER.range;
export const pickWeighted = (list, rnd = Math.random) => {
  let r = rnd() * list.reduce((s, x) => s + x.w, 0);
  for (const x of list) if ((r -= x.w) < 0) return x;
  return list[list.length - 1];
};

// Hành động người chơi được phát cho cả quán.
export const ACTS = ['cheers', 'pour', 'wave', 'clap', 'water', 'offer', 'dance', 'dance-stop'];

export const SHIRTS = [0x2e86de, 0xe84393, 0xf6b93b, 0x6ab04c, 0xf5f5f5, 0x222222, 0x8e44ad, 0xe55039];
export const HAIRS = ['Tóc ngắn', 'Tóc dài', 'Hói'];

export const SONG_MS = 3.5 * 60 * 1000; // độ dài một lượt hát với beat tự chế, bằng một bài bình thường
// Video YouTube hát hết bài: người hát báo độ dài video cho server. Đây là mức trần (chặn liên khúc dài cả tiếng)
// và cũng là thời hạn tạm trong lúc chưa biết độ dài video.
export const MAX_SONG_MS = 15 * 60 * 1000;
export const MIC_DELAY_MS = 1500;
export const ROUND_COOLDOWN_MS = 60000;
export const MAX_DISHES = 8;

// Chat chỉ dành cho người ngồi cùng bàn.
export const CHAT_MAX = 140;

// Giờ vàng: cứ 10 phút cả quán cùng dzô một lần (tính theo giờ server).
export const GOLDEN_EVERY = 10 * 60 * 1000;
export const GOLDEN_MS = 15000;

export function seatPos(T, i) {
  if (T.shape === 'long') {
    const per = Math.ceil(T.seats / 2), side = i < per ? -1 : 1, k = i < per ? i : i - per;
    const step = T.len / per;
    return { x: T.x - T.len / 2 + step * (k + 0.5), z: T.z + side * (T.w / 2 + 0.45) };
  }
  // Ghế cuối cùng luôn ở phía trước (+z, hướng ra biển).
  const R = SEAT_RADIUS + (T.r - 0.6);
  const a = -((T.seats - 1) * 2 * Math.PI) / T.seats + (i * 2 * Math.PI) / T.seats;
  return { x: T.x + Math.sin(a) * R, z: T.z + Math.cos(a) * R };
}

// Hướng mặt người ngồi ghế i (góc quay quanh trục y, 0 = nhìn về +z).
export function seatYaw(T, i) {
  const s = seatPos(T, i);
  return T.shape === 'long' ? (s.z < T.z ? 0 : Math.PI) : Math.atan2(T.x - s.x, T.z - s.z);
}

export function nearestFreeSeat(T, isTaken, x, z) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < T.seats; i++) {
    if (T.npcSeats?.includes(i) || isTaken(i)) continue;
    const s = seatPos(T, i), d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
