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
export const FLOOR_BOUNDS = [
  { minX: -17.6, maxX: 17.6, minZ: -15.6, maxZ: 3.1 },
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

export const MENU = [
  { icon: '🥜', name: 'Lạc rang', price: 15000 },
  { icon: '🦑', name: 'Mực nướng', price: 120000 },
  { icon: '🐌', name: 'Ốc len xào dừa', price: 80000 },
  { icon: '🍗', name: 'Chân gà nướng', price: 60000 },
  { icon: '🥩', name: 'Bò nhúng giấm', price: 150000 },
  { icon: '🍢', name: 'Nem chua rán', price: 50000 },
  { icon: '🦐', name: 'Tôm nướng muối ớt', price: 140000 },
  { icon: '🥒', name: 'Dưa chuột', price: 10000 },
  { icon: '🍲', name: 'Lẩu thái', price: 250000 },
  { icon: '🐸', name: 'Ếch chiên bơ', price: 110000 },
];

// Hành động người chơi được phát cho cả quán (không có chat).
export const ACTS = ['cheers', 'pour', 'wave', 'clap', 'water', 'offer', 'dance', 'dance-stop'];

export const SHIRTS = [0x2e86de, 0xe84393, 0xf6b93b, 0x6ab04c, 0xf5f5f5, 0x222222, 0x8e44ad, 0xe55039];
export const HAIRS = ['Tóc ngắn', 'Tóc dài', 'Hói'];

export const SONG_MS = 24000; // độ dài một lượt hát với beat tự chế
export const MAX_SONG_MS = 7 * 60 * 1000; // lượt hát theo video YouTube dài tối đa 7 phút
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
