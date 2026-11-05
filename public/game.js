// Bơi Hia Dứt Cạn — quán nhậu 3D nhiều người: ngồi chung bàn, không chat, chỉ có hành động.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
window.__boot?.(65, 'Đang dựng quán…');
import {
  ROOMS, TABLES, STAGE, MENU, MENU_CATS, SHIRTS, HAIRS, SONG_MS, MIC_DELAY_MS,
  FLOOR_H, FLOOR_NAMES, FLOOR_BOUNDS, SHORE, BUILDING, CORE, ELEVATOR, KITCHEN, WCS, DUMBWAITER, PARKING,
  MAX_SONG_MS, CHAT_MAX, seatPos, seatYaw, nearestFreeSeat, DRINKS, drinkOfTable, tabTotal,
  START_MONEY, ROUND_PRICE, VENDOR_PRICE, ITEMS, FISH_ZONE_Z, TRADER, nearTrader,
} from '/shared/world.js';
import { SONGS, GENRES, DEFAULT_SONG, parseYouTube } from '/shared/songs.js';
import { createVoice } from './voice.js';
import { createTableGames } from './tablegames.js';

// ================= Cấu hình =================
// Tài khoản nhận ủng hộ ("Bao chủ quán một ly"), ảnh QR ở public/donate-qr.png.
const DONATE = { bank: 'BIDV', owner: 'NGUYEN XUAN DOAN', account: '2152971408' };
const BEER = DRINKS.beer; // giá đồ uống dùng chung với server (shared/world.js)
const HAIR_COLORS = [0x1b1b1b, 0x3b2314, 0x5a3a22, 0x111111];
const drinkOf = (tableId) => drinkOfTable(TABLES[tableId]);
const tableName = (T) => T.name;

const LINES = {
  chuBa: ['Hồi xưa chú đi bộ đội…', 'Rượu này chú ngâm mười năm đấy.', 'Đời mà con, vui được ngày nào hay ngày đó.',
    'Con có người yêu chưa?', 'Uống rượu phải từ từ, ngấm mới ngon.', 'Ngồi đây với chú một lát.'],
  chuBaCheers: ['Cạn!', 'Dzô con!', 'Uống cho ấm bụng!'],
  traderBuy: ['Có gì đưa bà coi nào!', 'Cá tươi không con? Bà trả giá cao!', 'Cua ốc gì bà cũng lấy hết!'],
  traderEmpty: ['Giỏ trống trơn mà con! Ra bãi nhặt cua ốc đi rồi đem lại bà mua.', 'Câu được cá thì mang lại đây bà mua nghen!'],
  traderPaid: ['Tiền đây con, đi nhậu tiếp đi!', 'Hàng ngon, lần sau mang nữa nghe!', 'Bà trả sòng phẳng nhé!'],
  chuBaReply: ['Ừ, chú nghe đây.', 'Nói hay lắm, dzô cái nào!', 'Hồi xưa chú cũng thế.', 'Thôi uống đi con, chuyện đâu còn đó.',
    'Ha ha, con nói chí phải!', 'Tuổi trẻ mà, cứ từ từ.'],
  owner: ['Ăn gì gọi chị nhé!', 'Mực nướng hôm nay tươi lắm!', 'Bàn ngoài kia tính tiền chưa em?'],
  vendor: ['Lạc rang đây!', 'Đậu phộng nóng đây!', 'Mua giúp cô gói lạc đi con!'],
  guard: ['Xe để đây bác trông cho, yên tâm mà nhậu!', 'Say thì để xe lại, mai lấy nhé con.', 'Gió biển đêm nay mát ghê.'],
  waiter: ['Tầng này có thang tời, đồ ăn lên nhanh lắm ạ!', 'Cần thêm đá cứ gọi em nhé!', 'Phòng view biển đẹp nhất quán đó ạ.'],
  orderTaker: ['Anh chị gọi thêm gì không ạ?', 'Bàn mình thêm bia không anh?', 'Hôm nay có mực trứng ngon lắm ạ!', 'Em ghi order cho nhé!'],
  runner: ['Món ra đây ạ, nóng lắm cẩn thận!', 'Của anh chị đây ạ!', 'Mời cả bàn dùng ngon ạ!'],
  prep: ['Rau sạch vừa nhặt xong đây!', 'Hành phi thơm chưa?', 'Thái nhanh không đứt tay đâu, nghề rồi!'],
  dishwasher: ['Bát đĩa chất cao như núi rồi!', 'Rửa sạch bong kin kít luôn!', 'Ai ăn xong cho cô xin đĩa nhé!'],
  chef: ['Bếp nóng lắm, đứng xa ra kẻo bỏng!', 'Mực hôm nay tươi rói, gọi đi!', 'Nấu ba chục năm rồi đấy.',
    'Lẩu thái phải chua cay mới đúng vị.', 'Ra ngoài uống đi, đồ ăn chú mang ra ngay.'],
};
const ACT_EMOJI = { cheers: '🥂 Dzô!', pour: '🍺', wave: '👋', clap: '👏', water: '💧' };

const DRUNK_LEVELS = [
  { at: 0, label: 'Tỉnh táo', ico: '😊' },
  { at: 25, label: 'Lâng lâng', ico: '😄', msg: 'Bắt đầu thấy lâng lâng rồi đấy 😊' },
  { at: 55, label: 'Say rồi', ico: '🥴', msg: 'Mặt đỏ tưng bừng, đi đứng loạng choạng 🥴' },
  { at: 85, label: 'Sắp gục', ico: '😵', msg: 'Sắp gục rồi! Uống nước lọc đi (6) 💧' },
];

// ================= Tiện ích =================
const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';
const isTouch = matchMedia('(pointer: coarse)').matches;
const KEY_HINT = isTouch ? '👆' : '<kbd>E</kbd>';
function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const onStage = (a) => a.f === STAGE.floor && Math.abs(a.rx - STAGE.x) < STAGE.w / 2 && Math.abs(a.rz - STAGE.z) < STAGE.d / 2;

// ================= Renderer & scene =================
const canvas = $('game');
// alpha: màn chiếu karaoke "đục lỗ" canvas để lộ video YouTube ở lớp CSS3D bên dưới.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // chỉnh lại theo cài đặt đồ hoạ ở applyQuality()
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 40, 320);
// Cảnh đổi theo giao diện: sáng = ban ngày, tối = ban đêm (xem setSceneDay)
const nightOnly = [], dayOnly = [], hotelMats = [];
let fogFar = 320;

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);

// Màn hình dọc (điện thoại, máy tính bảng) thì mở rộng góc nhìn để thấy được cả bàn.
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 60 + (1 - camera.aspect) * 40 : 60;
  camera.updateProjectionMatrix();
}
fitCamera();
// Góc nhìn lúc mới vào: đứng sau lưng, thấp ngang tầm mắt, lùi đủ xa để thấy trọn mặt tiền và biển hiệu quán.
// Màn hình hẹp (điện thoại dọc) thì góc ngang hẹp nên lùi xa hơn; màn hình rộng giữ 7 m.
const START_VIEW = { pitch: 0.14, width: 10, ahead: 3.6 }; // width: bề ngang mặt tiền cần thấy; ahead: từ nhân vật tới mặt tiền
let atStartView = false;
function startView() {
  const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  const dist = START_VIEW.width / 2 / Math.tan(half) - START_VIEW.ahead;
  Object.assign(cam, { yaw: 0, pitch: START_VIEW.pitch, dist: clamp(dist, 7, 9) });
  atStartView = true;
}
addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
  cssRenderer.setSize(innerWidth, innerHeight);
  if (atStartView) startView(); // xoay ngang/dọc khi chưa chỉnh camera thì tính lại cho vừa
});

// ---------- Hàm dựng hình ----------
const matCache = new Map();
function mat(color, extra) {
  if (extra) return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return matCache.get(color);
}
function add(geo, material, x, y, z, parent = scene) {
  const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const box = (w, h, d, c, x, y, z, p) => add(new THREE.BoxGeometry(w, h, d), c, x, y, z, p);
const cyl = (rt, rb, h, c, x, y, z, p) => add(new THREE.CylinderGeometry(rt, rb, h, 16), c, x, y, z, p);
const ball = (r, c, x, y, z, p) => add(new THREE.SphereGeometry(r, 16, 12), c, x, y, z, p);
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function emojiSprite(emoji, size) {
  const tex = canvasTexture(128, 128, (g) => {
    g.font = '100px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 64, 70);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(size, size, size);
  return s;
}

// ---------- Va chạm (theo từng tầng) ----------
const colliders = FLOOR_BOUNDS.map(() => ({ circles: [], boxes: [] }));
const solidBox = (f, cx, cz, w, d, extra) =>
  colliders[f].boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, ...extra });
const solidCircle = (f, x, z, r) => colliders[f].circles.push({ x, z, r });
const inRect = (r, x, z) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;

// Cửa phòng riêng chỉ chặn khi phòng khoá, chủ phòng vẫn vào được, người đang ở trong vẫn ra được.
function doorBlocks(b, p) {
  const st = roomState.get(b.door);
  return !!st?.locked && st.owner !== myId && !inRect(b.room, p.x, p.z);
}

function collide(p, f) {
  const R = 0.3, { circles, boxes } = colliders[f];
  for (const c of circles) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < c.r + R && d > 1e-4) {
      const k = (c.r + R - d) / d;
      p.x += dx * k;
      p.z += dz * k;
    }
  }
  for (const b of boxes) {
    if (b.door !== undefined && !doorBlocks(b, p)) continue;
    const dx = p.x - clamp(p.x, b.minX, b.maxX), dz = p.z - clamp(p.z, b.minZ, b.maxZ), d = Math.hypot(dx, dz);
    if (d < R && d > 1e-4) {
      const k = (R - d) / d;
      p.x += dx * k;
      p.z += dz * k;
    }
  }
  const B = FLOOR_BOUNDS[f];
  p.x = clamp(p.x, B.minX, B.maxX);
  p.z = clamp(p.z, B.minZ, B.maxZ);
}

// ---------- Tìm đường tránh vật cản (bấm để đi) ----------
// Lưới ô CELL m trên mỗi tầng, ô bị chặn nếu tâm ô cách vật cản dưới bán kính người chơi.
// Vật cản tĩnh dựng một lần (lần đầu tìm đường trên tầng đó), cửa phòng riêng xét lúc tìm vì khoá/mở thay đổi.
const CELL = 0.25, CLEAR = 0.32;
const navGrids = [];
function navGrid(f) {
  if (navGrids[f]) return navGrids[f];
  const B = FLOOR_BOUNDS[f], w = Math.ceil((B.maxX - B.minX) / CELL) + 1, h = Math.ceil((B.maxZ - B.minZ) / CELL) + 1;
  const g = { B, w, h, cells: new Uint8Array(w * h), doors: [] };
  const mark = (minX, maxX, minZ, maxZ, hit, out = g.cells) => {
    const i0 = Math.max(0, Math.floor((minX - CLEAR - B.minX) / CELL)), i1 = Math.min(w - 1, Math.ceil((maxX + CLEAR - B.minX) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - CLEAR - B.minZ) / CELL)), j1 = Math.min(h - 1, Math.ceil((maxZ + CLEAR - B.minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (hit(B.minX + i * CELL, B.minZ + j * CELL)) out[j * w + i] = 1;
  };
  g.markBox = (b, out) => mark(b.minX, b.maxX, b.minZ, b.maxZ,
    (x, z) => Math.hypot(x - clamp(x, b.minX, b.maxX), z - clamp(z, b.minZ, b.maxZ)) < CLEAR, out);
  for (const c of colliders[f].circles) mark(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, (x, z) => Math.hypot(x - c.x, z - c.z) < c.r + CLEAR);
  for (const b of colliders[f].boxes) (b.door !== undefined ? g.doors.push(b) : g.markBox(b));
  return (navGrids[f] = g);
}

// Ô đi được gần (x,z) nhất: dùng để đặt nhân viên không chồng lên bàn ghế, tường, đồ vật.
function freeSpot(f, x, z) {
  const g = navGrid(f), { B, w, h } = g;
  const i0 = clamp(Math.round((x - B.minX) / CELL), 0, w - 1), j0 = clamp(Math.round((z - B.minZ) / CELL), 0, h - 1);
  for (let r = 0; r <= 16; r++) {
    let best = null, bd = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r || i < 0 || j < 0 || i >= w || j >= h || g.cells[j * w + i]) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = { x: B.minX + i * CELL, z: B.minZ + j * CELL }; }
    }
    if (best) return best;
  }
  return { x, z };
}

// Trả về các điểm rẽ từ (sx,sz) tới đích (bỏ điểm xuất phát), đích bị chặn thì dừng ở ô trống gần nhất. null nếu không có đường.
// staff = true: nhân viên phục vụ có chìa khoá, đi qua được cửa phòng riêng đang khoá.
function findPath(f, sx, sz, tx, tz, staff = false) {
  const g = navGrid(f), { B, w, h } = g;
  const cells = g.cells.slice();
  if (!staff) for (const d of g.doors) if (doorBlocks(d, { x: sx, z: sz })) g.markBox(d, cells);
  const cellOf = (x, z) => [clamp(Math.round((x - B.minX) / CELL), 0, w - 1), clamp(Math.round((z - B.minZ) / CELL), 0, h - 1)];
  const free = (i, j) => i >= 0 && j >= 0 && i < w && j < h && !cells[j * w + i];
  // Ô trống gần nhất (đang đứng sát vật cản, hoặc bấm trúng bàn/tường)
  const nearestFree = (i, j) => {
    for (let r = 0; r <= 12; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !free(i + di, j + dj)) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = [i + di, j + dj]; }
      }
      if (best) return best;
    }
    return null;
  };
  const s = nearestFree(...cellOf(sx, sz)), t = nearestFree(...cellOf(tx, tz));
  if (!s || !t) return null;
  const goalBlocked = t[0] !== cellOf(tx, tz)[0] || t[1] !== cellOf(tx, tz)[1];
  // A* 8 hướng, không cắt góc vật cản
  const start = s[1] * w + s[0], goal = t[1] * w + t[0];
  const gScore = new Float32Array(w * h).fill(Infinity), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
  const heap = [];
  const push = (n, fs) => {
    heap.push([fs, n]);
    for (let k = heap.length - 1; k > 0;) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  const hfn = (n) => { const dx = Math.abs((n % w) - t[0]), dy = Math.abs(((n / w) | 0) - t[1]); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  gScore[start] = 0;
  push(start, hfn(start));
  let found = false;
  for (let iter = 0; heap.length && iter < 80000; iter++) {
    const n = pop();
    if (n === goal) { found = true; break; }
    if (closed[n]) continue;
    closed[n] = 1;
    const i = n % w, j = (n / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if ((!di && !dj) || !free(i + di, j + dj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      const m = (j + dj) * w + i + di, ng = gScore[n] + (di && dj ? Math.SQRT2 : 1);
      if (ng < gScore[m]) { gScore[m] = ng; from[m] = n; push(m, ng + hfn(m)); }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let n = goal; n !== -1; n = from[n]) pts.push({ x: B.minX + (n % w) * CELL, z: B.minZ + ((n / w) | 0) * CELL });
  pts.reverse();
  pts[0] = { x: sx, z: sz };
  if (!goalBlocked) pts[pts.length - 1] = { x: tx, z: tz };
  // Rút gọn: bỏ các điểm giữa nếu đi thẳng được (dò từng đoạn 0.1 m qua lưới)
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
    for (let k = 1; k < n; k++) {
      const [i, j] = cellOf(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n);
      if (!free(i, j)) return false;
    }
    return true;
  };
  const out = [];
  for (let a = 0; a < pts.length - 1;) {
    let b = pts.length - 1;
    while (b > a + 1 && !clear(pts[a], pts[b])) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}

// ---------- Vật click được ----------
// info: { f: tầng (số hoặc hàm), pos(): {x,z}, range, label(): html, action() }
const clickables = [];
function clickable(obj, info) {
  obj.userData.click = info;
  clickables.push(obj);
  return obj;
}
function unclickable(obj) {
  const i = clickables.indexOf(obj);
  if (i >= 0) clickables.splice(i, 1);
}
const floorOf = (info) => (typeof info.f === 'function' ? info.f() : info.f);

// ================= Khung cảnh =================
const hemi = new THREE.HemisphereLight(0x8899cc, 0x2a1d10, 0.9);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(hemi, ambient);

// Mỗi tầng là một group ở độ cao f * FLOOR_H. Ở trong nhà thì các tầng phía trên được ẩn để camera nhìn vào.
const floors = FLOOR_NAMES.map((_, f) => {
  const g = new THREE.Group();
  g.position.y = f * FLOOR_H;
  scene.add(g);
  return g;
});
const [F1, F2, F3] = floors;
const facade = FLOOR_NAMES.map(() => []); // tường mặt tiền từng tầng, ẩn đi khi đứng trong tầng đó

function pointLight(parent, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 1.3);
  l.position.set(x, y, z);
  parent.add(l);
  return l;
}
function tiles(c1, c2, rx, ry) {
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = c2;
    g.lineWidth = 4;
    g.strokeRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
}
function floorPlane(parent, w, d, material, x, z, y = 0.01) {
  const m = add(new THREE.PlaneGeometry(w, d), material, x, y, z, parent);
  m.rotation.x = -Math.PI / 2;
  return m;
}
// Đặt font, nếu chữ dài hơn maxW thì co cỡ chữ lại cho vừa (để biển không bị cắt chữ).
function fitFont(g, text, font, maxW) {
  g.font = font;
  const w = g.measureText(text).width;
  if (w > maxW) g.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => Math.floor((n * maxW) / w) + 'px');
}
function textPlane(parent, text, w, h, x, y, z, ry = 0, { bg = '#3e2723', fg = '#fff', font = 'bold 64px sans-serif' } = {}) {
  const tex = canvasTexture(Math.round(w * 256), Math.round(h * 256), (g, cw, ch) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = fg;
    const size = Math.min(parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]), ch * 0.72); // không cao quá biển
    fitFont(g, text, font.replace(/(\d+(?:\.\d+)?)px/, size + 'px'), cw * 0.9);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, cw / 2, ch / 2);
  });
  const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x, y, z, parent);
  m.rotation.y = ry;
  return m;
}

// Tường thẳng theo trục x hoặc z, có va chạm (trừ khi solid: false).
// Tường tầng phòng riêng (tầng 2): mỗi bức một vật liệu riêng để làm mờ khi che camera (xem fadeRoomWalls).
const roomFloorWalls = [];
function wall(f, x1, z1, x2, z2, h, color, { y = 0, solid = true, front = false } = {}) {
  const w = Math.abs(x2 - x1) || 0.2, d = Math.abs(z2 - z1) || 0.2, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const m = box(w, h, d, color, cx, y + h / 2, cz, floors[f]);
  if (solid) solidBox(f, cx, cz, w, d);
  if (front) facade[f].push(m);
  if (f === 1 && !front) {
    m.material = m.material.clone();
    m.userData.fade = 1;
    roomFloorWalls.push(m);
  }
  return m;
}
// Tường dọc theo trục x có một lỗ cửa [a, b].
function wallWithDoor(f, x1, x2, z, a, b, h, color, opts = {}) {
  wall(f, x1, z, a, z, h, color, opts);
  wall(f, b, z, x2, z, h, color, opts);
  if (h > 2.4) wall(f, a, z, b, z, h - 2.3, color, { ...opts, y: 2.3, solid: false });
}

const WALL = 0xd7c4a3, WALL_IN = 0xefe3cc, B = BUILDING, H = FLOOR_H;
const BW = B.maxX - B.minX, BD = B.maxZ - B.minZ, BCZ = (B.minZ + B.maxZ) / 2; // kích thước toà nhà

// ---------- Đường ven biển & bãi biển (phía trước quán, hướng +z là hướng ra biển) ----------
const SEA_Z = SHORE.seaZ;
const ground = add(new THREE.PlaneGeometry(1200, 50), 0x1d1f24, 0, -0.01, -21.6); // phần đất phía sau
ground.rotation.x = -Math.PI / 2;
floorPlane(scene, 1200, 7.2, mat(0x2b2d33), 0, 7, 0); // mặt đường
floorPlane(F1, BW + 2, 4.2, tiles('#7a6f62', '#5c534a', BW, 4), 0, 1.1, 0.02); // vỉa hè trước quán
floorPlane(scene, 1200, 4.2, mat(0x5e5a55), 0, 1.1, 0.01); // vỉa hè cả dãy phố
box(1200, 0.15, 0.25, 0x9a9a9a, 0, 0.07, 3.3);
for (let x = -300; x < 300; x += 6) box(3, 0.01, 0.15, 0xdddddd, x, 0.01, 7);

// Lối đi bộ ven biển, hàng dừa, bãi cát, sóng
floorPlane(scene, 1200, 2.9, tiles('#9e9488', '#7d746a', 400, 1), 0, 12.05, 0.02);
box(1200, 0.15, 0.25, 0x9a9a9a, 0, 0.07, 10.6);
{
  const [a, b] = SHORE.stairs, W = SHORE.wallZ;
  for (const [x1, x2] of [[-600, a], [b, 600]]) box(x2 - x1, 0.45, 0.25, 0xe0ddd5, (x1 + x2) / 2, 0.22, W);
  for (const [x1, x2] of [[-SHORE.halfW, a], [b, SHORE.halfW]]) solidBox(0, (x1 + x2) / 2, W, x2 - x1, 0.25);
  // bậc xuống bãi cát
  for (let i = 0; i < 3; i++) box(b - a + 0.6, 0.3 - i * 0.1, 0.35, 0xd6d2c8, 0, (0.3 - i * 0.1) / 2, W + 0.2 + i * 0.35);
}
floorPlane(scene, 1200, SEA_Z - 13.6, new THREE.MeshStandardMaterial({ color: 0xe0c896, roughness: 1, emissive: 0x2a2416 }), 0, (13.6 + SEA_Z) / 2, 0);
floorPlane(scene, 1200, 5, mat(0x8f7d5c, { roughness: 0.6 }), 0, SEA_Z - 2.5, 0.005); // cát ướt

function palm(x, z, h = 6 + Math.random() * 2.5) {
  const g = new THREE.Group();
  const lean = (Math.random() - 0.5) * 0.25;
  for (let i = 0; i < 5; i++) {
    const seg = cyl(0.14 - i * 0.015, 0.16 - i * 0.015, h / 5, 0x6d5a45, lean * i * 0.6, (h / 5) * (i + 0.5), 0, g);
    seg.rotation.z = -lean;
  }
  const crown = new THREE.Group();
  crown.position.set(lean * 3, h, 0);
  g.add(crown);
  for (let i = 0; i < 8; i++) {
    const leaf = add(new THREE.ConeGeometry(0.35, 3, 4), 0x2e5e2a, 0, 0, 0, crown);
    leaf.scale.z = 0.2;
    leaf.rotation.set(0, (i / 8) * Math.PI * 2, 0);
    leaf.rotateZ(1.9);
    leaf.translateY(1.3);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}
for (let x = -150; x <= 150; x += 9) {
  const px = x + (Math.random() - 0.5) * 2;
  palm(px, 12.2);
  if (Math.abs(px) < SHORE.halfW + 1) solidCircle(0, px, 12.2, 0.25);
}
for (let x = -144; x <= 144; x += 18) {
  if (x === 0) continue; // không dựng cột giữa vạch qua đường, khỏi che mặt tiền quán
  cyl(0.06, 0.08, 5, 0x37474f, x, 2.5, 11.2);
  if (Math.abs(x) < SHORE.halfW + 1) solidCircle(0, x, 11.2, 0.12);
  ball(0.16, new THREE.MeshBasicMaterial({ color: 0xfff1c1 }), x, 5.05, 11.2);
}
cyl(0.07, 0.09, 4.5, 0x37474f, 10.5, 2.25, 3.5);
solidCircle(0, 10.5, 3.5, 0.12);
// Vạch qua đường ngay trước cửa quán
for (let z = SHORE.curbZ + 0.5; z < SHORE.roadMaxZ - 0.3; z += 0.9) box(3, 0.012, 0.45, 0xf2f2f2, 0, 0.012, z);
// Mặt trước dãy khách sạn hai bên: không đi vòng ra sau được
for (const side of [-1, 1]) solidBox(0, side * (B.maxX + SHORE.halfW) / 2, B.maxZ - 0.1, SHORE.halfW - B.maxX, 0.2);
box(0.9, 0.08, 0.2, 0x37474f, 10.1, 4.5, 3.5);
ball(0.12, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), 9.7, 4.4, 3.5);
pointLight(scene, 0xfff2cc, 14, 16, 9.7, 4.2, 3.5);

// Mặt biển: lưới sóng nhấp nhô (cập nhật trong updateWorld)
const seaGeo = new THREE.PlaneGeometry(1400, 600, 140, 60);
seaGeo.rotateX(-Math.PI / 2);
const sea = add(seaGeo, mat(0x0b2742, { roughness: 0.25, metalness: 0.3 }), 0, -0.05, SEA_Z + 300);
const seaBase = Float32Array.from(seaGeo.attributes.position.array);
const foams = [];
for (let i = 0; i < 3; i++) {
  const f = add(new THREE.PlaneGeometry(1200, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }), 0, 0.03, SEA_Z + i * 3);
  f.rotation.x = -Math.PI / 2;
  f.userData.phase = i * 2.1;
  foams.push(f);
}

// Trăng mọc trên biển và vệt sáng trên mặt nước
const MOON = new THREE.Vector3(-60, 42, 420);
nightOnly.push(ball(6, new THREE.MeshBasicMaterial({ color: 0xfff6d5, fog: false }), MOON.x, MOON.y, MOON.z));
const moonGlow = emojiSprite('', 1);
moonGlow.material = new THREE.SpriteMaterial({
  map: canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,240,200,0.6)');
    r.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }),
  transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
});
moonGlow.scale.set(60, 60, 1);
moonGlow.position.copy(MOON);
scene.add(moonGlow);
nightOnly.push(moonGlow);
// Mặt trời buổi sáng trên biển (chỉ hiện ban ngày)
const SUN = new THREE.Vector3(70, 150, 420);
dayOnly.push(ball(11, new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false }), SUN.x, SUN.y, SUN.z));
{
  const sunGlow = new THREE.Sprite(moonGlow.material.clone());
  sunGlow.scale.set(140, 140, 1);
  sunGlow.position.copy(SUN);
  scene.add(sunGlow);
  dayOnly.push(sunGlow);
}
{
  const path = new THREE.Group();
  path.position.set(0, 0.06, SEA_Z + 2);
  path.rotation.y = Math.atan2(MOON.x, MOON.z - SEA_Z);
  const tex = canvasTexture(64, 256, (g) => {
    for (let y = 0; y < 256; y += 3) {
      const a = 0.12 + Math.random() * 0.35;
      g.fillStyle = `rgba(255,236,190,${a})`;
      const w = 10 + Math.random() * 40;
      g.fillRect(32 - w / 2, y, w, 2);
    }
  });
  const m = add(new THREE.PlaneGeometry(28, 380), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8,
  }), 0, 0, 190, path);
  m.rotation.x = -Math.PI / 2;
  scene.add(path);
  nightOnly.push(path);
}
const moonLight = new THREE.DirectionalLight(0xbcd0ff, 0.5);
moonLight.position.copy(MOON);
scene.add(moonLight);

// Đèn thuyền câu mực ngoài khơi
const boats = [];
for (let i = 0; i < 34; i++) {
  const x = -320 + Math.random() * 480, z = 140 + Math.random() * 280;
  const b = ball(0.5 + Math.random() * 0.4, new THREE.MeshBasicMaterial({ color: Math.random() < 0.7 ? 0xfff4c2 : 0xc8f0ff, fog: false }), x, 0.6, z);
  b.userData.phase = Math.random() * 6;
  boats.push(b);
}

// Bán đảo Sơn Trà ở phía bắc (+x) và tượng Phật Quan Âm chùa Linh Ứng
{
  const hill = new THREE.MeshBasicMaterial({ color: 0x0d1a15, fog: false });
  for (const [x, z, r, sy] of [[260, 120, 90, 0.55], [340, 40, 110, 0.5], [220, 230, 70, 0.6], [300, 260, 80, 0.45], [380, 160, 100, 0.65]]) {
    const m = add(new THREE.SphereGeometry(r, 24, 12), hill, x, -20, z);
    m.scale.y = sy;
  }
  for (let i = 0; i < 18; i++) ball(0.6, new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }), 175 + Math.random() * 60, 2 + Math.random() * 12, 60 + Math.random() * 120);
  const statue = new THREE.MeshBasicMaterial({ color: 0xf4f1e8, fog: false });
  cyl(1.2, 2.2, 14, statue, 215, 26.6, 150);
  ball(1.4, statue, 215, 34.5, 150);
  const glow = new THREE.Sprite(moonGlow.material.clone());
  glow.scale.set(28, 34, 1);
  glow.position.set(215, 28, 150);
  scene.add(glow);
  nightOnly.push(glow);
}

// Khách sạn cao tầng dọc biển hai bên quán
const windowTex = canvasTexture(128, 256, (g, w, h) => {
  g.fillStyle = '#2b2f3a';
  g.fillRect(0, 0, w, h);
  for (let y = 12; y < h; y += 40) {
    for (let x = 10; x < w; x += 40) {
      g.fillStyle = Math.random() < 0.55 ? '#ffd27a' : '#1a1d24';
      g.fillRect(x, y, 22, 26);
    }
  }
});
windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
// Mặt tiền khách sạn ban ngày: tường sáng, cửa kính xanh phản chiếu trời
const windowDayTex = canvasTexture(128, 256, (g, w, h) => {
  g.fillStyle = '#e4ddd0';
  g.fillRect(0, 0, w, h);
  for (let y = 12; y < h; y += 40) {
    for (let x = 10; x < w; x += 40) {
      g.fillStyle = Math.random() < 0.5 ? '#7fb2d6' : '#5f93b9';
      g.fillRect(x, y, 22, 26);
    }
  }
});
windowDayTex.wrapS = windowDayTex.wrapT = THREE.RepeatWrapping;
for (const side of [-1, 1]) {
  let x = B.maxX + 0.4;
  for (let i = 0; i < 14; i++) {
    const w = 9 + ((i * 7) % 5) * 1.5, h = 10 + ((i * 13 + (side > 0 ? 5 : 0)) % 9) * 4.5, t = windowTex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 3, h / 4);
    const hm = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 });
    const td = windowDayTex.clone();
    td.needsUpdate = true;
    td.repeat.copy(t.repeat);
    hm.userData = { nightMap: t, dayMap: td };
    hotelMats.push(hm);
    box(w, h, 16, hm, side * (x + w / 2), h / 2, -9);
    x += w + 1.5;
  }
}

// Trăng sao
{
  const pts = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.2, r = 600;
    pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false }));
  scene.add(stars);
  nightOnly.push(stars);
}

// Xe máy
function makeMotorbike(color) {
  const g = new THREE.Group();
  box(1.1, 0.3, 0.28, color, 0, 0.55, 0, g);
  box(0.55, 0.1, 0.3, 0x111111, -0.15, 0.75, 0, g);
  box(0.06, 0.5, 0.06, 0x555555, 0.45, 0.85, 0, g);
  box(0.06, 0.06, 0.6, 0x222222, 0.45, 1.1, 0, g);
  ball(0.07, new THREE.MeshBasicMaterial({ color: 0xffffcc }), 0.55, 0.95, 0, g);
  for (const wx of [-0.45, 0.5]) add(new THREE.TorusGeometry(0.25, 0.07, 8, 16), 0x111111, wx, 0.3, 0, g);
  return g;
}

// Bãi giữ xe trên vỉa hè (bên phải cửa)
{
  const P = PARKING, palette = [0xc62828, 0x1565c0, 0x212121, 0xf9a825, 0x6a1b9a, 0x2e7d32, 0xeceff1];
  const colors = Array.from({ length: Math.floor(P.maxX - P.minX - 0.4) }, (_, i) => palette[(i * 3) % palette.length]);
  floorPlane(F1, P.maxX - P.minX, P.maxZ - P.minZ, new THREE.MeshBasicMaterial({ color: 0x3a4a5a, transparent: true, opacity: 0.35 }), (P.minX + P.maxX) / 2, (P.minZ + P.maxZ) / 2, 0.03);
  colors.forEach((c, i) => {
    const m = makeMotorbike(c);
    m.position.set(P.minX + 0.5 + i * 1, 0, (P.minZ + P.maxZ) / 2);
    m.rotation.y = Math.PI / 2 + 0.25;
    F1.add(m);
  });
  solidBox(0, (P.minX + P.maxX) / 2, (P.minZ + P.maxZ) / 2, P.maxX - P.minX, P.maxZ - P.minZ);
  cyl(0.03, 0.03, 1.6, 0x555555, P.minX - 0.3, 0.8, P.maxZ, F1);
  textPlane(F1, '🅿 GIỮ XE', 1.4, 0.45, P.minX - 0.3, 1.8, P.maxZ + 0.02, 0, { bg: '#1565c0', font: 'bold 64px sans-serif' });
}

// ---------- Vỏ toà nhà ----------
for (let f = 0; f < 3; f++) {
  const h = f === 2 ? 1 : H; // sân thượng chỉ có lan can
  const color = f === 2 ? 0xbcaaa4 : WALL;
  wall(f, B.minX, B.minZ, B.maxX, B.minZ, h, color);
  wall(f, B.minX, B.minZ, B.minX, B.maxZ, h, color);
  wall(f, B.maxX, B.minZ, B.maxX, B.maxZ, h, color);
  if (f > 0) box(BW + 0.4, 0.2, BD + 0.4, 0x8d8172, 0, -0.1, BCZ, floors[f]); // sàn = trần tầng dưới
}
wall(2, B.minX, B.maxZ, B.maxX, B.maxZ, 1, 0xbcaaa4); // lan can sân thượng phía biển

// Mặt tiền tầng 1: cửa lớn ở giữa, mái hiên và dây đèn
// Mặt tiền tầng 1 để mở toang ra vỉa hè: chỉ còn cột, dầm đỡ tầng 2 và cửa cuốn đã kéo lên.
wall(0, B.minX, B.maxZ, B.maxX, B.maxZ, 0.45, WALL, { y: H - 0.45, solid: false, front: true });
for (const x of [B.minX + 0.2, -6, 6, B.maxX - 0.2]) {
  facade[0].push(box(0.4, H - 0.45, 0.4, WALL, x, (H - 0.45) / 2, B.maxZ, F1));
  solidBox(0, x, B.maxZ, 0.4, 0.4);
}
for (const [x0, x1] of [[B.minX + 0.4, -6.2], [-5.8, 5.8], [6.2, B.maxX - 0.4]]) {
  facade[0].push(box(x1 - x0, 0.28, 0.3, 0x9e9e9e, (x0 + x1) / 2, H - 0.6, B.maxZ - 0.05, F1)); // hộp cửa cuốn
}
// Mái hiên và dây đèn cũng ẩn khi vào trong nhà, kẻo che mất camera.
facade[0].push(box(BW + 0.4, 0.08, 1.4, 0x9e2a2b, 0, 2.95, -0.35, F1)); // mái hiên
for (let x = B.minX + 0.5; x <= B.maxX - 0.5; x += 0.5) {
  const c = [0xffd54f, 0xff8a65, 0xfff59d, 0x81d4fa][Math.floor((x - B.minX) * 2) % 4];
  facade[0].push(ball(0.05, new THREE.MeshBasicMaterial({ color: c }), x, 2.75 - 0.15 * Math.abs(Math.sin(((x - B.minX) / 4) * Math.PI)), 0.3, F1));
}
for (const x of [-12, 0, 12]) pointLight(F1, 0xffb060, 8, 11, x, 2.5, 0.8);

// Mặt tiền tầng 2: cửa kính nhìn ra biển và biển hiệu lớn
wall(1, B.minX, B.maxZ, B.maxX, B.maxZ, H, WALL, { front: true });
for (const x of TABLES.filter((t) => t.floor === 1 && t.room?.maxZ === B.maxZ).map((t) => t.x)) facade[1].push(box(3, 1.6, 0.05, new THREE.MeshBasicMaterial({ color: 0xffcf8a }), x, 1.6, B.maxZ + 0.12, F2));
// Biển hiệu kiểu bia hơi Việt Nam: nền tôn vàng gân dọc, chữ đỏ có chân viền trắng.
const SHOP_NAME = 'Bơi Hia Dứt Cạn';
const signTex = canvasTexture(2048, 496, (g, w, h) => {
  // nền tôn vàng có gân dọc
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#ffd54a');
  bg.addColorStop(0.5, '#ffc928');
  bg.addColorStop(1, '#f2b31b');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 22) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x, 0, 6, h);
    g.fillStyle = 'rgba(160,100,0,0.14)';
    g.fillRect(x + 12, 0, 5, h);
  }
  g.fillStyle = '#c9961a';
  g.fillRect(0, 0, w, 14);
  g.fillRect(0, h - 14, w, 14);
  // chữ đỏ viền trắng, có bóng đổ
  const red = (text, font, x, y, align = 'center', stroke = 10) => {
    g.font = font;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(80,0,0,0.45)';
    g.shadowBlur = 8;
    g.shadowOffsetX = g.shadowOffsetY = 5;
    g.strokeStyle = '#fff';
    g.lineWidth = stroke;
    g.strokeText(text, x, y);
    g.shadowColor = 'transparent';
    g.fillStyle = '#d0201c';
    g.fillText(text, x, y);
  };
  // khối trái: "Bơi Hia", ba ngôi sao, địa chỉ
  red('Bơi Hia', 'bold 118px Georgia, "Times New Roman", serif', 290, 185, 'center', 9);
  for (const sx of [170, 290, 410]) red('★', 'bold 64px serif', sx, 280, 'center', 6);
  g.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.strokeStyle = 'rgba(120,70,0,0.6)';
  g.lineWidth = 4;
  g.strokeText('BIA TƯƠI · MỒI NGON', 290, 362);
  g.fillText('BIA TƯƠI · MỒI NGON', 290, 362);
  // tên lớn
  fitFont(g, 'Dứt Cạn', 'bold 290px Georgia, "Times New Roman", serif', 1380);
  red('Dứt Cạn', g.font, 1290, 330, 'center', 16);
  // khẩu hiệu
  fitFont(g, 'Đã Vào Là Dứt · Đã Uống Là Cạn', 'italic bold 62px Georgia, "Times New Roman", serif', 1300);
  red('Đã Vào Là Dứt · Đã Uống Là Cạn', g.font, 1290, 440, 'center', 7);
});
signTex.anisotropy = 4;
facade[1].push(add(new THREE.PlaneGeometry(6.2, 1.5), new THREE.MeshBasicMaterial({ map: signTex }), 0, 2.35, B.maxZ + 0.14, F2));

// ---------- WC nam/nữ (mỗi tầng một khu) ----------
const wcDoors = []; // cửa WC có bản lề, tự mở khi có người lại gần
function buildWC(wc) {
  const f = wc.floor, P = floors[f], h = f === 2 ? 2.6 : H;
  const front = wc.doorZ === wc.maxZ ? wc.maxZ : wc.minZ;
  const back = front === wc.maxZ ? wc.minZ : wc.maxZ, dz = front === wc.maxZ ? 1 : -1;
  const stalls = [
    { minX: wc.minX, maxX: wc.divX, label: '🚹 NAM', bg: '#0277bd', floorC: '#b3e5fc' },
    { minX: wc.divX, maxX: wc.maxX, label: '🚺 NỮ', bg: '#ad1457', floorC: '#f8bbd0' },
  ];
  // Tường trước có 2 cửa, vách giữa, tường hông
  const doorsX = stalls.map((s) => (s.minX + s.maxX) / 2);
  wall(f, wc.minX, front, doorsX[0] - 0.5, front, h, WALL_IN);
  wall(f, doorsX[0] + 0.5, front, doorsX[1] - 0.5, front, h, WALL_IN);
  wall(f, doorsX[1] + 0.5, front, wc.maxX, front, h, WALL_IN);
  stalls.forEach((s, i) => {
    const x = doorsX[i];
    wall(f, x - 0.5, front, x + 0.5, front, h - 2.15, WALL_IN, { y: 2.15, solid: false }); // phần tường trên cửa
    const pivot = new THREE.Group(); // bản lề ở mép trái cửa
    pivot.position.set(x - 0.5, 0, front);
    P.add(pivot);
    box(0.98, 2.1, 0.05, i === 0 ? 0x4f83cc : 0xd77aa5, 0.49, 1.05, 0, pivot);
    ball(0.04, 0xd4af37, 0.85, 1.05, dz * 0.04, pivot); // tay nắm
    wcDoors.push({ pivot, f, x, z: front, dz, open: 0 });
  });
  wall(f, wc.divX, wc.minZ, wc.divX, wc.maxZ, h, WALL_IN);
  if (Math.abs(wc.maxX) < B.maxX - 0.1) wall(f, wc.maxX, wc.minZ, wc.maxX, wc.maxZ, h, WALL_IN);
  if (f === 2) {
    // Trên sân thượng tường bao chỉ là lan can thấp, nên dựng thêm vách lùi vào trong một chút.
    wall(f, wc.minX + 0.15, back - dz * 0.15, wc.maxX, back - dz * 0.15, h, WALL_IN);
    wall(f, wc.minX + 0.15, wc.minZ, wc.minX + 0.15, wc.maxZ, h, WALL_IN);
    box(wc.maxX - wc.minX + 0.3, 0.12, wc.maxZ - wc.minZ + 0.3, 0x6d4c41, (wc.minX + wc.maxX) / 2, h, (wc.minZ + wc.maxZ) / 2, P);
  }
  // Mặt trong tường sau, z(d) = điểm cách tường sau d mét vào trong. Sân thượng có vách hông lùi vào 0.15.
  const inset = f === 2 ? 0.15 : 0;
  const backFace = back + dz * 0.1, z = (d) => backFace + dz * d;
  const span = (a, b) => ({ minZ: Math.min(z(a), z(b)), maxZ: Math.max(z(a), z(b)) });
  const faceIn = dz > 0 ? 0 : Math.PI, faceWall = dz > 0 ? Math.PI : 0; // yaw quay ra phòng / quay vào tường
  stalls.forEach((s, i) => {
    const cx = (s.minX + s.maxX) / 2, d = wc.maxZ - wc.minZ;
    floorPlane(P, s.maxX - s.minX, d, tiles(s.floorC, '#ffffff', 4, 4), cx, (wc.minZ + wc.maxZ) / 2, 0.015);
    textPlane(P, s.label, 1.1, 0.4, cx, 2.45, front + dz * 0.12, faceIn, { bg: s.bg, font: 'bold 52px sans-serif' });
    const x0 = s.minX + 0.1 + (i === 0 ? inset : 0), x1 = s.maxX - 0.1;
    // Bồn rửa mặt ở góc phải, phần còn lại dành cho buồng / bồn tiểu.
    const sx = x1 - 0.4, bz = z(0.25);
    box(0.55, 0.15, 0.42, 0xfafafa, sx, 0.85, bz, P);
    box(0.12, 0.8, 0.12, 0xeeeeee, sx, 0.4, bz, P);
    const mirror = add(new THREE.PlaneGeometry(0.6, 0.8), mat(0xcfe8ff, { metalness: 0.9, roughness: 0.1 }), sx, 1.6, z(0.02), P);
    mirror.rotation.y = faceIn;
    solidBox(f, sx, bz, 0.55, 0.5);
    clickable(box(0.8, 1.6, 0.9, HIT_MAT, sx, 0.8, bz, P), {
      f, pos: () => ({ x: sx, z: z(0.85) }), range: 1.1, label: () => '💦 <b>rửa mặt</b> cho tỉnh', action: () => refresh('wash'),
    });
    if (i === 0) buildUrinals(f, P, x0, x1 - 0.75, z, span, faceWall);
    else buildCubicles(f, P, x0, x1 - 0.8, z, span, dz, faceIn);
  });
  pointLight(P, 0xe3f2fd, 4, 6, (wc.minX + wc.maxX) / 2, h - 0.4, (wc.minZ + wc.maxZ) / 2);
}

// Chỗ giải quyết trong WC: bước vào vùng `zone` là tự dùng (xem updateWC), không cần bấm.
// { kind: 'stall' | 'urinal', f, zone, x, z, yaw: chỗ đứng/ngồi, out: chỗ đứng sau khi xong }
const wcFixtures = [];
const stallDoors = []; // cửa buồng nữ: có người bên trong thì đóng lại

const woodTex = canvasTexture(64, 256, (g, w, h) => {
  g.fillStyle = '#6d4426';
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 3) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,20,5' : '150,95,50'},${0.15 + Math.random() * 0.25})`;
    g.fillRect(x, 0, 2, h);
  }
});
const WOOD_MAT = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });
const PORCELAIN = 0xfafafa, CHROME = mat(0xcfd8dc, { metalness: 0.8, roughness: 0.25 }), STALL_GREY = 0x5f6368;

// Nam: dãy bồn tiểu treo tường, ngăn nhau bằng vách gỗ.
function buildUrinals(f, P, x0, x1, z, span, faceWall) {
  const n = Math.max(1, Math.floor((x1 - x0) / 0.6)), sp = (x1 - x0) / n;
  for (let k = 0; k <= n; k++) box(0.05, 1.25, 0.42, WOOD_MAT, x0 + k * sp, 0.98, z(0.22), P); // vách gỗ
  for (let u = 0; u < n; u++) {
    const ux = x0 + (u + 0.5) * sp;
    const body = add(new THREE.CapsuleGeometry(0.16, 0.36, 6, 14), PORCELAIN, ux, 0.9, z(0.17), P);
    body.scale.z = 0.85;
    cyl(0.018, 0.018, 0.38, CHROME, ux, 1.42, z(0.04), P); // ống xả
    ball(0.035, CHROME, ux, 1.6, z(0.06), P);
    solidBox(f, ux, z(0.16), 0.34, 0.32);
    wcFixtures.push({
      kind: 'urinal', f, x: ux, z: z(0.62), yaw: faceWall,
      zone: { minX: ux - sp / 2 + 0.04, maxX: ux + sp / 2 - 0.04, ...span(0.3, 0.95) },
    });
  }
}

// Nữ: dãy buồng vách xám chân inox, cửa mở vào trong.
function buildCubicles(f, P, x0, x1, z, span, dz, faceIn) {
  const CD = 1.35, n = Math.max(1, Math.floor((x1 - x0) / 0.95)), w = (x1 - x0) / n;
  box(n * w, 0.04, 0.04, CHROME, x0 + (n * w) / 2, 2.05, z(CD), P); // thanh ray trên cửa
  for (let c = 0; c < n; c++) {
    const a = x0 + c * w, b = a + w, cx = (a + b) / 2;
    // Vách ngăn bên phải mỗi buồng (bên trái buồng đầu là tường), hở chân như ảnh mẫu.
    box(0.04, 1.85, CD, STALL_GREY, b, 1.075, z(CD / 2), P);
    solidBox(f, b, z(CD / 2), 0.06, CD);
    cyl(0.015, 0.015, 0.15, CHROME, b, 0.075, z(CD - 0.05), P);
    for (const px of [a + 0.05, b - 0.05]) box(0.1, 2.03, 0.04, STALL_GREY, px, 1.015, z(CD), P); // trụ trước
    // Bồn cầu: két nước sát tường, bệ tròn phía trước.
    box(0.38, 0.38, 0.16, PORCELAIN, cx, 0.72, z(0.08), P);
    const bowl = cyl(0.2, 0.16, 0.4, PORCELAIN, cx, 0.2, z(0.36), P);
    bowl.scale.z = 1.3;
    cyl(0.21, 0.21, 0.03, 0xeeeeee, cx, 0.415, z(0.36), P).scale.z = 1.3;
    solidBox(f, cx, z(0.3), 0.42, 0.55);
    // Cửa: bản lề ở trụ trái, đóng thì nằm ngang mặt trước, mở thì xoay vào trong.
    const dw = w - 0.2, pivot = new THREE.Group();
    pivot.position.set(a + 0.1, 0, z(CD));
    P.add(pivot);
    box(dw, 1.85, 0.03, STALL_GREY, dw / 2, 1.075, 0, pivot);
    box(0.03, 0.12, 0.05, CHROME, dw - 0.08, 1.05, 0, pivot); // tay nắm
    const zone = { minX: a + 0.06, maxX: b - 0.06, ...span(0.55, CD) };
    stallDoors.push({ pivot, f, zone, open: 1, openAng: dz * 1.5 });
    wcFixtures.push({ kind: 'stall', f, x: cx, z: z(0.62), yaw: faceIn, zone, out: { x: cx, z: z(1.05) } });
  }
}
WCS.forEach(buildWC);

// ---------- Thang tời chuyển món (xuyên 3 tầng) và ống hút khói bếp lên sân thượng ----------
const dumbwaiterLamps = [];
for (let f = 0; f < 3; f++) {
  const P = floors[f], h = f === 2 ? 1.7 : H, D = DUMBWAITER;
  box(1.1, h, 1.1, steelMat(), D.x, h / 2, D.z, P);
  box(0.8, 0.8, 0.04, 0x616161, D.x, 1.1, D.z + 0.57, P);
  const lamp = ball(0.06, new THREE.MeshBasicMaterial({ color: 0x33691e }), D.x + 0.48, 1.65, D.z + 0.58, P);
  dumbwaiterLamps.push(lamp);
  textPlane(P, 'THANG TỜI', 0.8, 0.18, D.x, h === H ? 2.2 : 1.55, D.z + 0.58, 0, { bg: '#37474f', font: 'bold 30px sans-serif' });
  solidBox(f, D.x, D.z, 1.1, 1.1);
}
function steelMat() {
  return mat(0x9e9e9e, { metalness: 0.7, roughness: 0.3 });
}
const DUCT = { x: KITCHEN.maxX - 0.5, z: B.minZ + 0.4 }; // góc bếp
box(0.5, 0.4, 0.5, 0x78909c, DUCT.x, 2.75, DUCT.z, F1);
box(0.5, H, 0.5, 0x78909c, DUCT.x, H / 2, DUCT.z, F2);
box(0.5, 2, 0.5, 0x78909c, DUCT.x, 1, DUCT.z, F3);
solidBox(1, DUCT.x, DUCT.z, 0.5, 0.5);
solidBox(2, DUCT.x, DUCT.z, 0.5, 0.5);
const turbine = new THREE.Group();
turbine.position.set(DUCT.x, 2.2, DUCT.z);
F3.add(turbine);
ball(0.4, mat(0xb0bec5, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, turbine).scale.y = 0.8;
for (let i = 0; i < 8; i++) box(0.04, 0.5, 0.25, 0x90a4ae, Math.cos((i / 8) * Math.PI * 2) * 0.38, 0, Math.sin((i / 8) * Math.PI * 2) * 0.38, turbine).rotation.y = (-i / 8) * Math.PI * 2;

// ---------- Tầng 1: đón khách, khu mở, bếp chính ----------
floorPlane(F1, BW, BD, tiles('#e8dcc4', '#cbb994', BW / 2, BD / 2), 0, BCZ);
for (const [x, z] of [[-11, -4], [0, -5], [11, -4], [-11, -9], [11, -9], [-5, -9]]) {
  box(1.2, 0.04, 0.08, new THREE.MeshBasicMaterial({ color: 0xf0f8ff }), x, H - 0.15, z, F1);
}
for (const x of [-11, 0, 11]) pointLight(F1, 0xfff1d6, 10, 13, x, 2.8, -6);

// Quầy thu ngân ngay cạnh cửa ra vào
box(3, 1.05, 0.6, 0x5d4037, 4.8, 0.52, -2.4, F1);
box(3.1, 0.05, 0.7, 0xb0bec5, 4.8, 1.07, -2.4, F1);
box(0.4, 0.25, 0.35, 0x263238, 5.6, 1.22, -2.5, F1); // máy tính tiền
textPlane(F1, 'THU NGÂN', 1.8, 0.38, 4.8, 0.7, -2.08, 0, { bg: '#b71c1c', font: 'bold 64px sans-serif' });
solidBox(0, 4.8, -2.4, 3, 0.6);
const roundCrates = new THREE.Group(); // két bia ai đó bao cả quán
roundCrates.position.set(3.7, 1.25, -2.4);
F1.add(roundCrates);
// Bảng đen thực đơn: chia 2 cột, dòng tự co theo số món.
const boardTex = canvasTexture(1024, 1024, (g, w, h) => {
  g.fillStyle = '#1f2b1f';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = 'bold 80px sans-serif';
  g.fillText('THỰC ĐƠN', w / 2, 100);
  const rows = Math.ceil(MENU.length / 2), rowH = Math.min(60, (h - 170) / rows);
  g.font = `${Math.floor(rowH * 0.62)}px sans-serif`;
  MENU.forEach((m, i) => {
    const col = Math.floor(i / rows), x = 30 + col * (w / 2), y = 170 + (i % rows) * rowH;
    g.textAlign = 'left';
    fitFont(g, m.name, g.font, w / 2 - 150);
    g.fillText(m.name, x, y);
    g.textAlign = 'right';
    g.fillText(m.price / 1000 + 'k', x + w / 2 - 50, y);
    g.font = `${Math.floor(rowH * 0.62)}px sans-serif`;
  });
});
add(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: boardTex }), 5, 1.9, KITCHEN.maxZ + 0.12, F1);

// ---------- Tranh thơ nhậu treo tường ----------
const POEMS = [
  ['Sáng ra ngắm gái tối vào hang', 'Thịt nướng bia lon đã sẵn sàng', 'Bàn ghế chông chênh toàn đồ nhậu', 'Cuộc đời ế vợ thật là sang!'],
  ['Sắc đẹp rồi sẽ tàn', 'Tiền bạc rồi sẽ tan', 'Chỉ còn rượu thịt chó', 'Vĩnh cửu với thời gian.'],
  ['Xưa kia ta ở trên trời.', 'Bởi hay uống rượu trời đày xuống đây.', 'Xuống đây ta uống cho say.', 'Xơ gan cổ chướng mới bay về trời.'],
  ['Uống rượu không phải để say?', 'Uống rượu để biết đắng cay thế nào?', 'Uống rượu không phải để sầu?', 'Uống rượu để biết trong đầu nhớ ai?'],
];
// Giấy dó ngả vàng, viền đỏ, chữ nâu nghiêng, con dấu đỏ góc dưới.
function poemTexture(lines) {
  return canvasTexture(600, 780, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f7e9c6');
    bg.addColorStop(1, '#e6cf98');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(120,80,30,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = '#8d2a1a';
    g.lineWidth = 6;
    g.strokeRect(26, 26, w - 52, h - 52);
    g.lineWidth = 2;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#a3281a';
    g.font = 'bold 30px Georgia, "Times New Roman", serif';
    g.fillText('✦  THƠ NHẬU  ✦', w / 2, 92);
    g.fillStyle = '#4e2f1d';
    const top = 190, step = (h - 330) / (lines.length - 1);
    lines.forEach((line, i) => {
      fitFont(g, line, 'italic bold 40px Georgia, "Times New Roman", serif', w - 120);
      g.fillText(line, w / 2, top + step * i);
    });
    g.fillStyle = '#7a5a3a';
    g.font = 'italic 24px Georgia, serif';
    g.fillText(`— ${SHOP_NAME} —`, w / 2 - 40, h - 82);
    // con dấu đỏ
    g.save();
    g.translate(w - 110, h - 110);
    g.rotate(-0.08);
    g.fillStyle = '#c62828';
    g.fillRect(-38, -38, 76, 76);
    g.strokeStyle = '#f7e9c6';
    g.lineWidth = 3;
    g.strokeRect(-31, -31, 62, 62);
    g.fillStyle = '#f7e9c6';
    g.font = 'bold 26px Georgia, serif';
    g.fillText('Dứt', 0, -12);
    g.fillText('Cạn', 0, 16);
    g.restore();
  });
}
// [vị trí x, z, góc quay] trên tường tầng 1: 2 bức tường trái, 1 bức tường phải, 1 trên tường kho
const POEM_SPOTS = [[B.minX + 0.12, -3.4, Math.PI / 2], [B.minX + 0.12, -7, Math.PI / 2], [B.maxX - 0.12, -3.6, -Math.PI / 2], [17, KITCHEN.maxZ + 0.12, 0]];
POEMS.forEach((lines, i) => {
  const [x, z, ry] = POEM_SPOTS[i];
  const frame = new THREE.Group();
  frame.position.set(x, 1.75, z);
  frame.rotation.y = ry;
  F1.add(frame);
  box(1.14, 1.44, 0.05, 0x4e2a12, 0, 0, 0, frame); // khung gỗ
  add(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshBasicMaterial({ map: poemTexture(lines) }), 0, 0, 0.03, frame);
  const nx = Math.sin(ry), nz = Math.cos(ry); // hướng tranh nhìn ra
  clickable(add(new THREE.BoxGeometry(1.2, 1.5, 0.3), HIT_MAT, 0, 0, 0.15, frame), {
    f: 0, pos: () => ({ x: x + nx * 1.1, z: z + nz * 1.1 }), range: 1.6,
    label: () => '📜 đọc <b>thơ nhậu</b>',
    action: () => openPoem(i),
  });
});

// ---------- Tranh slogan quán nhậu treo tường (cả 3 tầng) ----------
// 5 kiểu: biển thiếc retro, bảng phấn, poster cổ điển, bảng gỗ khắc, đèn neon.
const POSTER_STYLES = {
  tin: { bg: '#c62828', text: '#fff8e1', accent: '#ffca28', font: '"Arial Black", Impact, sans-serif', frame: 0x5d1010 },
  chalk: { bg: '#24322b', text: '#f5f5f0', accent: '#ffe066', font: '"Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive', frame: 0x111111 },
  vintage: { bg: '#f4e4c1', text: '#1b1b1b', accent: '#c62828', font: 'Impact, "Arial Black", sans-serif', frame: 0x111111 },
  wood: { bg: '#8d5a2b', text: '#ffe7c2', accent: '#ffcc80', font: 'Georgia, "Times New Roman", serif', frame: 0x3e2410 },
  neon: { bg: '#0d0d14', text: '#ff5fd8', accent: '#46f3ff', font: '"Arial Black", Impact, sans-serif', frame: 0x111111 },
};
function posterTexture({ style, icon = '', top = '', big = [], bottom = '' }) {
  const st = POSTER_STYLES[style];
  return canvasTexture(480, 630, (g, w, h) => {
    g.fillStyle = st.bg;
    g.fillRect(0, 0, w, h);
    if (style === 'wood') {
      for (let y = 0; y < h; y += 6) {
        g.fillStyle = `rgba(60,30,10,${0.05 + Math.random() * 0.12})`;
        g.fillRect(0, y, w, 2 + Math.random() * 3);
      }
    } else if (style === 'chalk') {
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(255,255,255,0.025)';
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }
    // viền
    g.strokeStyle = st.accent;
    g.lineWidth = style === 'neon' ? 6 : 10;
    if (style === 'neon') { g.shadowColor = st.accent; g.shadowBlur = 18; }
    g.strokeRect(22, 22, w - 44, h - 44);
    g.shadowBlur = 0;
    if (style === 'tin') {
      g.fillStyle = '#e0e0e0';
      for (const [rx, ry] of [[40, 40], [w - 40, 40], [40, h - 40], [w - 40, h - 40]]) { g.beginPath(); g.arc(rx, ry, 9, 0, Math.PI * 2); g.fill(); }
    }
    if (style === 'vintage') {
      g.fillStyle = st.accent;
      g.fillRect(44, 196, w - 88, 10);
      g.fillRect(44, h - 132, w - 88, 10);
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const glow = (color) => {
      if (style === 'neon') { g.shadowColor = color; g.shadowBlur = 22; }
      else if (style === 'wood') { g.shadowColor = 'rgba(30,12,0,0.8)'; g.shadowBlur = 0; g.shadowOffsetX = g.shadowOffsetY = 3; }
    };
    const clear = () => { g.shadowBlur = 0; g.shadowOffsetX = g.shadowOffsetY = 0; g.shadowColor = 'transparent'; };
    let y = 78;
    if (top) {
      g.fillStyle = st.accent;
      glow(st.accent);
      fitFont(g, top, `bold 34px ${st.font}`, w - 100);
      g.fillText(top, w / 2, y);
      clear();
      y += 46;
    }
    if (icon) {
      g.font = '84px serif';
      g.fillText(icon, w / 2, y + 44);
      y += 104;
    }
    const area = h - 120 - y - 24, n = big.length, lineH = Math.min(96, area / n);
    big.forEach((line, i) => {
      g.fillStyle = st.text;
      glow(st.text);
      fitFont(g, line, `bold ${Math.round(lineH * 0.82)}px ${st.font}`, w - 90);
      g.fillText(line, w / 2, y + 24 + lineH * (i + 0.5) + (area - lineH * n) / 2);
      clear();
    });
    if (bottom) {
      g.fillStyle = style === 'vintage' ? '#3a3a3a' : st.accent;
      glow(st.accent);
      fitFont(g, bottom, `italic bold 26px ${st.font}`, w - 100);
      g.fillText(bottom, w / 2, h - 78);
      clear();
    }
  });
}
// [tầng, x, z, góc quay, rộng, nội dung]. Góc: π/2 nhìn về +x, -π/2 về -x, 0 về +z, π về -z.
const POSTERS = [
  // Tầng 1
  [0, B.minX + 0.12, -10.4, Math.PI / 2, 0.8, { style: 'tin', icon: '🍺', top: 'BƠI HIA DỨT CẠN', big: ['KHÔNG SAY', 'KHÔNG VỀ'], bottom: 'ANH EM ĐỦ MẶT MỚI TÍNH TIỀN' }],
  [0, B.maxX - 0.12, -6.8, -Math.PI / 2, 0.8, { style: 'vintage', icon: '🍻', top: 'NGUYÊN TẮC VÀNG', big: ['1 · 2 · 3', 'DZÔ!'], bottom: '100% · không chừa giọt nào' }],
  [0, B.maxX - 0.12, -10.2, -Math.PI / 2, 0.8, { style: 'chalk', icon: '📞', top: 'Vợ gọi thì nói:', big: ['"Anh đang', 'họp!"'], bottom: 'họp tới khi hết bia' }],
  [0, 7.2, KITCHEN.maxZ + 0.12, 0, 0.8, { style: 'wood', icon: '🍶', big: ['Rượu ngon', 'không có bạn hiền', 'không mua không phải', 'không tiền không mua'], bottom: '— Nguyễn Khuyến —' }],
  [0, 11.4, KITCHEN.maxZ + 0.12, 0, 0.8, { style: 'neon', icon: '🧊', top: 'Ở ĐÂY CÓ', big: ['BIA LẠNH'], bottom: 'mở cửa tới khi khách về' }],
  [0, -10.5, B.minZ + 0.12, 0, 0.8, { style: 'tin', icon: '🚫🚗', top: 'NHỚ KỸ NHÉ', big: ['ĐÃ UỐNG', 'RƯỢU BIA'], bottom: 'THÌ KHÔNG LÁI XE' }],
  [0, -4.6, B.minZ + 0.12, 0, 0.8, { style: 'vintage', icon: '💸', top: 'CHÍNH SÁCH', big: ['MIỄN NỢ', 'NGÀY 30/2'], bottom: 'các ngày khác trả tiền mặt' }],
  // Tầng 2: hành lang phòng riêng
  [1, -13, -9.88, 0, 0.7, { style: 'chalk', icon: '🥜', top: 'Thực đơn hôm nay', big: ['Bia lạnh', 'Mồi ngon', 'Anh em đủ'], bottom: 'thế là vui rồi' }],
  [1, -9, -9.88, 0, 0.7, { style: 'wood', icon: '🍻', big: ['Tửu lượng', 'đến đâu', 'bạn bè đến đó'] }],
  [1, -7, -9.88, 0, 0.7, { style: 'neon', icon: '🎤', big: ['HÁT HAY', 'KHÔNG BẰNG', 'HÁT LÂU'], bottom: 'karaoke trên sân thượng' }],
  [1, -3.1, -9.88, 0, 0.7, { style: 'vintage', icon: '📵', top: 'WIFI', big: ['KHÔNG CÓ'], bottom: 'nói chuyện với nhau đi' }],
  [1, 7.2, -9.88, 0, 0.7, { style: 'tin', icon: '🐉', big: ['NAM VÔ TỬU', 'NHƯ KỲ', 'VÔ PHONG'], bottom: 'người xưa nói rồi' }],
  [1, 10.8, -9.88, 0, 0.7, { style: 'chalk', icon: '⏰', top: 'Giờ mở cửa', big: ['Từ lúc bạn tới', 'đến khi', 'bạn hết tiền'] }],
  [1, 16.8, -9.88, 0, 0.7, { style: 'wood', icon: '🤝', big: ['Cạn ly này', 'ta là', 'anh em'] }],
  [1, -8.5, -7.12, Math.PI, 0.7, { style: 'neon', icon: '❤️', big: ['UỐNG CÓ', 'TRÁCH NHIỆM'], bottom: 'say có người khiêng' }],
  [1, 11.5, -7.12, Math.PI, 0.7, { style: 'vintage', icon: '🍺', top: 'HÔM NAY', big: ['NHẬU', 'MAI TÍNH'], bottom: 'chuyện mai để mai lo' }],
  // Tầng 3: biển thiếc trên vách lõi thang máy
  [2, CORE.minX - 0.12, -14, -Math.PI / 2, 0.75, { style: 'tin', icon: '🌊', top: 'BIỂN ĐÊM', big: ['GIÓ BIỂN', 'BIA HƠI'], bottom: 'NGỒI TỚI SÁNG' }],
  [2, CORE.maxX + 0.12, -13, Math.PI / 2, 0.75, { style: 'neon', icon: '🌙', big: ['TRĂNG LÊN', 'LY ĐẦY'], bottom: 'sân thượng Bơi Hia' }],
];
for (const [f, x, z, ry, w, spec] of POSTERS) {
  const hgt = w * 1.3125, frame = new THREE.Group();
  frame.position.set(x, f === 0 ? 1.85 : 1.45, z);
  frame.rotation.y = ry;
  floors[f].add(frame);
  box(w + 0.06, hgt + 0.06, 0.04, POSTER_STYLES[spec.style].frame, 0, 0, 0, frame);
  add(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: posterTexture(spec) }), 0, 0, 0.025, frame);
}

// Thùng bia & thùng đá
for (let i = 0; i < 4; i++) {
  for (let j = 0; j <= i % 3; j++) box(0.35, 0.3, 0.5, i % 2 ? 0x1b5e20 : 0xf9a825, B.minX + 0.4, 0.15 + j * 0.31, -9.6 - i * 0.55, F1);
}
solidBox(0, B.minX + 0.4, -10.4, 0.4, 2.3);
box(0.55, 0.6, 0.9, 0xc62828, B.maxX - 0.5, 0.3, -8.5, F1);
box(0.57, 0.06, 0.92, 0xeeeeee, B.maxX - 0.5, 0.62, -8.5, F1);
solidBox(0, B.maxX - 0.5, -8.5, 0.55, 0.9);

// Bếp chính
const K = KITCHEN;
wallWithDoor(0, K.minX, K.maxX, K.maxZ, K.doorX[0], K.doorX[1], H, WALL_IN);
floorPlane(F1, K.maxX - K.minX, K.maxZ - K.minZ, tiles('#f5f5f5', '#bdbdbd', 10, 4), (K.minX + K.maxX) / 2, (K.minZ + K.maxZ) / 2, 0.015);
textPlane(F1, '🔥 BẾP', 1.4, 0.45, (K.doorX[0] + K.doorX[1]) / 2, 2.6, K.maxZ + 0.12, 0, { bg: '#bf360c' });
box(6, 0.9, 0.7, steelMat(), 7, 0.45, -15.5, F1); // bếp nấu
solidBox(0, 7, -15.5, 6, 0.7);
box(6, 0.4, 0.9, 0x78909c, 7, 2.3, -15.5, F1); // chụp hút khói
box(1.5, 0.4, 0.4, 0x78909c, 10.75, 2.75, DUCT.z, F1); // ống dẫn sang góc
const flames = [];
for (const x of [5, 6.6, 8.2]) {
  cyl(0.28, 0.24, 0.3, 0x424242, x, 1.05, -15.5, F1); // nồi
  flames.push(add(new THREE.ConeGeometry(0.18, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xff7043 }), x, 0.97, -15.5, F1));
}
const stoveLight = pointLight(F1, 0xff8a3d, 6, 6, 6.6, 1.6, -15);
box(1, 2, 0.8, 0xeceff1, 11.3, 1, -14.2, F1); // tủ lạnh
solidBox(0, 11.3, -14.2, 1, 0.8);
box(2.2, 0.9, 0.8, steelMat(), 6.6, 0.45, -13.2, F1); // bàn sơ chế
solidBox(0, 6.6, -13.2, 2.2, 0.8);
for (let i = 0; i < 3; i++) box(0.3, 0.06, 0.2, 0xf5deb3, 6 + i * 0.5, 0.93, -13.2, F1);
pointLight(F1, 0xffffff, 6, 8, 7, 2.8, -14);
const steam = [];
for (let i = 0; i < 9; i++) {
  const s = emojiSprite('☁️', 0.35);
  s.material.opacity = 0.5;
  s.position.set(5 + (i % 3) * 1.6, 1.3, -15.5);
  s.userData.t = Math.random();
  F1.add(s);
  steam.push(s);
}

// Kho bia cạnh lõi thang máy
for (let i = 0; i < 6; i++) box(0.5, 0.3, 0.35, i % 2 ? 0x1b5e20 : 0xf9a825, -8.8 + (i % 3) * 0.55, 0.15 + Math.floor(i / 3) * 0.31, B.minZ + 0.4, F1);
solidBox(0, -8.25, B.minZ + 0.4, 1.7, 0.4);
// Kho bia sau bếp (cạnh phải)
wall(0, K.maxX, K.minZ, K.maxX, K.maxZ, H, WALL_IN);
wallWithDoor(0, K.maxX, B.maxX, K.maxZ, 14.4, 15.6, H, WALL_IN);
textPlane(F1, 'KHO', 0.8, 0.35, 15, 2.6, K.maxZ + 0.12, 0, { bg: '#5d4037', font: 'bold 52px sans-serif' });
for (let i = 0; i < 18; i++) box(0.5, 0.3, 0.35, i % 2 ? 0x1b5e20 : 0xf9a825, 12.8 + (i % 6) * 0.8, 0.15 + Math.floor(i / 6) * 0.31, B.minZ + 0.4, F1);
solidBox(0, 15, B.minZ + 0.4, 5, 0.4);

// Góc cây xanh: bồn gạch phủ đất, trồng kín cây bụi, trúc, chuối cảnh và hoa. Không đi vào được.
function buildGreenCorner(f, P, h) {
  const x0 = CORE.minX + 0.1, x1 = ELEVATOR.x - ELEVATOR.w / 2 - 0.05, z0 = CORE.minZ + 0.1, z1 = CORE.maxZ - 0.05;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(w, 0.45, d, 0xa1887f, cx, 0.225, cz, P); // bồn gạch
  box(w - 0.16, 0.05, d - 0.16, 0x4e342e, cx, 0.47, cz, P); // đất
  solidBox(f, cx, cz, w, d);
  let seed = 17 + f * 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const greens = [0x2e7d32, 0x388e3c, 0x43a047, 0x1b5e20, 0x558b2f];
  // cây bụi phủ kín mặt bồn
  for (let i = 0; i < 14; i++) {
    const r = 0.22 + rnd() * 0.18;
    ball(r, greens[i % greens.length], x0 + 0.25 + rnd() * (w - 0.5), 0.5 + r * 0.7, z0 + 0.25 + rnd() * (d - 0.5), P);
  }
  // trúc cao sát tường
  for (let i = 0; i < 6; i++) {
    const bx = x0 + 0.18 + rnd() * 0.4, bz = z0 + 0.3 + (i / 5) * (d - 0.6), bh = Math.min(h - 0.3, 1.8 + rnd() * 0.9);
    cyl(0.035, 0.04, bh, 0x7cb342, bx, 0.47 + bh / 2, bz, P);
    for (let k = 0; k < 3; k++) {
      const leaf = add(new THREE.ConeGeometry(0.12, 0.5, 4), 0x689f38, bx, 0.47 + bh * (0.55 + k * 0.17), bz, P);
      leaf.rotation.set(rnd() * 0.6, rnd() * Math.PI * 2, 1.2 + rnd() * 0.4);
    }
  }
  // hai cây chuối cảnh lá to
  for (const [px, pz] of [[cx + 0.25, z0 + 0.8], [cx + 0.2, z1 - 0.8]]) {
    cyl(0.06, 0.08, 0.9, 0x5d7c2f, px, 0.47 + 0.45, pz, P);
    for (let k = 0; k < 5; k++) {
      const leaf = add(new THREE.BoxGeometry(0.28, 0.02, 0.8), 0x33691e, px, 1.35, pz, P);
      leaf.rotation.set(0.5, (k / 5) * Math.PI * 2, 0);
      leaf.translateZ(0.3);
    }
  }
  // hoa nhỏ điểm xuyết
  for (let i = 0; i < 10; i++) {
    ball(0.05, [0xffeb3b, 0xff7043, 0xf06292, 0xffffff][i % 4], x0 + 0.2 + rnd() * (w - 0.4), 0.78 + rnd() * 0.25, z0 + 0.2 + rnd() * (d - 0.4), P);
  }
}

// ---------- Lõi thang máy: góc cây xanh (nửa trái) + thang máy kính (nửa phải) ----------
const S = CORE, EL = ELEVATOR;
for (let f = 0; f < 3; f++) {
  const P = floors[f], h = f === 2 ? 2.6 : H, cz = (S.minZ + S.maxZ) / 2;
  wall(f, S.minX, S.minZ, S.minX, S.maxZ, h, WALL_IN);
  wall(f, S.maxX, S.minZ, S.maxX, S.maxZ, h, WALL_IN);
  buildGreenCorner(f, P, h);
}
box(4.4, 0.15, 4.4, 0x6d4c41, 0, 2.7, (S.minZ + S.maxZ) / 2, F3); // mái che lõi thang trên sân thượng

// Thang máy kính: cửa kính trượt mở về hai bên (co gọn trong khung), quay ra sảnh
const glassWallMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false });
const liftDoorMat = new THREE.MeshStandardMaterial({ color: 0x9ecbe6, transparent: true, opacity: 0.55, metalness: 0.6, roughness: 0.2 });
const LIFT_PANEL = (EL.w - 0.2) / 2;
const elevatorDoors = []; // mỗi tầng: { left, right, open (0..1), target }
for (let f = 0; f < 3; f++) {
  const P = floors[f], h = f === 2 ? 2.8 : H, x0 = EL.x - EL.w / 2, x1 = EL.x + EL.w / 2, z0 = EL.z - EL.d / 2, z1 = EL.doorZ;
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(0.1, h, 0.1, 0x9e9e9e, px, h / 2, pz, P);
  box(0.04, h, EL.d, glassWallMat, x0 + 0.03, h / 2, EL.z, P); // vách kính phía góc cây xanh
  box(EL.w, h - 2.2, 0.1, 0x9e9e9e, EL.x, 2.2 + (h - 2.2) / 2, z1, P); // dầm trên cửa
  const left = box(LIFT_PANEL, 2.2, 0.05, liftDoorMat, x0 + 0.1 + LIFT_PANEL / 2, 1.1, z1, P);
  const right = box(LIFT_PANEL, 2.2, 0.05, liftDoorMat, x1 - 0.1 - LIFT_PANEL / 2, 1.1, z1, P);
  box(EL.w - 0.1, 0.04, EL.d - 0.1, 0x616161, EL.x, 0.02, EL.z, P); // sàn cabin
  // bảng gọi thang trên vách lõi và số tầng phía trên cửa
  box(0.04, 0.3, 0.16, 0x37474f, x1 - 0.12, 1.2, z1 + 0.5, P);
  ball(0.035, new THREE.MeshBasicMaterial({ color: 0xffb300 }), x1 - 0.15, 1.25, z1 + 0.5, P);
  textPlane(P, `🛗 ${f + 1}`, 0.6, 0.25, EL.x, 2.45, z1 + 0.06, 0, { bg: '#263238', font: 'bold 64px sans-serif' });
  elevatorDoors.push({ left, right, open: 0, target: 0 });
  solidBox(f, EL.x, EL.z, EL.w, EL.d);
  clickable(box(EL.w, 2.2, 0.8, HIT_MAT, EL.x, 1.1, z1 + 0.4, P), {
    f, pos: () => ({ x: EL.x, z: EL.doorZ + 0.6 }), range: 1.4,
    label: () => '🛗 đi <b>thang máy</b>',
    action: () => openElevator(),
  });
}
box(EL.w + 0.2, 0.5, EL.d + 0.2, 0x78909c, EL.x, 3.05, EL.z, F3); // buồng máy trên nóc

// ---------- Tầng 2: phòng riêng + quầy phục vụ phụ ----------
floorPlane(F2, BW, BD, tiles('#a1887f', '#8d6e63', BW / 2, BD / 2), 0, BCZ);
const doors = new Map(); // id bàn -> tấm cửa (hiện khi phòng khoá)
const ROOM_COLORS = [0xf8bbd0, 0xc5e1a5, 0xb3e5fc, 0xffe0b2];
const builtWalls = new Set();
function roomWall(x, z1, z2, color) {
  // Vách sát lõi thang máy chỉ dựng phần ngoài lõi; vách trùng thì bỏ qua.
  if (Math.abs(Math.abs(x) - 2) < 0.01) z1 = Math.max(z1, S.maxZ);
  if (Math.abs(x) > B.maxX - 0.1 || z2 - z1 < 0.05) return;
  const key = `${x}|${z1}|${z2}`;
  if (builtWalls.has(key)) return;
  builtWalls.add(key);
  wall(1, x, z1, x, z2, 2.4, color);
}
builtWalls.add(`${WCS[1].maxX}|${WCS[1].minZ}|${WCS[1].maxZ}`); // vách WC đã dựng
for (const T of TABLES.filter((t) => t.private)) {
  const r = T.room, back = r.doorZ === r.maxZ;
  const color = ROOM_COLORS[T.id % 4];
  roomWall(r.minX, r.minZ, r.maxZ, color);
  roomWall(r.maxX, r.minZ, r.maxZ, color);
  wallWithDoor(1, r.minX, r.maxX, r.doorZ, T.x - 0.6, T.x + 0.6, 2.4, color);
  floorPlane(F2, r.maxX - r.minX, r.maxZ - r.minZ, tiles('#5d4037', '#4e342e', 5, 4), T.x, (r.minZ + r.maxZ) / 2, 0.015);
  // Sofa dọc tường trong cùng (phòng view biển thì để sofa hai bên, chừa cửa kính)
  if (back) {
    box(3, 0.45, 0.6, 0x6a1b9a, T.x - 0.6, 0.22, r.minZ + 0.45, F2);
    solidBox(1, T.x - 0.6, r.minZ + 0.45, 3, 0.6);
  } else {
    box(0.6, 0.45, 1.6, 0x6a1b9a, r.minX + 0.45, 0.22, r.maxZ - 1.2, F2);
    solidBox(1, r.minX + 0.45, r.maxZ - 1.2, 0.6, 1.6);
  }
  ball(0.12, new THREE.MeshBasicMaterial({ color: 0xffe082 }), T.x, 2.2, T.z, F2);
  textPlane(F2, T.name.replace(' (view biển)', ''), T.shape === 'long' ? 1.6 : 1, 0.3, T.x, 2.25, r.doorZ + (back ? 0.12 : -0.12), back ? 0 : Math.PI,
    { bg: '#4e342e', font: 'bold 44px sans-serif' });
  const door = box(1.2, 2.25, 0.08, 0x8e2424, T.x, 1.12, r.doorZ, F2);
  door.visible = false;
  doors.set(T.id, door);
  solidBox(1, T.x, r.doorZ, 1.2, 0.2, { door: T.id, room: r });
}
// Quầy phục vụ phụ: tủ mát bia/nước ngọt, thùng đá, tủ bát đĩa, cạnh thang tời
box(1.1, 1.9, 0.7, new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: 0x5aa9ff, emissiveIntensity: 0.4 }), 4.2, 0.95, -15.6, F2);
for (let i = 0; i < 4; i++) box(0.9, 0.02, 0.5, 0xffffff, 4.2, 0.4 + i * 0.4, -15.5, F2);
box(0.8, 0.6, 0.6, 0x1565c0, 5.4, 0.3, -15.6, F2); // thùng đá
box(0.82, 0.06, 0.62, 0xeeeeee, 5.4, 0.62, -15.6, F2);
box(0.5, 1.6, 1.2, 0x8d6e63, 5.7, 0.8, -13.6, F2); // tủ bát đĩa
box(2.4, 1, 0.5, 0x5d4037, 4, 0.5, -10.6, F2); // quầy
solidBox(1, 4.6, -15.6, 2.4, 0.7);
solidBox(1, 5.7, -13.6, 0.5, 1.2);
solidBox(1, 4, -10.6, 2.4, 0.5);
textPlane(F2, 'QUẦY PHỤC VỤ', 1.4, 0.3, 4, 2.3, -9.85, 0, { bg: '#1b5e20', font: 'bold 44px sans-serif' });
for (const x of [-12, -4, 4, 12]) pointLight(F2, 0xffd59e, 9, 10, x, 2.6, -8.5);
pointLight(F2, 0xffd59e, 6, 8, 0, 2.6, -4);

// ---------- Tầng 3: sân thượng ----------
floorPlane(F3, BW, BD, tiles('#a1574a', '#7f3f35', BW / 1.5, BD / 1.5), 0, BCZ);
for (let x = B.minX + 1; x <= B.maxX - 1; x += 0.6) {
  const c = [0xffd54f, 0xff8a65, 0xfff59d, 0x81d4fa][Math.floor((x - B.minX) / 0.6) % 4];
  for (const z of [-5.7, -10.2]) ball(0.05, new THREE.MeshBasicMaterial({ color: c }), x, 2.6 - 0.25 * Math.abs(Math.sin(((x - B.minX) / 5.6) * Math.PI)), z, F3);
}
for (const x of [B.minX + 0.5, B.maxX - 0.5]) for (const z of [-5.7, -10.2]) cyl(0.04, 0.04, 2.7, 0x555555, x, 1.35, z, F3);
for (const x of [-12, -4, 4, 12]) pointLight(F3, 0xffb060, 8, 11, x, 2.3, -6);
box(1.8, 1.6, 1.8, 0xb0bec5, 8, 0.8, -14.8, F3); // bồn nước
cyl(0.9, 0.9, 1.4, 0xeceff1, 8, 2.3, -14.8, F3);
solidBox(2, 8, -14.8, 1.8, 1.8);
for (const [x, z] of [[B.minX + 0.7, -1.7], [B.maxX - 0.7, -1.7], [-12.6, -15.3], [0, -1.7]]) {
  cyl(0.3, 0.22, 0.5, 0x8d6e63, x, 0.25, z, F3);
  ball(0.45, 0x2e7d32, x, 0.8, z, F3);
  solidCircle(2, x, z, 0.35);
}

// Sân khấu karaoke trên sân thượng
box(STAGE.w, 0.2, STAGE.d, 0x4e342e, STAGE.x, 0.1, STAGE.z, F3);
for (const dz of [-1.5, 1.5]) {
  box(0.5, 1, 0.5, 0x212121, STAGE.x + 1.6, 0.5, STAGE.z + dz, F3);
  cyl(0.15, 0.15, 0.02, 0x555555, STAGE.x + 1.34, 0.6, STAGE.z + dz, F3).rotation.z = Math.PI / 2;
}
// Chân micro mạ vàng kiểu cổ điển: đế tròn, ống dưới to, khớp nối, ống trên nhỏ, đầu mic tròn có lưới.
{
  const gold = mat(0xd4af37, { metalness: 0.85, roughness: 0.25 });
  const g = new THREE.Group();
  g.position.set(STAGE.x - 0.1, 0.2, STAGE.z);
  F3.add(g);
  cyl(0.15, 0.17, 0.03, gold, 0, 0.015, 0, g); // đế
  cyl(0.05, 0.08, 0.05, gold, 0, 0.05, 0, g);
  cyl(0.035, 0.035, 0.05, 0xdddddd, 0, 0.1, 0, g); // vòng bạc chân
  cyl(0.016, 0.016, 0.72, gold, 0, 0.48, 0, g); // ống dưới
  cyl(0.024, 0.024, 0.1, gold, 0, 0.87, 0, g); // khớp nối
  cyl(0.011, 0.011, 0.5, gold, 0, 1.15, 0, g); // ống trên
  cyl(0.016, 0.016, 0.03, 0x1565c0, 0, 1.33, 0, g); // nút xanh
  cyl(0.018, 0.022, 0.06, gold, 0, 1.42, 0, g); // kẹp mic
  // đầu mic: khung vàng hình viên thuốc, lưới đen có các khe ngang
  const head = new THREE.Group();
  head.position.set(0, 1.53, 0);
  head.rotation.z = 0.12;
  g.add(head);
  add(new THREE.CapsuleGeometry(0.045, 0.07, 6, 16), gold, 0, 0, 0, head).scale.set(1, 1, 0.75);
  add(new THREE.CapsuleGeometry(0.036, 0.06, 6, 16), 0x1a1a1a, 0, 0, 0, head).scale.set(1.06, 1, 0.95);
  for (let i = -3; i <= 3; i++) box(0.085, 0.006, 0.075, gold, 0, i * 0.018, 0, head);
}
const karaokeTex = canvasTexture(512, 128, (g, w, h) => {
  g.fillStyle = '#12001a';
  g.fillRect(0, 0, w, h);
  g.font = 'bold 84px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#e040fb';
  g.shadowBlur = 24;
  g.fillStyle = '#f8bbd0';
  g.fillText('KARAOKE', w / 2, h / 2);
});
const karaokeSign = add(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: karaokeTex }), STAGE.x + 1.78, 2.75, STAGE.z, F3);
karaokeSign.rotation.y = -Math.PI / 2;
const stageLight = pointLight(F3, 0xe040fb, 0, 7, STAGE.x, 2.4, STAGE.z);

// Màn chiếu sau lưng người hát. Có video YouTube thì mặt màn được vẽ trong suốt (NoBlending, alpha 0)
// để lộ iframe ở lớp CSS3D nằm dưới canvas, khớp đúng vị trí; vật nào đứng trước vẫn che được màn.
const SCREEN = { w: 2.4, h: 1.35, px: 960 };
box(0.06, SCREEN.h + 0.12, SCREEN.w + 0.12, 0x111111, STAGE.x + 1.76, 1.75, STAGE.z, F3);
for (const dz of [-1, 1]) cyl(0.03, 0.03, 1.2, 0x333333, STAGE.x + 1.78, 0.6, STAGE.z + dz * (SCREEN.w / 2 - 0.1), F3);
let screenText = null;
const screenTex = canvasTexture(640, 360, () => {});
function drawScreen(title, by) {
  const key = `${title}|${by}`;
  if (key === screenText) return;
  screenText = key;
  const cv = screenTex.image, g = cv.getContext('2d'), w = cv.width, h = cv.height;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a0033');
  grad.addColorStop(1, '#05202e');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#e040fb';
  g.shadowBlur = 20;
  g.fillStyle = '#f8bbd0';
  g.font = 'bold 44px sans-serif';
  g.fillText(title ? '🎤 ĐANG HÁT' : '🎤 KARAOKE', w / 2, h * 0.32);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.font = 'bold 34px sans-serif';
  g.fillText(title || 'Lên sân khấu để hát', w / 2, h * 0.58, w - 40);
  g.fillStyle = '#b3e5fc';
  g.font = '26px sans-serif';
  g.fillText(title ? by || '' : 'chọn bài · tìm trên YouTube', w / 2, h * 0.76, w - 40);
  screenTex.needsUpdate = true;
}
drawScreen('', '');
const screenIdleMat = new THREE.MeshBasicMaterial({ map: screenTex });
const screenHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, fog: false });
const stageScreen = add(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenIdleMat, STAGE.x + 1.72, 1.75, STAGE.z, F3);
stageScreen.rotation.y = -Math.PI / 2;

const cssScene = new THREE.Scene();
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(innerWidth, innerHeight);
cssRenderer.domElement.className = 'screen3d';
canvas.before(cssRenderer.domElement);
const screenVideoEl = document.createElement('div');
screenVideoEl.className = 'screen-video';
const tvPlayerEl = document.createElement('div');
screenVideoEl.appendChild(tvPlayerEl);
const screenCss = new CSS3DObject(screenVideoEl);
screenCss.matrixAutoUpdate = false;
cssScene.add(screenCss);
const screenScale = new THREE.Matrix4().makeScale(SCREEN.w / SCREEN.px, SCREEN.w / SCREEN.px, 1);
cssRenderer.render(cssScene, camera); // gắn iframe vào trang ngay để YouTube khởi tạo được

// Gọi mỗi khung hình: bật lỗ màn chiếu khi có video và tầng sân khấu đang hiện.
function updateScreen() {
  const on = !!(tv.yt && tv.player && !tv.local && !tv.failed && floors[STAGE.floor].visible);
  stageScreen.material = on ? screenHoleMat : screenIdleMat;
  cssRenderer.domElement.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  screenCss.matrix.multiplyMatrices(stageScreen.matrixWorld, screenScale);
  screenCss.matrixWorldNeedsUpdate = true;
  cssRenderer.render(cssScene, camera);
}
solidBox(2, STAGE.x + 1.6, STAGE.z, 0.5, 3.6);
const stageClick = clickable(box(STAGE.w, 1.8, STAGE.d, HIT_MAT, STAGE.x, 0.9, STAGE.z, F3), {
  f: STAGE.floor,
  pos: () => ({ x: STAGE.x - 0.8, z: STAGE.z }),
  range: 2,
  label: () => (mic.singer === myId ? 'đang hát…' : inMicQueue() ? 'đang xếp hàng hát' : '🎤 lên <b>hát karaoke</b>'),
  action: () => singDefault(),
});

// ---------- Ánh sáng & hiệu ứng sân khấu (chỉ chạy khi có người hát) ----------
// Giàn khung trên sân khấu treo đèn Moving Head, Par LED, Spotlight, đèn quay 7 màu, laser, đèn chớp;
// màn LED hai bên và băng LED trên giàn; máy khói, máy bắn pháo điện, máy bong bóng.
// Nhạc YouTube không đọc được sóng âm, nên "cảm ứng theo nhạc" dùng nhịp giả 118 BPM.
const FX = { on: 0, lastStart: 0, burstUntil: 0, nextBurst: 0, ledT: 0 };
const TRUSS = { front: STAGE.x - 1.55, back: STAGE.x + 1.45, z0: STAGE.z - 2.6, z1: STAGE.z + 2.6, y: 3.35 };
const trussMat = mat(0x9e9e9e, { metalness: 0.7, roughness: 0.35 });
for (const x of [TRUSS.front, TRUSS.back]) for (const z of [TRUSS.z0, TRUSS.z1]) add(new THREE.BoxGeometry(0.12, TRUSS.y, 0.12), trussMat, x, TRUSS.y / 2, z, F3);
for (const x of [TRUSS.front, TRUSS.back]) add(new THREE.BoxGeometry(0.14, 0.14, TRUSS.z1 - TRUSS.z0 + 0.14), trussMat, x, TRUSS.y, STAGE.z, F3);
for (const z of [TRUSS.z0, TRUSS.z1]) add(new THREE.BoxGeometry(TRUSS.back - TRUSS.front, 0.14, 0.14), trussMat, STAGE.x - 0.05, TRUSS.y, z, F3);
solidCircle(2, TRUSS.front, TRUSS.z0, 0.2);
solidCircle(2, TRUSS.front, TRUSS.z1, 0.2);

const additive = (color, opacity, extra) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, ...extra,
});
// Chùm sáng: sáng ở đầu đèn, mờ dần về cuối (ánh sáng xuyên khói)
const beamTex = canvasTexture(4, 64, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(1, '#000');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
function beamGeo(r0, r1, len) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, 18, 1, true);
  geo.translate(0, -len / 2, 0); // gốc chùm ở đầu đèn, chiếu theo trục -y
  return geo;
}
const DOWN = new THREE.Vector3(0, -1, 0), fxDir = new THREE.Vector3(), fxPos = new THREE.Vector3();
function aimBeam(beam, from, to) {
  fxDir.subVectors(to, from).normalize();
  beam.quaternion.setFromUnitVectors(DOWN, fxDir);
}

// Đèn Moving Head: 4 đèn treo dưới thanh trước, quay đầu quét xuống khán giả và lên trời
const movers = [-1.8, -0.6, 0.6, 1.8].map((dz, i) => {
  const z = STAGE.z + dz, y = TRUSS.y - 0.25;
  box(0.22, 0.12, 0.22, 0x222222, TRUSS.front, TRUSS.y - 0.1, z, F3);
  const head = ball(0.12, 0x111111, TRUSS.front, y, z, F3);
  const beam = add(beamGeo(0.04, 0.75, 7), additive(0xffffff, 0.28, { map: beamTex }), TRUSS.front, y, z, F3);
  return { head, beam, from: new THREE.Vector3(TRUSS.front, y, z), i };
});
// Spotlight trắng rọi người hát
const spot = new THREE.SpotLight(0xfff4e0, 0, 9, 0.32, 0.5, 1.2);
spot.position.set(TRUSS.front, TRUSS.y - 0.2, STAGE.z);
spot.target.position.set(STAGE.singerX, 0.6, STAGE.singerZ);
F3.add(spot, spot.target);
cyl(0.1, 0.13, 0.3, 0x333333, TRUSS.front, TRUSS.y - 0.2, STAGE.z, F3).rotation.z = Math.PI / 2.6;
const spotBeam = add(beamGeo(0.06, 0.55, 3.4), additive(0xfff4e0, 0.12, { map: beamTex }), TRUSS.front, TRUSS.y - 0.2, STAGE.z, F3);
aimBeam(spotBeam, spot.position, spot.target.position);
// Par LED: 6 đèn trên thanh sau và hai bên, đổi màu theo nhịp
const pars = [];
for (const [x, z] of [[TRUSS.back, STAGE.z - 1.6], [TRUSS.back, STAGE.z], [TRUSS.back, STAGE.z + 1.6], [STAGE.x - 0.6, TRUSS.z0], [STAGE.x - 0.6, TRUSS.z1], [STAGE.x + 0.6, TRUSS.z0]]) {
  cyl(0.09, 0.09, 0.16, 0x1a1a1a, x, TRUSS.y - 0.15, z, F3);
  const lens = add(new THREE.CircleGeometry(0.08, 16), new THREE.MeshBasicMaterial({ color: 0x222222 }), x, TRUSS.y - 0.235, z, F3);
  lens.rotation.x = Math.PI / 2;
  pars.push(lens);
}
// Đèn quay 7 màu (quả cầu gương) treo giữa giàn, toả 7 chùm màu quay vòng
const disco = new THREE.Group();
disco.position.set(STAGE.x - 0.3, TRUSS.y - 0.45, STAGE.z);
F3.add(disco);
add(new THREE.IcosahedronGeometry(0.2, 1), mat(0xdddddd, { metalness: 1, roughness: 0.15, flatShading: true }), 0, 0, 0, disco);
cyl(0.008, 0.008, 0.3, 0x666666, STAGE.x - 0.3, TRUSS.y - 0.15, STAGE.z, F3);
const RAINBOW = [0xff1744, 0xff9100, 0xffea00, 0x00e676, 0x00b0ff, 0x2979ff, 0xd500f9];
const discoBeams = RAINBOW.map((c, i) => {
  const b = add(beamGeo(0.02, 0.32, 4.2), additive(c, 0.32, { map: beamTex }), 0, 0, 0, disco);
  b.rotation.order = 'YXZ';
  b.rotation.y = (i / 7) * Math.PI * 2;
  b.rotation.x = 0.75; // nghiêng xuống ~45°
  return b;
});
// Laser quét: hộp laser trên thanh sau, 8 tia mảnh quét ngang qua khán giả
const laserBox = box(0.3, 0.14, 0.3, 0x111111, TRUSS.back, TRUSS.y + 0.14, STAGE.z, F3);
const laserFrom = new THREE.Vector3(TRUSS.back - 0.15, TRUSS.y + 0.14, STAGE.z);
const lasers = Array.from({ length: 8 }, () => add(beamGeo(0.012, 0.012, 16), additive(0x00ff66, 0.85), laserFrom.x, laserFrom.y, laserFrom.z, F3));
// Đèn chớp (strobe): chớp nhẹ 2 lần/giây lúc bắn pháo điện, không chớp nhanh hơn để khỏi chói mắt
const strobe = pointLight(F3, 0xffffff, 0, 10, STAGE.x - 0.5, TRUSS.y - 0.3, STAGE.z);
box(0.3, 0.1, 0.12, 0xeeeeee, TRUSS.front, TRUSS.y + 0.12, STAGE.z + 1.2, F3);

// Màn LED: hai tấm hai bên màn chiếu và băng LED trên giàn trước, vẽ hiệu ứng động
// pixel: true thì giữ ô vuông to (kiểu bảng LED hạt), false thì vẽ nét mịn (băng chữ chạy).
function ledPanel(w, h, cw, ch, x, y, z, rotY, pixel = true) {
  const tex = canvasTexture(cw, ch, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); });
  if (pixel) tex.magFilter = THREE.NearestFilter;
  else tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // nhìn xiên vẫn nét
  const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }), x, y, z, F3);
  m.rotation.y = rotY;
  return { tex, g: tex.image.getContext('2d'), w: cw, h: ch };
}
const ledSides = [-1, 1].map((s) => {
  box(0.05, 1.7, 0.86, 0x111111, STAGE.x + 1.74, 1.75, STAGE.z + s * 1.75, F3);
  return ledPanel(0.8, 1.6, 24, 48, STAGE.x + 1.7, 1.75, STAGE.z + s * 1.75, -Math.PI / 2);
});
box(0.06, 0.36, TRUSS.z1 - TRUSS.z0 - 0.3, 0x111111, TRUSS.front - 0.04, TRUSS.y + 0.3, STAGE.z, F3);
// Băng chữ chạy: vẽ ở độ phân giải cao (1280×96) cho chữ nét, không bị vỡ hạt.
const ledTop = ledPanel(TRUSS.z1 - TRUSS.z0 - 0.4, 0.3, 1280, 96, TRUSS.front - 0.08, TRUSS.y + 0.3, STAGE.z, -Math.PI / 2, false);
const LED_TEXT = '★ BƠI HIA DỨT CẠN ★ KARAOKE ★ DZÔ ★ ';
function drawLeds(t, level) {
  const hue = (t * 40) % 360;
  for (const [k, p] of ledSides.entries()) {
    const { g, w, h } = p;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 3) {
      // cột sóng nhạc nhảy theo nhịp, hai tấm lệch nhau
      const v = level * (0.35 + 0.65 * Math.abs(Math.sin(t * 3.1 + x * 0.45 + k * 1.7) * Math.sin(t * 1.7 + x * 0.2)));
      const bar = Math.round(v * h);
      for (let y = 0; y < bar; y += 3) {
        g.fillStyle = `hsl(${(hue + y * 4 + k * 120) % 360} 100% ${45 + (y / h) * 20}%)`;
        g.fillRect(x, h - y - 2, 2, 2);
      }
    }
    p.tex.needsUpdate = true;
  }
  const { g, w, h } = ledTop;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.font = 'bold 70px sans-serif';
  g.textBaseline = 'middle';
  const color = level ? `hsl(${hue} 100% 62%)` : '#ff4081';
  g.fillStyle = color;
  g.shadowColor = color; // quầng sáng nhẹ như đèn LED
  g.shadowBlur = 14;
  const tw = g.measureText(LED_TEXT).width, off = -((t * 240) % tw);
  for (let x = off; x < w; x += tw) g.fillText(LED_TEXT, x, h / 2 + 4);
  g.shadowBlur = 0;
  ledTop.tex.needsUpdate = true;
}
drawLeds(0, 0);

// Hạt: ảnh tròn mờ dùng chung cho khói, tia pháo, bong bóng
const dotTex = canvasTexture(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.4, 'rgba(255,255,255,.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
});
const bubbleTex = canvasTexture(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.05)');
  gr.addColorStop(0.85, 'rgba(200,240,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath();
  g.arc(w * 0.36, w * 0.34, w * 0.07, 0, Math.PI * 2);
  g.fill();
});
function particles(n, tex, size, blending, color = 0xffffff) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(-999), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, color, transparent: true, depthWrite: false, blending, fog: false }));
  pts.frustumCulled = false;
  F3.add(pts);
  return { pts, pos: geo.attributes.position, vel: new Float32Array(n * 3), life: new Float32Array(n), n };
}
// Máy khói: các mảng khói to, bò sát sàn sân khấu rồi lan ra phía khán giả
const SMOKE_N = 26;
const fxSmoke = Array.from({ length: SMOKE_N }, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xd8d0ff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  s.userData = { life: 0, max: 1, vx: 0, vz: 0 };
  F3.add(s);
  return s;
});
box(0.45, 0.22, 0.3, 0x263238, STAGE.x + 1.2, 0.31, STAGE.z - 2.2, F3); // máy khói đặt góc sân khấu
// Máy bắn pháo điện: hai bệ ở mép trước sân khấu
const SPARK_N = 160;
const fxSparks = particles(SPARK_N, dotTex, 0.09, THREE.AdditiveBlending, 0xffc46b);
const sparkGuns = [TRUSS.z0 + 0.3, TRUSS.z1 - 0.3].map((z) => {
  box(0.3, 0.16, 0.3, 0x212121, STAGE.x - 1.35, 0.28, z, F3);
  return new THREE.Vector3(STAGE.x - 1.35, 0.38, z);
});
// Máy bong bóng trên góc giàn, thổi bong bóng bay về phía khán giả
const BUBBLE_N = 40;
const fxBubbles = particles(BUBBLE_N, bubbleTex, 0.16, THREE.NormalBlending);
const fxBubbleGun = new THREE.Vector3(TRUSS.front, TRUSS.y - 0.25, TRUSS.z1 - 0.2);
box(0.3, 0.2, 0.3, 0x0277bd, fxBubbleGun.x, fxBubbleGun.y + 0.05, fxBubbleGun.z, F3);

const fxColor = new THREE.Color(), fxTo = new THREE.Vector3();
let sparkI = 0, fxBubbleI = 0;
function updateStageFx(dt, t) {
  const live = !!mic.singer;
  FX.on += ((live ? 1 : 0) - FX.on) * Math.min(1, dt * 2); // bật/tắt dần
  const on = FX.on, visible = floors[STAGE.floor].visible;
  const beat = Math.exp(-((t * 118 / 60) % 1) * 5); // nhịp giả, 1 ngay đầu phách rồi tắt dần
  const hue = (t * 0.08) % 1;
  // Bài mới bắt đầu: bắn pháo điện 5 giây, sau đó cứ ~25 giây bắn một đợt
  if (live && mic.startAt !== FX.lastStart) {
    FX.lastStart = mic.startAt;
    FX.burstUntil = t + 5;
    FX.nextBurst = t + 25;
  } else if (live && t > FX.nextBurst) {
    FX.burstUntil = t + 3;
    FX.nextBurst = t + 22 + Math.random() * 8;
  }
  const bursting = live && t < FX.burstUntil;

  stageLight.intensity = on * (5 + beat * 6);
  stageLight.color.setHSL(hue, 1, 0.55);
  spot.intensity = on * 30;
  spotBeam.visible = on > 0.05;
  spotBeam.material.opacity = 0.12 * on;
  strobe.intensity = bursting && (t * 2) % 1 < 0.06 ? 25 : 0;
  if (!visible || on < 0.01) {
    for (const m of movers) m.beam.visible = false;
    for (const l of lasers) l.visible = false;
    disco.visible = true;
    discoBeams.forEach((b) => (b.visible = false));
    if (FX.ledT > 0) { drawLeds(t, 0); FX.ledT = 0; }
    fxSparks.pts.visible = fxBubbles.pts.visible = false;
    fxSmoke.forEach((s) => (s.visible = false));
    return;
  }
  // Moving Head: mỗi đèn vẽ hình số 8 riêng, đổi màu lệch pha
  for (const m of movers) {
    const k = m.i;
    fxTo.set(STAGE.x - 4 - 2.5 * Math.sin(t * 0.6 + k), 3 + 3.2 * Math.sin(t * 0.8 + k * 1.3), STAGE.z + 5 * Math.sin(t * 0.45 + k * 0.9));
    aimBeam(m.beam, m.from, fxTo);
    m.beam.visible = true;
    m.beam.material.color.setHSL((hue + k * 0.25) % 1, 1, 0.5);
    m.beam.material.opacity = (0.16 + beat * 0.14) * on;
  }
  for (const [k, p] of pars.entries()) p.material.color.setHSL((hue + k / 6 + beat * 0.1) % 1, 1, 0.3 + beat * 0.35);
  // Đèn quay 7 màu: quay nhanh hơn và sáng lên theo nhịp
  disco.rotation.y += dt * (0.8 + beat * 2);
  discoBeams.forEach((b) => {
    b.visible = true;
    b.material.opacity = (0.15 + beat * 0.3) * on;
  });
  // Laser: quạt tia quét qua lại, đổi màu đỏ / xanh lá / xanh dương
  const lc = [0xff1744, 0x00ff66, 0x2979ff][Math.floor(t / 4) % 3];
  lasers.forEach((l, i) => {
    const a = (i / (lasers.length - 1) - 0.5) * 1.2 + Math.sin(t * 1.1) * 0.5;
    const el = -0.08 + Math.sin(t * 0.7 + i * 0.4) * 0.12;
    fxTo.set(laserFrom.x - Math.cos(a) * 10, laserFrom.y + el * 10, laserFrom.z + Math.sin(a) * 10);
    aimBeam(l, laserFrom, fxTo);
    l.visible = true;
    l.material.color.setHex(lc);
    l.material.opacity = 0.75 * on;
  });
  // Màn LED: vẽ lại ~12 lần/giây là đủ mượt
  FX.ledT += dt;
  if (FX.ledT > 0.08) { drawLeds(t, on * (0.4 + beat * 0.6)); FX.ledT = 0.0001; }

  // Khói
  const smokeN = settings.quality === 'high' ? SMOKE_N : 12;
  fxSmoke.forEach((s, i) => {
    const u = s.userData;
    s.visible = i < smokeN;
    if (!s.visible) return;
    u.life += dt;
    if (u.life > u.max) {
      if (!live) { s.material.opacity = 0; return; }
      u.life = 0;
      u.max = 5 + Math.random() * 4;
      u.vx = -(0.25 + Math.random() * 0.35);
      u.vz = (Math.random() - 0.5) * 0.4;
      s.position.set(STAGE.x + 1.1 - Math.random() * 0.8, 0.35, STAGE.z - 2 + Math.random() * 4);
    }
    const k = u.life / u.max;
    s.position.x += u.vx * dt;
    s.position.z += u.vz * dt;
    s.position.y += dt * 0.08;
    s.scale.setScalar(0.8 + k * 2.4);
    s.material.opacity = Math.sin(Math.PI * k) * 0.2 * on;
    s.material.color.copy(fxColor.setHSL(hue, 0.4, 0.8));
  });

  // Pháo điện: phun tia vàng lên cao rồi rơi xuống
  fxSparks.pts.visible = true;
  const sp = fxSparks.pos.array;
  if (bursting) {
    const spawn = Math.min(SPARK_N, Math.round(dt * (settings.quality === 'high' ? 220 : 110)));
    for (let s = 0; s < spawn; s++) {
      const gun = sparkGuns[s % 2], i = sparkI = (sparkI + 1) % SPARK_N;
      sp[i * 3] = gun.x; sp[i * 3 + 1] = gun.y; sp[i * 3 + 2] = gun.z;
      fxSparks.vel[i * 3] = (Math.random() - 0.5) * 0.7;
      fxSparks.vel[i * 3 + 1] = 4.2 + Math.random() * 1.6;
      fxSparks.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
      fxSparks.life[i] = 0.9 + Math.random() * 0.4;
    }
  }
  for (let i = 0; i < SPARK_N; i++) {
    if (fxSparks.life[i] <= 0) { sp[i * 3 + 1] = -999; continue; }
    fxSparks.life[i] -= dt;
    fxSparks.vel[i * 3 + 1] -= 7 * dt;
    sp[i * 3] += fxSparks.vel[i * 3] * dt;
    sp[i * 3 + 1] += fxSparks.vel[i * 3 + 1] * dt;
    sp[i * 3 + 2] += fxSparks.vel[i * 3 + 2] * dt;
  }
  fxSparks.pos.needsUpdate = true;

  // Bong bóng: thổi ra đều, bay chậm về phía khán giả, lắc lư rồi vỡ
  fxBubbles.pts.visible = true;
  const bp = fxBubbles.pos.array;
  if (live && Math.random() < dt * 6) {
    const i = fxBubbleI = (fxBubbleI + 1) % BUBBLE_N;
    bp[i * 3] = fxBubbleGun.x; bp[i * 3 + 1] = fxBubbleGun.y; bp[i * 3 + 2] = fxBubbleGun.z;
    fxBubbles.vel[i * 3] = -(0.5 + Math.random() * 0.6);
    fxBubbles.vel[i * 3 + 1] = -0.05 + Math.random() * 0.15;
    fxBubbles.vel[i * 3 + 2] = -(0.2 + Math.random() * 0.6);
    fxBubbles.life[i] = 4 + Math.random() * 3;
  }
  for (let i = 0; i < BUBBLE_N; i++) {
    if (fxBubbles.life[i] <= 0) { bp[i * 3 + 1] = -999; continue; }
    fxBubbles.life[i] -= dt;
    bp[i * 3] += fxBubbles.vel[i * 3] * dt;
    bp[i * 3 + 1] = Math.max(0.3, bp[i * 3 + 1] + fxBubbles.vel[i * 3 + 1] * dt + Math.sin(t * 3 + i) * 0.004);
    bp[i * 3 + 2] += (fxBubbles.vel[i * 3 + 2] + Math.sin(t * 2 + i * 1.7) * 0.25) * dt;
  }
  fxBubbles.pos.needsUpdate = true;
}

// ---------- Bàn & ghế ----------
const glassMat = mat(0x1d6b35, { roughness: 0.15, metalness: 0.1 });
// Bàn ghế nhựa kiểu Song Long, hai màu vàng / đỏ xen kẽ theo bàn.
const PLASTIC = [0xf9c80e, 0xd7262e];
const plasticMats = PLASTIC.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, metalness: 0 }));
const partBox = (w, h, d, x, y, z, rx = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  return g.translate(x, y, z);
};
// Bàn nhựa liền khối (kiểu Duy Tân): khung 1 x 1 co giãn theo kích thước từng bàn, mặt cao 0.57
// có hoa văn chữ thập nổi; bốn mặt yếm liền xuống thành chân bản to, khoét vòm giữa hai chân, chân hơi choãi.
const tableGeo = (() => {
  const parts = [partBox(1, 0.05, 1, 0, 0.545, 0)];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
    const x = -0.39 + i * 0.13, z = -0.36 + j * 0.18 + (i % 2) * 0.09;
    if (Math.abs(z) > 0.42) continue;
    parts.push(partBox(0.07, 0.008, 0.012, x, 0.573, z), partBox(0.012, 0.008, 0.07, x, 0.573, z));
  }
  const side = new THREE.Shape();
  side.moveTo(-0.5, 0.55);
  side.lineTo(0.5, 0.55);
  side.lineTo(0.5, 0);
  side.lineTo(0.37, 0);
  side.lineTo(0.35, 0.3);
  side.quadraticCurveTo(0.33, 0.43, 0.2, 0.43);
  side.lineTo(-0.2, 0.43);
  side.quadraticCurveTo(-0.33, 0.43, -0.35, 0.3);
  side.lineTo(-0.37, 0);
  side.lineTo(-0.5, 0);
  side.lineTo(-0.5, 0.55);
  const panel = new THREE.ExtrudeGeometry(side, { depth: 0.04, bevelEnabled: false, curveSegments: 8 });
  panel.translate(0, 0, -0.02);
  for (const [ry, dist] of [[0, 0.48], [Math.PI, 0.48], [Math.PI / 2, 0.48], [-Math.PI / 2, 0.48]]) {
    const g = panel.clone();
    g.translate(0, -0.55, 0).rotateX(-0.07).translate(0, 0.55, dist); // choãi ra ngoài
    g.rotateY(ry);
    parts.push(g);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
})();
// Ghế nhựa liền khối (kiểu ghế Song Long): nhìn về +z (phía bàn), mặt ngồi cao 0.34 có viền,
// 4 chân vuông to thuôn dần và hơi choãi, tựa lưng cao bo tròn đầu với 2 lỗ ô van lớn và 2 khe dọc ở giữa.
const chairGeo = (() => {
  const parts = [partBox(0.44, 0.04, 0.42, 0, 0.32, 0)];
  for (const z of [-0.2, 0.2]) parts.push(partBox(0.44, 0.06, 0.02, 0, 0.28, z));
  for (const x of [-0.21, 0.21]) parts.push(partBox(0.02, 0.06, 0.42, x, 0.28, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.05, 0.036, 0.32, 4, 1);
    leg.rotateY(Math.PI / 4);
    leg.rotateX(sz * 0.1);
    leg.rotateZ(-sx * 0.1);
    parts.push(leg.translate(sx * 0.18, 0.15, sz * 0.17));
  }
  const back = new THREE.Shape();
  back.moveTo(-0.2, 0);
  back.lineTo(0.2, 0);
  back.lineTo(0.215, 0.36);
  back.quadraticCurveTo(0.22, 0.5, 0.08, 0.5);
  back.lineTo(-0.08, 0.5);
  back.quadraticCurveTo(-0.22, 0.5, -0.215, 0.36);
  back.lineTo(-0.2, 0);
  for (const [x, rx, ry] of [[-0.12, 0.06, 0.15], [0.12, 0.06, 0.15], [-0.032, 0.012, 0.13], [0.032, 0.012, 0.13]]) {
    const hole = new THREE.Path();
    hole.absellipse(x, 0.25, rx, ry, 0, Math.PI * 2, true);
    back.holes.push(hole);
  }
  const bg = new THREE.ExtrudeGeometry(back, { depth: 0.025, bevelEnabled: false, curveSegments: 12 });
  bg.rotateX(-0.2);
  parts.push(bg.translate(0, 0.33, -0.23));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
})();
// Gom ma trận theo tầng + màu, dựng xong mới tạo InstancedMesh (mỗi tầng mỗi màu một lần vẽ)
const plasticBatch = new Map();
const tmpMatrix = new THREE.Matrix4(), tmpQuat = new THREE.Quaternion(), tmpScale = new THREE.Vector3(), tmpPos = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function placePlastic(kind, floor, color, x, z, yaw, sx = 1, sz = 1) {
  const key = `${kind}|${floor}|${color}`;
  if (!plasticBatch.has(key)) plasticBatch.set(key, { kind, floor, color, list: [] });
  tmpQuat.setFromAxisAngle(UP, yaw);
  plasticBatch.get(key).list.push(tmpMatrix.compose(tmpPos.set(x, 0, z), tmpQuat, tmpScale.set(sx, 1, sz)).clone());
}
// Bàn tròn cũ đổi thành bàn chữ nhật: ghế vẫn xếp quanh, mặt bàn đủ rộng để ly và mồi.
const tableSize = (T) => ({ w: T.r * 1.9, d: T.r * 1.5 });
// Điểm ngẫu nhiên trên mặt bàn (để đặt chai, đĩa mồi)
function spotOnTable(T) {
  if (T.shape === 'long') return { x: T.x + (Math.random() - 0.5) * (T.len - 0.3), z: T.z + (Math.random() - 0.5) * (T.w - 0.3) };
  const { w, d } = tableSize(T);
  return { x: T.x + (Math.random() - 0.5) * (w - 0.3), z: T.z + (Math.random() - 0.5) * (d - 0.3) };
}
for (const T of TABLES) {
  const P = floors[T.floor];
  const color = T.id % 2;
  if (T.shape === 'long') {
    // Ghép nhiều bàn nhựa thành bàn dài cho nhóm 10–12 người
    const piece = T.len / T.pieces;
    for (let k = 0; k < T.pieces; k++) placePlastic('table', T.floor, color, T.x - T.len / 2 + piece * (k + 0.5), T.z, 0, piece - 0.03, T.w);
    solidBox(T.floor, T.x, T.z, T.len + 0.3, T.w + 1.3);
  } else {
    const { w, d } = tableSize(T);
    placePlastic('table', T.floor, color, T.x, T.z, 0, w, d);
    solidCircle(T.floor, T.x, T.z, T.r + 0.65);
  }
  for (let i = 0; i < T.seats; i++) {
    const s = seatPos(T, i);
    placePlastic('chair', T.floor, color, s.x, s.z, seatYaw(T, i));
  }
  for (let i = 0; i < 2 + (T.pieces || 1); i++) {
    const s = spotOnTable(T);
    cyl(0.035, 0.035, 0.18, glassMat, s.x, 0.66, s.z, P);
    cyl(0.013, 0.033, 0.08, glassMat, s.x, 0.79, s.z, P);
  }
  T.dishes = new THREE.Group();
  P.add(T.dishes);
  const hit = T.shape === 'long'
    ? box(T.len + 0.6, 1.2, T.w + 1.6, HIT_MAT, T.x, 0.6, T.z, P)
    : cyl(T.r + 0.65, T.r + 0.65, 1.2, HIT_MAT, T.x, 0.6, T.z, P);
  // Phòng đang khoá (không phải chủ): không đi xuyên cửa được, nên đi tới trước cửa rồi gõ cửa / xin vào.
  const lockedOut = () => T.room && roomState.get(T.id)?.locked && roomState.get(T.id).owner !== myId;
  const doorSpot = T.room && { x: T.x, z: T.room.doorZ + (T.z > T.room.doorZ ? -0.8 : 0.8) };
  const tableRange = T.shape === 'long' ? T.len / 2 + 1.6 : T.r + 1.6;
  const tableClick = {
    tableId: T.id,
    f: T.floor,
    pos: () => (lockedOut() ? doorSpot : T),
    get range() { return lockedOut() ? 1.4 : tableRange; },
    label: () => {
      const used = seatedAt(T.id) + (T.npcSeats?.length || 0);
      const st = roomState.get(T.id);
      if (st?.locked && st.owner !== myId) return `🚪 gõ cửa <b>${T.name}</b> (đang khoá)`;
      return used >= T.seats ? `${T.name} đã đủ người` : `ngồi vào <b>${T.name}</b> (${used}/${T.seats})`;
    },
    action: () => {
      // Có chọn ghế (bấm gần ghế nào) thì xin ngồi ghế đó; ghế có người rồi thì server xếp ghế trống gần nhất.
      const idx = chosenSeat?.table === T.id ? chosenSeat.idx : undefined;
      chosenSeat = null;
      // Phòng khoá: thử vào (người từng ngồi phòng này được vào luôn); server đòi mật mã thì gõ cửa và hỏi mã.
      if (roomState.get(T.id)?.locked && roomState.get(T.id).owner !== myId) {
        codeFor = { mode: 'try', table: T.id, idx };
        return send({ t: 'sit', table: T.id, idx });
      }
      if (idx !== undefined && !seatFree(T.id, idx)) toast('Ghế đó có người rồi, ngồi ghế trống gần nhất nhé');
      send({ t: 'sit', table: T.id, idx });
    },
  };
  clickable(hit, tableClick);
  // Bấm vào cánh cửa phòng cũng như bấm vào bàn trong phòng (đang khoá thì gõ cửa).
  if (doors.has(T.id)) clickable(doors.get(T.id), tableClick);
}
for (const { kind, floor, color, list } of plasticBatch.values()) {
  const im = new THREE.InstancedMesh(kind === 'table' ? tableGeo : chairGeo, plasticMats[color], list.length);
  list.forEach((m, i) => im.setMatrixAt(i, m));
  im.computeBoundingSphere();
  floors[floor].add(im);
}

// ================= Nhân vật =================
// Nhân vật kiểu chibi: đầu to tròn, mắt nhắm cười "^ ^", má hồng, thân tròn ngắn, tay chân mũm mĩm.
const PERSON_HIP = 0.5; // độ cao hông khi đứng
const SEAT_DROP = -0.12; // hạ thân khi ngồi ghế nhựa
const SKIN_DEFAULT = 0xf0b27a;
function makePerson(o = {}) {
  const { shirt = 0x2e86de, pants = 0x2d3436, skin = SKIN_DEFAULT, hair = 0x1b1b1b, bald = false, female = false, belly = 1, hat = false, chefHat = false, skirt = 0, bow = 0 } = o;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const HIP = PERSON_HIP, soft = (c) => mat(c, { roughness: 0.7 });
  const legs = [], knees = [];
  for (const sx of [-0.09, 0.09]) {
    const hip = new THREE.Group();
    hip.position.set(sx, HIP, 0);
    body.add(hip);
    add(new THREE.CapsuleGeometry(0.085, 0.12, 4, 10), pants, 0, -0.12, 0, hip);
    const knee = new THREE.Group();
    knee.position.y = -0.25;
    hip.add(knee);
    add(new THREE.CapsuleGeometry(0.075, 0.1, 4, 10), pants, 0, -0.1, 0, knee);
    const shoe = ball(0.085, 0xfafafa, 0, -0.21, 0.04, knee); // giày tròn
    shoe.scale.set(1, 0.6, 1.35);
    legs.push(hip);
    knees.push(knee);
  }
  // thân tròn + cạp quần
  const torso = add(new THREE.CapsuleGeometry(0.2 * belly, 0.16, 6, 14), shirt, 0, HIP + 0.2, 0, body);
  torso.scale.z = 0.85;
  cyl(0.2 * belly, 0.19 * belly, 0.1, pants, 0, HIP + 0.02, 0, body).scale.z = 0.85;
  if (skirt) cyl(0.2, 0.3, 0.26, skirt, 0, HIP - 0.06, 0, body).scale.z = 0.85; // váy xoè

  // đầu to
  const head = new THREE.Group();
  head.position.y = HIP + 0.72;
  body.add(head);
  const R = 0.3;
  ball(R, bald ? mat(skin, { roughness: 0.35 }) : soft(skin), 0, 0, 0, head);
  const face = (x, y) => Math.sqrt(R * R - x * x - y * y) - 0.005;
  // mắt nhắm cười: hai vòng cung "∩"
  for (const ex of [-0.1, 0.1]) {
    const eye = add(new THREE.TorusGeometry(0.038, 0.011, 6, 14, Math.PI), 0x3e2723, ex, 0.0, face(ex, 0.02), head);
    eye.rotation.y = Math.atan2(ex, face(ex, 0)) ;
  }
  // miệng cười "∪"
  const mouth = add(new THREE.TorusGeometry(0.035, 0.009, 6, 14, Math.PI), 0x8d3b2f, 0, -0.085, face(0, -0.085), head);
  mouth.rotation.z = Math.PI;
  // má hồng
  for (const cx of [-0.17, 0.17]) {
    const cheek = ball(0.06, new THREE.MeshBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.55 }), cx, -0.06, face(cx, -0.06) - 0.01, head);
    cheek.scale.set(1, 0.7, 0.35);
    cheek.rotation.y = Math.atan2(cx, face(cx, -0.06));
  }
  if (!bald) {
    const cap = add(new THREE.SphereGeometry(R + 0.012, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hair, 0, 0.01, -0.02, head);
    cap.rotation.x = -0.45; // mái tóc hất ra sau, chừa mặt
  }
  if (female) {
    const back = add(new THREE.CapsuleGeometry(0.2, 0.18, 6, 12), hair, 0, -0.12, -0.17, head);
    back.scale.z = 0.6;
  }
  if (bow) { // nơ cài tóc
    for (const sx of [-1, 1]) ball(0.07, bow, 0.17 + sx * 0.07, 0.22, -0.05, head).scale.set(1, 0.7, 0.5);
    ball(0.035, bow, 0.17, 0.22, -0.04, head);
  }
  if (hat) add(new THREE.ConeGeometry(0.46, 0.2, 18), 0xd4b483, 0, 0.32, 0, head); // nón lá
  if (chefHat) {
    cyl(0.2, 0.18, 0.2, 0xffffff, 0, 0.33, 0, head); // mũ đầu bếp
    ball(0.22, 0xffffff, 0, 0.46, 0, head).scale.y = 0.6;
  }

  // tay ngắn mũm mĩm, bàn tay tròn
  const arms = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(sx * (0.2 * belly + 0.05), HIP + 0.36, 0);
    body.add(p);
    add(new THREE.CapsuleGeometry(0.075, 0.1, 4, 10), shirt, 0, -0.1, 0, p);
    ball(0.07, soft(skin), 0, -0.25, 0, p);
    arms.push(p);
  }
  // Ly ở tay phải
  const cup = new THREE.Group();
  cup.position.set(0, -0.28, 0.06);
  arms[1].add(cup);
  cyl(0.04, 0.034, 0.1, mat(0xffffff, { transparent: true, opacity: 0.35 }), 0, 0, 0, cup);
  const liquidMat = mat(BEER.color, { roughness: 0.2 });
  const liquidGeo = new THREE.CylinderGeometry(0.036, 0.031, 0.085, 12);
  liquidGeo.translate(0, 0.0425, 0);
  const liquid = add(liquidGeo, liquidMat, 0, -0.045, 0, cup);
  cup.visible = false;
  // Chai ở tay trái (khi rót), mic ở tay phải (khi hát)
  const bottle = new THREE.Group();
  bottle.position.set(0, -0.3, 0.06);
  arms[0].add(bottle);
  cyl(0.035, 0.035, 0.18, glassMat, 0, 0, 0, bottle);
  cyl(0.013, 0.033, 0.08, glassMat, 0, 0.13, 0, bottle);
  bottle.visible = false;
  const mic = new THREE.Group();
  mic.position.set(0, -0.3, 0.06);
  arms[1].add(mic);
  cyl(0.02, 0.015, 0.16, 0x111111, 0, 0, 0, mic);
  ball(0.035, 0x555555, 0, 0.1, 0, mic);
  mic.visible = false;

  return { root, body, head, arms, legs, knees, cup, liquid, liquidMat, bottle, mic, seated: false };
}

function setSeated(p, seated) {
  p.seated = seated;
  p.legs.forEach((l) => (l.rotation.x = seated ? -Math.PI / 2 : 0));
  p.knees.forEach((k) => (k.rotation.x = seated ? Math.PI / 2 : 0));
  p.cup.visible = seated;
}

function lookToOpts(look, seed = 0) {
  return {
    shirt: SHIRTS[look.s] ?? SHIRTS[0],
    hair: HAIR_COLORS[seed % HAIR_COLORS.length],
    female: look.h === 1,
    bald: look.h === 2,
    belly: look.b ? 1.35 : 1,
  };
}

// Actor = nhân vật + nhãn tên + bong bóng.
function createActor(opts, name, kind = 'player') {
  const person = makePerson(opts);
  scene.add(person.root);
  const tag = document.createElement('div');
  tag.className = 'tag ' + kind;
  const bubble = document.createElement('div');
  bubble.className = 'bubble hidden';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = name;
  tag.append(bubble, label);
  $('tags').appendChild(tag);
  return {
    person, name, tag, bubble, kind, bubbleUntil: 0, anim: null, animT: 0,
    x: 0, z: 0, f: 0, yaw: 0, rx: 0, rz: 0, ryaw: 0, d: 0, seat: null, walk: 0, singing: false, id: null,
  };
}
function removeActor(a) {
  scene.remove(a.person.root);
  a.tag.remove();
  if (a.hit) unclickable(a.hit);
}
function speak(a, text, ms = 3800) {
  if (!a) return;
  a.bubble.textContent = text;
  a.bubble.classList.remove('hidden');
  a.bubbleUntil = performance.now() + ms;
}
function playAct(a, k) {
  a.anim = k;
  a.animT = 0;
  if (ACT_EMOJI[k]) speak(a, ACT_EMOJI[k], 1800);
}
function placeAt(a, x, z, yaw, f) {
  if (f !== undefined) a.f = f;
  a.x = a.rx = x;
  a.z = a.rz = z;
  if (yaw !== undefined) a.yaw = a.ryaw = yaw;
  a.person.root.position.set(x, a.f * FLOOR_H, z);
  a.person.root.rotation.y = a.ryaw;
}
function seatActor(a, table, idx) {
  const T = TABLES[table], s = seatPos(T, idx);
  a.seat = { table, idx };
  placeAt(a, s.x, s.z, seatYaw(T, idx), T.floor);
  setSeated(a.person, true);
  a.person.liquidMat.color.setHex(drinkOf(table).color);
}
function unseatActor(a) {
  a.seat = null;
  setSeated(a.person, false);
}

// ---------- NPC ----------
const chuBaTable = TABLES.find((T) => T.npcSeats);
const chuBa = createActor({ shirt: 0x6ab04c, bald: true, belly: 1.2, skin: 0xc98d62 }, 'Chú Ba', 'npc');
seatActor(chuBa, chuBaTable.id, chuBaTable.npcSeats[0]);

const owner = createActor({ shirt: 0xd81b60, female: true, hair: 0x1a0f08 }, 'Chị chủ', 'npc');
placeAt(owner, 4.8, -3.1, 0, 0);
clickable(box(3, 1.8, 1.4, HIT_MAT, 4.8, 0.9, -2.7, F1), {
  f: 0,
  pos: () => ({ x: 4.8, z: -1.7 }),
  range: 1.6,
  label: () => (wallet.debt > 0 ? `📒 <b>trả nợ</b> ${fmt(wallet.debt)} ở quầy thu ngân` : 'gọi món / tính tiền ở <b>quầy thu ngân</b>'),
  action: () => {
    if (wallet.debt > 0) { speak(owner, 'Trả nợ hả em? Để chị gạch sổ.'); send({ t: 'pay-debt' }); return; }
    speak(owner, 'Em ăn gì nào?');
    openMenu();
  },
});

const vendor = createActor({ shirt: 0x8d6e63, hair: 0x333333, female: true, hat: true }, 'Cô bán lạc', 'npc');
box(0.5, 0.06, 0.35, 0x8d6e63, 0, 0.8, 0.42, vendor.person.body);
for (let i = 0; i < 5; i++) box(0.08, 0.05, 0.08, 0xf5deb3, -0.18 + i * 0.09, 0.85, 0.42, vendor.person.body);
placeAt(vendor, -9, 2.95, Math.PI / 2, 0);
vendor.dir = 1;
vendor.fixedArms = -1.3;
clickable(add(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), HIT_MAT, 0, 0.9, 0, vendor.person.root), {
  f: 0,
  pos: () => vendor,
  range: 1.8,
  label: () => 'mua <b>lạc rang</b> (15k)',
  action: () => {
    if (net.online) {
      if (wallet.money < VENDOR_PRICE) return toast('💸 Hết tiền mua lạc rồi, ra biển kiếm thêm nhé!');
      send({ t: 'buy-vendor' }); // server trừ tiền xong báo vendor-ok
    } else onMessage({ t: 'vendor-ok' });
  },
});
const chef = createActor({ shirt: 0xffffff, pants: 0x37474f, chefHat: true, belly: 1.25 }, 'Đầu bếp Tâm', 'npc');
placeAt(chef, 6.6, -14.7, Math.PI, 0);
chef.fixedArms = -1.1;
chef.stir = true;
clickable(add(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), HIT_MAT, 0, 0.9, 0, chef.person.root), {
  f: 0,
  pos: () => chef,
  range: 2,
  label: () => 'nói chuyện với <b>đầu bếp</b>',
  action: () => speak(chef, pick(LINES.chef)),
});

// Em phục vụ ở quầy phụ tầng 2: gọi món ngay tại tầng, đồ ăn lên bằng thang tời.
const waiter = createActor({ shirt: 0x1b5e20, female: true, hair: 0x2b1a0e }, 'Em phục vụ', 'npc');
placeAt(waiter, 4.2, -14.4, 0, 1);
clickable(add(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), HIT_MAT, 0, 0.9, 0, waiter.person.root), {
  f: 1,
  pos: () => waiter,
  range: 1.8,
  label: () => 'gọi thêm bia đá với <b>em phục vụ</b>',
  action: () => { speak(waiter, 'Anh chị dùng gì ạ?'); openMenu(); },
});

// Bác giữ xe ở bãi xe trước quán
const guard = createActor({ shirt: 0x546e7a, hair: 0x9e9e9e, hat: true }, 'Bác giữ xe', 'npc');
placeAt(guard, PARKING.minX - 0.6, 1.2, Math.PI / 2, 0);
clickable(add(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), HIT_MAT, 0, 0.9, 0, guard.person.root), {
  f: 0,
  pos: () => guard,
  range: 1.8,
  label: () => 'nói chuyện với <b>bác giữ xe</b>',
  action: () => speak(guard, pick(LINES.guard)),
});
// Bà Tư thu mua hải sản, ve chai: sạp nhỏ dưới chân bậc xuống biển, khách đem đồ trong giỏ ra đây bán.
const trader = createActor({ shirt: 0x1565c0, hair: 0x9e9e9e, female: true, hat: true, belly: 1.15, skin: 0xc68a5a }, 'Bà Tư thu mua', 'npc');
// Sạp vuông, quầy ở cả 4 phía nên đi hướng nào tới cũng thấy và bán được; bà đứng giữa.
const STALL = 1.1; // nửa cạnh sạp
{
  const T = TRADER, g = new THREE.Group(), S = STALL, d = 0.45, c = S - d / 2;
  g.position.set(T.x, 0, T.z);
  scene.add(g);
  const sides = [ // [hướng x, hướng z, góc quay mặt ra ngoài, đồ bày trên quầy]
    [0, 1, 0, ['🐟', '🦀']], [0, -1, Math.PI, ['🐚', '🦐']], [1, 0, Math.PI / 2, ['🍾', '🐟']], [-1, 0, -Math.PI / 2, ['🦑', '🐚']],
  ];
  for (const [sx, sz, ry, icons] of sides) {
    const along = sx ? [d, 2 * S] : [2 * S, d]; // quầy chạy dọc cạnh
    box(along[0], 0.08, along[1], 0x8d6e63, sx * c, 0.72, sz * c, g); // mặt quầy
    box(sx ? 0.04 : 2 * S, 0.4, sx ? 2 * S : 0.04, 0xa1887f, sx * (S - 0.02), 0.45, sz * (S - 0.02), g); // tấm chắn ngoài
    icons.forEach((icon, i) => {
      const off = (i - 0.5) * 0.9, x = sx * c + (sx ? 0 : off), z = sz * c + (sz ? 0 : off);
      cyl(0.2, 0.15, 0.12, 0x29b6f6, x, 0.82, z, g);
      const sp = emojiSprite(icon, 0.3);
      sp.position.set(x, 0.98, z);
      g.add(sp);
    });
    // biển hiệu treo dưới mép mái, mỗi phía một tấm
    textPlane(g, 'THU MUA HẢI SẢN · VE CHAI', 1.9, 0.28, sx * (S + 0.06), 2.02, sz * (S + 0.06), ry, { bg: '#0d47a1', fg: '#ffeb3b', font: 'bold 60px sans-serif' });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, 2.2, 0.07, 0x5d4037, sx * (S - 0.04), 1.1, sz * (S - 0.04), g); // 4 cột góc
  cyl(0.14, 0.14, 0.02, 0xb0bec5, S - 0.3, 0.78, S - 0.3, g); // cân đĩa
  box(0.1, 0.12, 0.1, 0xd32f2f, S - 0.3, 0.84, S - 0.3, g);
  ball(0.32, 0xcfd8dc, -S - 0.45, 0.3, S - 0.2, g); // bao ve chai
  // mái chóp 4 mặt che nắng
  const roof = add(new THREE.ConeGeometry(S * 1.75, 0.6, 4, 1, true), mat(0xff7043, { side: THREE.DoubleSide }), 0, 2.45, 0, g);
  roof.rotation.y = Math.PI / 4;
  solidBox(0, T.x, T.z, 2 * S + 0.1, 2 * S + 0.1);
}
placeAt(trader, TRADER.x, TRADER.z, 0, 0); // mặc định nhìn ra biển
trader.fixedArms = -0.6;
// Chỗ đứng giao dịch: ngay ngoài quầy, ở phía người chơi đang đứng.
function traderSpot() {
  const dx = meA.x - TRADER.x, dz = meA.z - TRADER.z, d = Math.hypot(dx, dz) || 1;
  return { x: TRADER.x + (dx / d) * (STALL + 0.45), z: TRADER.z + (dz / d) * (STALL + 0.45) };
}
clickable(add(new THREE.CylinderGeometry(STALL + 0.2, STALL + 0.2, 1.8, 12), HIT_MAT, 0, 0.9, 0, trader.person.root), {
  f: 0,
  pos: traderSpot,
  range: 1.0,
  label: () => `bán đồ cho <b>Bà Tư</b> (🎒 ${wallet.bag.length})`,
  action: () => {
    speak(trader, pick(wallet.bag.length ? LINES.traderBuy : LINES.traderEmpty), 3000);
    openBag();
  },
});
// Bà xoay theo người đứng gần quầy nhất (người đang giao dịch); không ai thì quay ra biển.
function updateTrader(dt) {
  let best = null, bestD = TRADER.range;
  for (const a of allActors()) {
    if (a.f !== 0 || a.seat) continue;
    const d = Math.hypot(a.rx - TRADER.x, a.rz - TRADER.z);
    if (d < bestD) { best = a; bestD = d; }
  }
  const want = best ? Math.atan2(best.rx - TRADER.x, best.rz - TRADER.z) : 0;
  trader.yaw = lerpAngle(trader.yaw, want, Math.min(1, dt * 4));
}
const npcs = [chuBa, owner, vendor, chef, waiter, guard, trader];

// ================= Nhân viên quán =================
// Chạy bàn 5 người: 1 em nhận order đi vòng các bàn tầng 1, 2 em bưng bê tầng 1 (bếp ra bàn),
// 1 em bưng bê sân thượng (thang tời ra bàn), cộng em phục vụ tầng 2 ở trên.
// Bếp: 2 đầu bếp chính (đứng chảo: Tâm, đứng thớt: Lan), phụ bếp sơ chế (Út) và cô rửa chén (Mận).
// Chỉ là diễn hoạt phía máy khách; món vẫn do server ghi vào hoá đơn như cũ.
const staff = []; // { a, speed, route, then, tick, ... }
function addStaff(opts, name, f, x, z, yaw, extra = {}) {
  const a = createActor(opts, name, 'npc');
  placeAt(a, x, z, yaw, f);
  npcs.push(a);
  const st = { a, speed: 1.7, route: [], then: null, ...extra };
  staff.push(st);
  return st;
}
// Trả về false nếu không có đường (ví dụ phòng riêng đang khoá cửa).
function staffGo(st, x, z, then) {
  const path = findPath(st.a.f, st.a.x, st.a.z, x, z, true);
  st.route = path ? path.slice() : [{ x, z }];
  st.then = then;
  return !!path;
}
// Đi tới phục vụ một bàn: thử chỗ mong muốn (vd. sau lưng khách), rồi mép bàn (bàn phòng riêng: phía cửa,
// vì ghế bàn dài xếp kín). Nhân viên có chìa khoá nên vào được cả phòng đang khoá.
function goServe(st, T, want, then) {
  if (want && staffGo(st, want.x, want.z, then)) return;
  const edge = T.room ? { x: T.x, z: T.z + Math.sign(T.room.doorZ - T.z) * ((T.shape === 'long' ? T.w / 2 : T.r) + 1) } : T;
  if (staffGo(st, edge.x, edge.z, then) || !T.room) return;
  staffGo(st, T.x, T.room.doorZ + (T.z > T.room.doorZ ? -0.6 : 0.6), then);
}

// Khay trên tay nhân viên bưng bê (ẩn khi không mang gì).
function addTray(a) {
  const tray = new THREE.Group();
  tray.position.set(0, 0.82, 0.42);
  cyl(0.18, 0.18, 0.02, 0x9e9e9e, 0, 0, 0, tray);
  tray.visible = false;
  a.person.body.add(tray);
  return tray;
}
function carry(st, icon) {
  st.tray.visible = !!icon;
  st.a.fixedArms = icon ? -1.3 : 0;
  if (st.food) { st.tray.remove(st.food); st.food = null; }
  if (icon) {
    st.food = emojiSprite(icon, 0.24);
    st.food.position.y = 0.12;
    st.tray.add(st.food);
  }
}

// Bếp: đầu bếp đứng thớt, bồn rửa và cô rửa chén
const chef2 = addStaff({ shirt: 0xffffff, pants: 0x37474f, chefHat: true, female: true, hair: 0x2b1a0e }, 'Bếp phó Lan', 0, 6.0, -12.4, Math.PI);
chef2.a.fixedArms = -1.0;
chef2.a.stir = true;
box(0.7, 0.9, 1.3, steelMat(), KITCHEN.minX + 0.45, 0.45, -13.4, F1); // bồn rửa
box(0.55, 0.06, 1.1, 0x90a4ae, KITCHEN.minX + 0.45, 0.91, -13.4, F1);
for (let i = 0; i < 5; i++) cyl(0.13, 0.1, 0.02, 0xffffff, KITCHEN.minX + 0.4, 0.94 + i * 0.03, -12.95, F1); // chồng đĩa
solidBox(0, KITCHEN.minX + 0.45, -13.4, 0.7, 1.3);
const washer = addStaff({ shirt: 0x8e24aa, female: true, hair: 0x5d4037, belly: 1.1 }, 'Cô rửa chén Mận', 0, KITCHEN.minX + 1.15, -13.4, -Math.PI / 2);
washer.a.fixedArms = -0.9;
washer.a.stir = true;
// Phụ bếp: chạy qua lại tủ lạnh ↔ bàn sơ chế, mang rau ra cho bếp
const prep = addStaff({ shirt: 0xf5f5f5, pants: 0x5d4037, hair: 0x1b1b1b }, 'Phụ bếp Út', 0, 7.6, -12.4, Math.PI, { wait: 2 });
prep.tray = addTray(prep.a);
prep.tick = (st, dt) => {
  if ((st.wait -= dt) > 0) return;
  st.wait = 2 + Math.random() * 2;
  const toFridge = !st.atFridge;
  staffGo(st, toFridge ? 10.5 : 7.6, toFridge ? -14.2 : -12.4, () => {
    st.atFridge = toFridge;
    st.a.yaw = toFridge ? Math.PI / 2 : Math.PI;
    if (toFridge) setTimeout(() => carry(st, pick(['🥬', '🧅', '🦑', '🥩'])), 600); // lấy đồ trong tủ
    else carry(st, null); // đặt xuống bàn sơ chế
  });
};

// Chạy bàn: bưng bê (lấy món ở cửa bếp / thang tời rồi mang ra bàn)
const RUNNER_SPOTS = {
  0: { pickup: { x: 9.3, z: -12.8 } },
  1: { pickup: { x: 3.6, z: -14.2 } }, // thang tời tầng phòng riêng
  2: { pickup: { x: DUMBWAITER.x + 0.6, z: DUMBWAITER.z + 1.1 } },
};
const runners = [
  addStaff({ shirt: 0xd32f2f, hair: 0x1b1b1b }, 'Em bưng Tí', 0, 8.6, -11.2, 0, { home: { x: 8.6, z: -11.2 } }),
  addStaff({ shirt: 0xd32f2f, female: true, hair: 0x2b1a0e }, 'Em bưng Na', 0, 10.0, -11.2, 0, { home: { x: 10.0, z: -11.2 } }),
  addStaff({ shirt: 0x1e88e5, hair: 0x3e2723 }, 'Em bưng Tèo', 2, DUMBWAITER.x + 1.2, DUMBWAITER.z + 1.8, 0,
    { home: { x: DUMBWAITER.x + 1.2, z: DUMBWAITER.z + 1.8 } }),
];
for (const r of runners) { r.tray = addTray(r.a); r.speed = 2.1; }
const deliveries = []; // { table, item, done }
// Món của mọi tầng: em bưng bê mang ra, tới bàn mới bày món. Quá 60 giây chưa tới thì bày luôn.
function deliverDish(table, item) {
  const d = { table, item, done: false };
  d.timer = setTimeout(() => finishDelivery(d), 60000);
  // Đã có em đang bưng cho bàn này mà chưa tới nơi thì bưng luôn món mới trong cùng chuyến.
  const r = runners.find((r) => r.job && !r.job.served && r.job[0].table === table);
  if (r) { r.job.push(d); return; }
  deliveries.push(d);
  assignRunners();
}
function finishDelivery(d, runner) {
  if (d.done) return;
  d.done = true;
  clearTimeout(d.timer);
  serveDish(d.table, d.item);
  if (runner) speak(runner.a, `${MENU[d.item].icon} ${pick(LINES.runner)}`, 2200);
}
function assignRunners() {
  for (const r of runners) {
    if (r.job) continue;
    const i = deliveries.findIndex((d) => !d.done && TABLES[d.table].floor === r.a.f);
    if (i < 0) continue;
    // Bưng một lượt mọi món đang chờ của cùng bàn đó.
    const table = deliveries[i].table, T = TABLES[table], P = RUNNER_SPOTS[r.a.f].pickup;
    const batch = deliveries.filter((d) => !d.done && d.table === table);
    for (const d of batch) deliveries.splice(deliveries.indexOf(d), 1);
    r.job = batch;
    staffGo(r, P.x, P.z, () => setTimeout(() => {
      const first = batch.find((d) => !d.done);
      if (!first) return runnerHome(r);
      carry(r, MENU[first.item].icon);
      const serve = () => {
        batch.served = true;
        carry(r, null);
        r.a.yaw = Math.atan2(T.x - r.a.x, T.z - r.a.z);
        batch.filter((d) => !d.done).forEach((d, k) => finishDelivery(d, k ? null : r));
        setTimeout(() => runnerHome(r), 700);
      };
      goServe(r, T, null, serve);
    }, 500));
  }
}
function runnerHome(r) {
  carry(r, null);
  r.job = null;
  if (deliveries.some((d) => !d.done && TABLES[d.table].floor === r.a.f)) return assignRunners();
  staffGo(r, r.home.x, r.home.z, () => (r.a.yaw = 0));
}

// Em nhận order: đi vòng các bàn tầng 1, đứng lại hỏi khách; bấm vào em là gọi món.
const orderTaker = addStaff({ shirt: 0x2e7d32, female: true, hair: 0x1a0f08 }, 'Em order Vy', 0, 0, 0.6, 0, { wait: 3 });
orderTaker.speed = 1.3;
// Đi vòng hỏi order, ưu tiên bàn có khách. anyChance: tỉ lệ ghé bàn bất kỳ (0 = chỉ bàn có khách,
// tầng không có khách thì về chỗ đứng).
function roamTick(f, spotOf, lines, anyChance = 0) {
  return (st, dt) => {
    if (st.job || (st.wait -= dt) > 0) return;
    st.wait = 3 + Math.random() * 4;
    const all = TABLES.filter((T) => T.floor === f && (f !== 0 || !T.private));
    const busy = all.filter((T) => seatedAt(T.id) > 0);
    const T = busy.length && Math.random() >= anyChance ? pick(busy) : anyChance ? pick(all) : null;
    if (!T) {
      if (st.home && Math.hypot(st.a.x - st.home.x, st.a.z - st.home.z) > 0.5) staffGo(st, st.home.x, st.home.z, () => (st.a.yaw = st.home.yaw ?? 0));
      return;
    }
    const p = spotOf(T);
    staffGo(st, p.x, p.z, () => {
      st.a.yaw = Math.atan2(T.x - st.a.x, T.z - st.a.z);
      if (meA?.f === f && Math.hypot(meA.rx - st.a.rx, meA.rz - st.a.rz) < 5) speak(st.a, pick(lines), 2500);
    });
  };
}
const tableSpot = (T) => ({ x: T.x, z: T.z }); // tới sát bàn (đường đi tự dừng ở ô trống cạnh bàn)
// Mỗi tầng một em order giống nhau: đi vòng ghé bàn có khách hỏi gọi món (chỉ diễn hoạt, gọi món bằng nút 📜).
// Tầng 2 là phòng riêng nên em đứng ngoài hành lang trước cửa.
orderTaker.tick = roamTick(0, tableSpot, LINES.orderTaker, 0.3);
const ORDER_LOOK = { shirt: 0x2e7d32, female: true };
const orderTaker2 = addStaff({ ...ORDER_LOOK, hair: 0x3e2723 }, 'Em order Nhi', 1, 2.2, -8.5, 0, { wait: 4, home: { x: 2.2, z: -8.5, yaw: 0 } });
orderTaker2.speed = 1.3;
orderTaker2.tick = roamTick(1, (T) => ({ x: T.x, z: -8.5 }), LINES.orderTaker, 0.3);
const orderTaker3 = addStaff({ ...ORDER_LOOK, hair: 0x1b1b1b }, 'Em order Thư', 2, 2.6, -2.6, Math.PI, { wait: 5, home: { x: 2.6, z: -2.6, yaw: Math.PI } });
orderTaker3.speed = 1.3;
orderTaker3.tick = roamTick(2, tableSpot, LINES.orderTaker, 0.3);
// Em phục vụ tầng 2 và em bưng Tèo sân thượng chỉ bưng bê (lấy món ở thang tời rồi mang tới bàn).
const waiterSt = { a: waiter, speed: 1.8, route: [], then: null, wait: 4, home: { x: 4.2, z: -14.4, yaw: 0 } };
staff.push(waiterSt);
waiterSt.tray = addTray(waiter);
runners.push(waiterSt);
for (const [st, lines] of [[chef2, LINES.chef], [washer, LINES.dishwasher], [prep, LINES.prep]]) {
  clickable(add(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8), HIT_MAT, 0, 0.9, 0, st.a.person.root), {
    f: 0,
    pos: () => st.a,
    range: 2,
    label: () => `nói chuyện với <b>${st.a.name}</b>`,
    action: () => speak(st.a, pick(lines)),
  });
}

// Em rót bia: mỗi tầng một em. Bấm "Rót" là em tới bàn, rót lần lượt cho những ai đang có ly rỗng
// (server chọn người và tính tiền, xem 'pour-round').
const BEER_GIRL_LOOK = { shirt: 0xe53935, pants: 0xf5f5f5, skirt: 0xc62828, female: true, hair: 0x3e2723, bow: 0xff80ab, skin: 0xf6c49a };
const beerGirls = [
  // sát tường trái giữa hai khung thơ, quay mặt vào quán
  addStaff(BEER_GIRL_LOOK, 'Em rót bia Hồng', 0, -17.4, -5.6, Math.PI / 2, { home: { x: -17.4, z: -5.6, yaw: Math.PI / 2 }, jobs: [] }),
  // giữa hành lang phòng riêng: các phòng đều mở cửa ra hành lang
  addStaff({ ...BEER_GIRL_LOOK, hair: 0x1a0f08 }, 'Em rót bia Mai', 1, 0, -8.5, 0, { home: { x: 0, z: -8.5, yaw: 0 }, jobs: [] }),
  // giữa khu bàn sân thượng, sát lan can, quay mặt vào trong
  addStaff({ ...BEER_GIRL_LOOK, hair: 0x5d4037 }, 'Em rót bia Thảo', 2, 0, -2.0, Math.PI, { home: { x: 0, z: -2.0, yaw: Math.PI }, jobs: [] }),
];
for (const g of beerGirls) { g.tray = addTray(g.a); g.speed = 2; }
let pourPending = false; // em đang tới rót cho mình (server đã tính tiền ly này)
function pourRound(m) {
  const T = TABLES[m.table], g = beerGirls[T.floor];
  const mineDzo = m.by === myId && m.cheers && dzoWaiting; // mình bấm Dzô: rót xong mới hô
  if (!m.ids.length) { if (mineDzo) finishDzoWait(); return; }
  if (m.ids.includes(myId)) pourPending = true;
  const job = { table: m.table, ids: m.ids.slice() };
  if (mineDzo) {
    clearTimeout(dzoWaiting.timer);
    dzoWaiting.timer = setTimeout(finishDzoWait, 30000); // em kẹt đường quá lâu thì dzô luôn
    job.onDone = finishDzoWait;
    toast('🍺 Em rót bia tới rót cho cả bàn, rót xong là dzô!');
  }
  // Quá lâu chưa tới (kẹt đường, cửa khoá) thì ly của mình tự đầy.
  job.timer = setTimeout(() => { if (job.ids.includes(myId)) fillMine(); }, 40000);
  g.jobs.push(job);
  if (m.by === myId) speak(g.a, 'Dạ em tới liền! 🍺', 2000);
  if (!g.busy) nextPour(g);
}
// Chỗ em rót bia đứng: khe giữa ghế người được rót và ghế kế bên (chen giữa các nhân vật, không đứng sau lưng).
function pourSpot(T, idx) {
  const s = seatPos(T, idx);
  if (T.shape === 'long') {
    const per = Math.ceil(T.seats / 2), step = T.len / per, side = Math.sign(s.z - T.z) || 1;
    const k = idx < per ? idx : idx - per, dir = k < per - 1 ? 1 : -1; // ghế cuối dãy thì đứng khe bên trong
    return { x: s.x + dir * step / 2, z: s.z + side * 0.15 };
  }
  const R = Math.hypot(s.x - T.x, s.z - T.z) + 0.1, a = Math.atan2(s.x - T.x, s.z - T.z) + Math.PI / T.seats;
  return { x: T.x + Math.sin(a) * R, z: T.z + Math.cos(a) * R };
}
function fillMine() {
  if (!pourPending) return;
  pourPending = false;
  if (meA.seat && state.fill < 0.5) setFill(0.95);
}
function nextPour(g) {
  const job = g.jobs[0];
  if (!job) {
    g.busy = false;
    g.speed = 2;
    carry(g, null);
    staffGo(g, g.home.x, g.home.z, () => (g.a.yaw = g.home.yaw ?? 0));
    return;
  }
  g.busy = true;
  carry(g, '🍺');
  const id = job.ids.shift();
  if (!job.ids.length && id === undefined) { clearTimeout(job.timer); g.jobs.shift(); job.onDone?.(); return nextPour(g); }
  const a = actorById(id), T = TABLES[job.table];
  const done = () => {
    if (!job.ids.length) { clearTimeout(job.timer); g.jobs.shift(); job.onDone?.(); }
    nextPour(g);
  };
  if (!a?.seat || a.seat.table !== job.table) { if (id === myId) fillMine(); return done(); }
  g.speed = Math.hypot(a.rx - g.a.x, a.rz - g.a.z) > 8 ? 3.1 : 2; // bàn xa thì đi gấp
  goServe(g, T, pourSpot(T, a.seat.idx), () => {
    g.a.yaw = Math.atan2(a.rx - g.a.x, a.rz - g.a.z);
    playAct(g.a, 'pour');
    if (meA?.f === g.a.f && Math.hypot(meA.rx - g.a.rx, meA.rz - g.a.rz) < 6) pourSound();
    setTimeout(() => {
      if (a === meA) { fillMine(); speak(g.a, 'Mời anh chị ạ! 🍺', 1500); }
      done();
    }, 1000);
  });
}

// Lần chạy đầu (đã dựng xong cả quán): ai đứng trúng bàn ghế, tường thì dời ra ô trống gần nhất, kể cả chỗ đứng chờ.
let staffSettled = false;
function settleStaff() {
  staffSettled = true;
  for (const st of staff) {
    const p = freeSpot(st.a.f, st.a.x, st.a.z);
    placeAt(st.a, p.x, p.z, st.a.yaw);
    if (st.home) Object.assign(st.home, freeSpot(st.a.f, st.home.x, st.home.z));
  }
}
function updateStaff(dt) {
  if (!staffSettled) settleStaff();
  const waitFor = pending?.pos?.();
  for (const st of staff) {
    const a = st.a;
    // Khách đang đi tới gọi mình thì đứng lại chờ, quay mặt về phía khách.
    if (waitFor === a && meA && Math.hypot(meA.x - a.x, meA.z - a.z) < 12) {
      a.yaw = Math.atan2(meA.x - a.x, meA.z - a.z);
      continue;
    }
    if (st.route.length) {
      const wp = st.route[0], dx = wp.x - a.x, dz = wp.z - a.z, d = Math.hypot(dx, dz), step = st.speed * dt;
      if (d <= step) {
        a.x = wp.x;
        a.z = wp.z;
        st.route.shift();
      } else {
        a.x += (dx / d) * step;
        a.z += (dz / d) * step;
        a.yaw = Math.atan2(dx, dz);
      }
      if (!st.route.length) {
        const then = st.then;
        st.then = null;
        then?.();
      }
    } else st.tick?.(st, dt);
  }
}

// ================= Bãi biển: người đi dạo và chơi =================
// Bãi cát từ z ≈ 14 tới mép nước SEA_Z. Người chơi đi dạo xuống được qua bậc thang trước quán.
const beachRnd = (() => { let sd = 2024; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; })();
const BEACH_SHIRTS = [0xff7043, 0x29b6f6, 0xffee58, 0xab47bc, 0x66bb6a, 0xffffff, 0xef5350, 0x26c6da, 0xffa726];
const BEACH_SKINS = [0xe8b98f, 0xd9a273, 0xc98d62, 0xf1c8a0];
function beachPerson(o = {}, parent = scene) {
  const p = makePerson({
    shirt: pick(BEACH_SHIRTS), pants: pick([0x1565c0, 0x37474f, 0xf9a825, 0x00897b, 0xd84315]),
    skin: BEACH_SKINS[Math.floor(beachRnd() * BEACH_SKINS.length)], female: beachRnd() < 0.45, ...o,
  });
  p.cup.visible = false;
  parent.add(p.root);
  return p;
}
function walkPose(p, phase, amp = 0.5) {
  p.legs.forEach((l, i) => (l.rotation.x = Math.sin(phase + i * Math.PI) * amp));
  p.arms.forEach((a, i) => (a.rotation.x = -Math.sin(phase + i * Math.PI) * amp * 0.8));
}
const dayGroup = (g = new THREE.Group()) => (scene.add(g), dayOnly.push(g), g);
const nightGroup = (g = new THREE.Group()) => (scene.add(g), nightOnly.push(g), g);

// Người đi dạo, chạy bộ dọc bãi (cả ngày lẫn đêm)
const strollers = [];
for (let i = 0; i < 14; i++) {
  const jog = i < 3, p = beachPerson(jog ? { shirt: pick([0xff1744, 0x00e676, 0x2979ff]) } : {});
  const dir = beachRnd() < 0.5 ? 1 : -1;
  const w = { p, x: -70 + beachRnd() * 140, z: 17 + beachRnd() * 24, dir, speed: jog ? 2.8 + beachRnd() : 0.7 + beachRnd() * 0.5, phase: beachRnd() * 6, jog };
  // đôi khi đi theo cặp
  if (!jog && i % 4 === 0) {
    const q = beachPerson();
    strollers.push({ ...w, p: q, z: w.z + 0.7, phase: w.phase + 1 });
  }
  strollers.push(w);
}
// Ông chụp ảnh hoàng hôn, đứng yên giơ máy
const photographer = beachPerson({ shirt: 0x8d6e63, bald: true, female: false });
photographer.root.position.set(34, 0, 38);
photographer.root.rotation.y = 0.2;
photographer.arms.forEach((a) => (a.rotation.x = -1.6));
box(0.18, 0.12, 0.1, 0x212121, 0, 1.18, 0.4, photographer.body);

// Bóng chuyền bãi biển 2 đấu 2 (ban ngày)
const VB = { x: -18, z: 30 }, vbG = dayGroup();
for (const dz of [-4, 4]) cyl(0.05, 0.05, 2.5, 0xeeeeee, VB.x, 1.25, VB.z + dz, vbG);
box(0.02, 0.9, 8, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }), VB.x, 1.95, VB.z, vbG);
box(0.04, 0.08, 8, 0xffffff, VB.x, 2.4, VB.z, vbG);
const vbPlayers = [[-1, -3, -1.8], [-1, -4.5, 2], [1, 3, 1.8], [1, 4.5, -2]].map(([side, dx, dz]) => {
  const p = beachPerson({ female: beachRnd() < 0.5 }, vbG);
  p.home = { x: VB.x + dx, z: VB.z + dz };
  p.root.position.set(p.home.x, 0, p.home.z);
  p.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  p.side = side;
  return p;
});
const vbBall = ball(0.13, 0xfff176, 0, 2, 0, vbG);
const vb = { from: 0, to: 2, t: 0, dur: 1.5 };

// Mấy đứa nhỏ đá bóng (ban ngày)
const fbG = dayGroup();
const kids = [[10, 24], [15, 27], [11, 30]].map(([x, z]) => {
  const p = beachPerson({ female: false }, fbG);
  p.root.scale.setScalar(0.65);
  p.root.position.set(x, 0, z);
  return p;
});
const football = ball(0.11, 0xffffff, 10, 0.08, 24, fbG);
const fb = { from: 0, to: 1, t: 0, dur: 1.2 };

// Bé xây lâu đài cát (ban ngày)
const sandG = dayGroup();
for (const [dx, dz, h] of [[0, 0, 0.45], [0.35, 0.1, 0.3], [-0.3, 0.15, 0.32], [0.05, -0.32, 0.28]]) {
  cyl(0.13, 0.17, h, 0xe0c38c, 4 + dx, h / 2, 37 + dz, sandG);
  add(new THREE.ConeGeometry(0.15, 0.18, 8), 0xd7b77a, 4 + dx, h + 0.09, 37 + dz, sandG);
}
cyl(0.1, 0.08, 0.16, 0xff5252, 3.2, 0.08, 37.6, sandG); // xô nhựa
const builder = beachPerson({ female: true }, sandG);
builder.root.scale.setScalar(0.6);
setSeated(builder, true);
builder.cup.visible = false;
builder.body.position.y = SEAT_DROP - 0.26; // ngồi bệt trên cát
builder.root.position.set(4, 0, 37.9);
builder.root.rotation.y = Math.PI;

// Tắm nắng dưới dù (ban ngày)
const sunG = dayGroup();
for (const [x, z, c] of [[-6, 22, 0xe53935], [-2, 25, 0x1e88e5], [22, 21, 0xfdd835]]) {
  cyl(0.03, 0.03, 2.4, 0xeeeeee, x, 1.2, z, sunG);
  add(new THREE.ConeGeometry(1.4, 0.5, 10), c, x, 2.4, z, sunG);
  box(0.7, 0.02, 1.9, pick([0xffffff, 0x80deea, 0xf48fb1]), x + 0.7, 0.01, z + 0.3, sunG); // khăn
  const lay = beachPerson({}, sunG);
  lay.root.rotation.x = -Math.PI / 2;
  lay.root.position.set(x + 0.7, 0.18, z + 1.2);
}

// Thả diều (ban ngày)
const kiteG = dayGroup();
const flyer = beachPerson({ female: false }, kiteG);
flyer.root.position.set(26, 0, 34);
flyer.arms[1].rotation.x = -2.4;
const kite = add(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ color: 0xff3d00, side: THREE.DoubleSide }), 0, 0, 0, kiteG);
kite.rotation.z = Math.PI / 4;
const kiteLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
kiteG.add(new THREE.Line(kiteLineGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));

// Người tắm biển (ban ngày): đầu nhô khỏi mặt nước, vài người ôm phao
const swimG = dayGroup();
const swimmers = [];
for (let i = 0; i < 12; i++) {
  const g = new THREE.Group();
  g.position.set(-40 + beachRnd() * 80, 0, SEA_Z + 2 + beachRnd() * 9);
  ball(0.15, BEACH_SKINS[i % 4], 0, 0.1, 0, g);
  add(new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x1b1b1b, 0, 0.12, 0, g);
  if (i % 3 === 0) add(new THREE.TorusGeometry(0.35, 0.1, 8, 16), pick([0xff4081, 0xffeb3b, 0x00e5ff]), 0, 0, 0, g).rotation.x = Math.PI / 2;
  g.userData.phase = beachRnd() * 6;
  swimG.add(g);
  swimmers.push(g);
}

// Các cặp ngồi trên cát ngắm biển đêm
const coupleG = nightGroup();
for (const [x, z] of [[-10, 38], [8, 40], [30, 36], [-30, 39]]) {
  for (const dx of [-0.3, 0.3]) {
    const p = beachPerson({ female: dx > 0 }, coupleG);
    setSeated(p, true);
    p.cup.visible = false;
    p.body.position.y = SEAT_DROP - 0.26;
    p.root.position.set(x + dx, 0, z);
  }
}

function updateBeach(dt, t) {
  for (const w of strollers) {
    w.x += w.dir * w.speed * dt;
    if (w.x > 75) w.x = -75;
    if (w.x < -75) w.x = 75;
    w.phase += dt * w.speed * 3.2;
    w.p.root.position.set(w.x, w.jog ? Math.abs(Math.sin(w.phase)) * 0.06 : 0, w.z);
    w.p.root.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    walkPose(w.p, w.phase, w.jog ? 0.9 : 0.45);
  }
  photographer.head.rotation.y = Math.sin(t * 0.3) * 0.3;
  if (!vbG.visible) return; // ban đêm: các trò chơi ban ngày nghỉ

  // Bóng chuyền: bóng bay vòng cung qua lưới, người đỡ bóng giơ tay
  vb.t += dt;
  const k = Math.min(1, vb.t / vb.dur), A = vbPlayers[vb.from].root.position, Bp = vbPlayers[vb.to].root.position;
  vbBall.position.set(A.x + (Bp.x - A.x) * k, 2.1 + Math.sin(k * Math.PI) * 4, A.z + (Bp.z - A.z) * k);
  vbPlayers.forEach((p, i) => {
    const up = (i === vb.to && k > 0.65) || (i === vb.from && k < 0.2);
    p.arms.forEach((a) => (a.rotation.x += ((up ? -2.9 : -0.5) - a.rotation.x) * Math.min(1, dt * 12)));
    // người nhận bóng xê dịch đón bóng, người khác về vị trí
    const tz = i === vb.to ? p.home.z + Math.sin(vb.from * 3) * 0.8 : p.home.z;
    p.root.position.z += (tz - p.root.position.z) * Math.min(1, dt * 2);
    p.body.position.y = up ? Math.abs(Math.sin(t * 9)) * 0.15 : 0;
  });
  if (k >= 1) {
    vb.from = vb.to;
    const other = vbPlayers.map((p, i) => i).filter((i) => vbPlayers[i].side !== vbPlayers[vb.from].side);
    vb.to = other[Math.floor(Math.random() * other.length)];
    vb.t = 0;
    vb.dur = 1.3 + Math.random() * 0.5;
  }

  // Đá bóng: bóng lăn từ đứa này sang đứa kia, đứa nhận co chân sút
  fb.t += dt;
  const kf = Math.min(1, fb.t / fb.dur), F = kids[fb.from].root.position, T = kids[fb.to].root.position;
  football.position.set(F.x + (T.x - F.x) * kf, 0.08, F.z + (T.z - F.z) * kf);
  football.rotation.x += dt * 8;
  kids.forEach((p, i) => {
    p.root.rotation.y = Math.atan2(football.position.x - p.root.position.x, football.position.z - p.root.position.z);
    p.legs[1].rotation.x = i === fb.to && kf > 0.85 ? -1.1 : i === fb.from && kf < 0.15 ? 0.6 : 0;
    p.arms.forEach((a, j) => (a.rotation.x = Math.sin(t * 4 + j * Math.PI) * 0.3));
  });
  if (kf >= 1) {
    fb.from = fb.to;
    fb.to = (fb.from + 1 + Math.floor(Math.random() * 2)) % 3;
    fb.t = 0;
  }

  // Xây lâu đài: tay đào cát
  builder.arms.forEach((a, i) => (a.rotation.x = -1 + Math.sin(t * 5 + i * 1.5) * 0.4));

  // Diều bay lượn, dây diều nối tay người thả
  kite.position.set(31 + Math.sin(t * 0.7) * 3, 17 + Math.sin(t * 1.1) * 1.5, 62 + Math.cos(t * 0.5) * 2);
  kite.rotation.y = Math.sin(t * 0.9) * 0.4;
  const hand = new THREE.Vector3();
  flyer.arms[1].localToWorld(hand.set(0, -0.5, 0));
  kiteLineGeo.attributes.position.setXYZ(0, hand.x, hand.y, hand.z);
  kiteLineGeo.attributes.position.setXYZ(1, kite.position.x, kite.position.y, kite.position.z);
  kiteLineGeo.attributes.position.needsUpdate = true;

  // Người tắm biển dập dềnh theo sóng
  for (const g of swimmers) g.position.y = Math.sin(t * 1.3 + g.userData.phase) * 0.12 - 0.02;
}

// ================= Trò chơi trên biển (ban ngày) =================
// Mọi thứ nổi dập dềnh theo đúng công thức sóng của mặt biển.
function seaY(x, z, t) {
  const amp = 0.12 + Math.min(1, Math.max(0, (z - SEA_Z) / 80)) * 0.35;
  return Math.sin(x * 0.05 + t * 0.9) * amp * 0.6 + Math.sin(z * 0.11 - t * 1.4) * amp - 0.05;
}
// Chạy vòng elip trên biển; trả vị trí và hướng mặt (0 = nhìn về +z)
function loopPos(L, t) {
  const a = L.phase + t * L.w;
  return {
    x: L.cx + L.rx * Math.cos(a), z: L.cz + L.rz * Math.sin(a),
    yaw: Math.atan2(-L.rx * Math.sin(a) * L.w, L.rz * Math.cos(a) * L.w),
  };
}
function float(obj, x, z, yaw, t, lift = 0, tilt = 0) {
  obj.position.set(x, seaY(x, z, t) + lift, z);
  obj.rotation.set(-tilt, yaw, Math.sin(t * 2 + x) * 0.05, 'YXZ');
}
const seaG = dayGroup();
const surfG = new THREE.Group(); // lướt sóng / ván buồm / ván diều: chỉ mùa sóng đẹp
seaG.add(surfG);
const seaLinePts = []; // các đoạn dây (dù kéo, phao chuối, diều...) vẽ chung một LineSegments
const seaLineBuf = new THREE.BufferAttribute(new Float32Array(32 * 6), 3); // cấp một lần, dùng lại mỗi khung hình
seaLineBuf.setUsage(THREE.DynamicDrawUsage);
const seaLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', seaLineBuf), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
seaLines.frustumCulled = false;
seaG.add(seaLines);
const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
function wake(parent, len = 4, w = 0.9) {
  const m = add(new THREE.PlaneGeometry(w, len), wakeMat, 0, 0.08, -len / 2 - 0.6, parent);
  m.rotation.x = -Math.PI / 2;
  return m;
}
function seated(o, parent, x, y, z) {
  const p = beachPerson(o, parent);
  setSeated(p, true);
  p.cup.visible = false;
  p.body.position.y = SEAT_DROP;
  p.root.position.set(x, y, z);
  return p;
}
function standing(o, parent, y) {
  const p = beachPerson(o, parent);
  p.root.position.y = y;
  p.legs.forEach((l) => (l.rotation.x = -0.25));
  p.knees.forEach((k) => (k.rotation.x = 0.45));
  p.body.position.y = -0.08;
  return p;
}
function makeBoat(color) {
  const g = new THREE.Group();
  box(1.5, 0.6, 4, color, 0, 0.3, 0, g);
  add(new THREE.ConeGeometry(1.06, 1.4, 4), color, 0, 0.3, 2.7, g).rotation.set(Math.PI / 2, Math.PI / 4, 0, 'YXZ');
  box(1.3, 0.5, 1.2, 0xffffff, 0, 0.85, -0.4, g);
  box(1.2, 0.4, 0.05, new THREE.MeshStandardMaterial({ color: 0x90caf9, transparent: true, opacity: 0.6 }), 0, 1.0, 0.25, g);
  box(0.4, 0.6, 0.4, 0x263238, 0, 0.5, -2.15, g); // động cơ
  seated({ shirt: 0xffffff }, g, 0, 0.2, -0.9);
  wake(g, 6, 1.4);
  return g;
}
function makeJetski(color, withRider = true) {
  const g = new THREE.Group();
  box(0.75, 0.4, 2, color, 0, 0.2, 0, g);
  add(new THREE.ConeGeometry(0.53, 0.7, 4), color, 0, 0.2, 1.35, g).rotation.set(Math.PI / 2, Math.PI / 4, 0, 'YXZ');
  box(0.45, 0.2, 0.9, 0x212121, 0, 0.5, -0.3, g);
  box(0.6, 0.05, 0.05, 0x212121, 0, 0.75, 0.45, g);
  if (withRider) {
    const r = seated({ shirt: pick([0xff1744, 0x2979ff, 0xffea00]) }, g, 0, 0.18, -0.3);
    r.arms.forEach((a) => (a.rotation.x = -1.3));
    add(new THREE.BoxGeometry(0.46, 0.3, 0.38), 0xff6d00, 0, PERSON_HIP + 0.2, 0, r.body); // áo phao
  }
  wake(g, 3.5, 0.8);
  return g;
}

// --- Mô tô nước: 3 chiếc chạy vòng tốc độ cao ---
const jetskis = [[0xff1744, 20, 62, 16, 7, 0.55], [0x00b0ff, -25, 58, 12, 6, -0.6], [0xffd600, 2, 70, 22, 8, 0.45]].map(([c, cx, cz, rx, rz, w], i) => {
  const g = makeJetski(c);
  seaG.add(g);
  return { g, L: { cx, cz, rx, rz, w, phase: i * 2 } };
});

// --- Dù kéo: cano chạy vòng lớn, kéo người bay dưới dù ---
const paraBoat = makeBoat(0xd50000);
seaG.add(paraBoat);
const paraL = { cx: 0, cz: 120, rx: 90, rz: 30, w: 0.05, phase: 0 };
const canopyTex = canvasTexture(256, 32, (g, w, h) => {
  ['#ff1744', '#ffea00', '#2979ff', '#ffffff', '#00e676', '#ff9100'].forEach((c, i, a) => {
    g.fillStyle = c;
    g.fillRect((i * w) / a.length, 0, w / a.length + 1, h);
  });
});
const canopy = add(new THREE.SphereGeometry(4, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshBasicMaterial({ map: canopyTex, side: THREE.DoubleSide }), 0, 0, 0, seaG);
canopy.scale.y = 0.6;
const flyer2 = beachPerson({ shirt: 0xff6d00 }, seaG);
flyer2.arms.forEach((a) => (a.rotation.x = -2.8));

// --- Cano kéo phao chuối: 5 người ngồi trên phao vàng ---
const bananaBoat = makeBoat(0x2962ff);
seaG.add(bananaBoat);
const bananaL = { cx: -10, cz: 80, rx: 45, rz: 12, w: -0.09, phase: 1 };
const banana = new THREE.Group();
seaG.add(banana);
add(new THREE.CapsuleGeometry(0.42, 4, 6, 12), 0xffeb3b, 0, 0.3, 0, banana).rotation.x = Math.PI / 2;
for (const sx of [-0.6, 0.6]) add(new THREE.CapsuleGeometry(0.2, 3, 4, 8), 0xffc107, sx, 0.15, 0, banana).rotation.x = Math.PI / 2;
const bananaRiders = [-1.6, -0.8, 0, 0.8, 1.6].map((z) => {
  const r = seated({}, banana, 0, 0.32, z);
  r.arms.forEach((a) => (a.rotation.x = -0.9));
  return r;
});
const bananaPos = new THREE.Vector3(-10, 0, 70);

// --- Flyboard: người bay lên nhờ cột nước phun ---
const FLY = { x: -45, z: 64 };
const flyRig = new THREE.Group();
seaG.add(flyRig);
box(0.7, 0.08, 0.35, 0x212121, 0, 0, 0, flyRig);
const flyMan = standing({ shirt: 0x00e676 }, flyRig, 0.04);
flyMan.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 1.1));
const jetMat = new THREE.MeshBasicMaterial({ color: 0xe1f5fe, transparent: true, opacity: 0.7 });
const flyJets = [-0.2, 0.2].map((x) => cyl(0.12, 0.35, 1, jetMat, x, -0.5, 0, flyRig));
const flySki = makeJetski(0x000000, true);
seaG.add(flySki);

// --- Ván lướt phản lực: đứng trên ván có động cơ, lượn nhanh ---
const jetBoard = new THREE.Group();
seaG.add(jetBoard);
box(0.55, 0.12, 1.9, 0xff3d00, 0, 0.06, 0, jetBoard);
const jetBoarder = standing({ shirt: 0x212121 }, jetBoard, 0.12);
jetBoarder.arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * 0.9));
wake(jetBoard, 3, 0.6);
const jetBoardL = { cx: 35, cz: 56, rx: 14, rz: 5, w: 0.7, phase: 0 };

// --- SUP và kayak gần bờ, đi chậm ---
const sups = [[-15, 51, 0xffffff], [12, 53, 0x4fc3f7]].map(([x, z, c], i) => {
  const g = new THREE.Group();
  seaG.add(g);
  box(0.75, 0.12, 3.2, c, 0, 0.06, 0, g);
  const p = standing({ female: i === 1 }, g, 0.12);
  cyl(0.025, 0.025, 1.9, 0x5d4037, 0, -0.6, 0.05, p.arms[1]); // mái chèo
  return { g, p, x, z, dir: i ? -1 : 1 };
});
const kayaks = [[-30, 54, 0xff6d00], [26, 50, 0xffd600]].map(([x, z, c], i) => {
  const g = new THREE.Group();
  seaG.add(g);
  const hull = ball(0.5, c, 0, 0.12, 0, g);
  hull.scale.set(0.8, 0.45, 4.4);
  const p = seated({}, g, 0, -0.05, -0.1);
  const paddle = new THREE.Group();
  paddle.position.set(0, 1.0, 0.35);
  p.root.add(paddle);
  cyl(0.025, 0.025, 2.4, 0x424242, 0, 0, 0, paddle).rotation.z = Math.PI / 2;
  for (const sx of [-1.2, 1.2]) box(0.05, 0.35, 0.18, c, sx, 0, 0, paddle);
  p.arms.forEach((a) => (a.rotation.x = -1.3));
  return { g, paddle, x, z, dir: i ? 1 : -1 };
});

// --- Thuyền lặn / đi bộ dưới đáy biển: thuyền neo, cờ lặn, bọt khí ---
const diveBoat = makeBoat(0xffffff);
seaG.add(diveBoat);
const DIVE = { x: 55, z: 78 };
const diveFlag = canvasTexture(64, 64, (g) => {
  g.fillStyle = '#d50000';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#fff';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.stroke();
});
cyl(0.03, 0.03, 2.2, 0xbdbdbd, 0.5, 1.7, -1.6, diveBoat);
add(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: diveFlag, side: THREE.DoubleSide }), 0.9, 2.4, -1.6, diveBoat).rotation.y = Math.PI / 2;
textPlane(diveBoat, 'SEA TREK · LẶN BIỂN', 1.8, 0.3, 0.77, 0.4, 0, Math.PI / 2, { bg: '#0277bd', font: 'bold 44px sans-serif' });
const bubbles = Array.from({ length: 24 }, () => {
  const b = ball(0.06 + Math.random() * 0.06, new THREE.MeshBasicMaterial({ color: 0xe1f5fe, transparent: true, opacity: 0.8 }), 0, 0, 0, seaG);
  b.userData = { dx: (Math.random() - 0.5) * 8, dz: 3 + Math.random() * 6, phase: Math.random() * 3 };
  return b;
});

// --- Mùa sóng đẹp: lướt sóng, lướt ván buồm, lướt ván diều ---
const surfers = [-8, 6, 18].map((x, i) => {
  const g = new THREE.Group();
  surfG.add(g);
  box(0.5, 0.08, 2, [0xffffff, 0x76ff03, 0xff4081][i], 0, 0.04, 0, g);
  const p = standing({}, g, 0.08);
  p.root.rotation.y = Math.PI / 2; // đứng ngang ván
  p.arms.forEach((a, k) => (a.rotation.z = (k ? -1 : 1) * 1.2));
  return { g, x, z: 66 - i * 6, speed: 3.5 + i * 0.5 };
});
const windsurf = new THREE.Group();
surfG.add(windsurf);
box(0.6, 0.1, 2.6, 0xffffff, 0, 0.05, 0, windsurf);
cyl(0.03, 0.03, 4.2, 0xeeeeee, 0, 2.1, 0.3, windsurf);
{
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.3);
  sh.lineTo(0, 4.2);
  sh.lineTo(-2.2, 0.5);
  sh.lineTo(0, 0.3);
  const sail = add(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xff1744, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, 0, 0.3, windsurf);
  sail.rotation.y = Math.PI / 2;
}
standing({ shirt: 0x212121 }, windsurf, 0.1).root.position.z = -0.4;
const windsurfL = { cx: -20, cz: 88, rx: 40, rz: 4, w: 0.08, phase: 0 };
const kiteBoard = new THREE.Group();
surfG.add(kiteBoard);
box(0.45, 0.08, 1.4, 0x00e5ff, 0, 0.04, 0, kiteBoard);
const kiter = standing({ shirt: 0xffea00 }, kiteBoard, 0.08);
kiter.body.rotation.x = -0.3;
kiter.arms.forEach((a) => (a.rotation.x = -1.4));
const surfKite = add(new THREE.SphereGeometry(3, 14, 4, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshBasicMaterial({ color: 0x00c853, side: THREE.DoubleSide }), 0, 0, 0, surfG);
surfKite.scale.set(1, 0.35, 0.5);
const kiteBoardL = { cx: 30, cz: 92, rx: 35, rz: 3, w: -0.12, phase: 2 };

// --- Ki-ốt cho thuê đồ chơi biển trên bãi ---
{
  const K = new THREE.Group();
  K.position.set(-34, 0, 34);
  seaG.add(K);
  for (const [x, z] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) cyl(0.04, 0.04, 2.4, 0xeeeeee, x, 1.2, z, K);
  box(2.8, 0.1, 2.4, 0x0288d1, 0, 2.45, 0, K);
  box(2, 0.9, 0.6, 0xffffff, 0, 0.45, 0.7, K);
  const board = canvasTexture(512, 600, (g, w, h) => {
    g.fillStyle = '#01579b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffeb3b';
    g.textAlign = 'center';
    fitFont(g, 'CHO THUÊ ĐỒ CHƠI BIỂN', 'bold 44px sans-serif', w - 40);
    g.fillText('CHO THUÊ ĐỒ CHƠI BIỂN', w / 2, 60);
    const rows = [['Mô tô nước 15–30 phút', '500k–1,1tr'], ['Dù kéo / lượt', '500k–800k'], ['Phao chuối (3–5 người)', '950k–1tr'],
      ['Flyboard', 'liên hệ'], ['Ván lướt phản lực', 'liên hệ'], ['SUP · Kayak / giờ', '200k–300k'], ['Đi bộ đáy biển / người', '950k'],
      ['Lướt sóng · ván buồm · ván diều', 'T3–5 · T8–10']];
    g.font = 'bold 26px sans-serif';
    rows.forEach(([a, b], i) => {
      const y = 130 + i * 58;
      g.textAlign = 'left';
      g.fillStyle = '#fff';
      fitFont(g, a, 'bold 26px sans-serif', 300);
      g.fillText(a, 28, y);
      g.textAlign = 'right';
      g.fillStyle = '#ffeb3b';
      fitFont(g, b, 'bold 26px sans-serif', 150);
      g.fillText(b, w - 28, y);
    });
  });
  const b = add(new THREE.PlaneGeometry(1.7, 2), new THREE.MeshBasicMaterial({ map: board, side: THREE.DoubleSide }), 0, 1.5, -1.05, K);
  b.rotation.y = Math.PI; // quay về phía quán
  const staff = beachPerson({ shirt: 0x0288d1 }, K);
  staff.root.position.set(0, 0, 1.4);
  staff.root.rotation.y = Math.PI;
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function pushLine(a, b) { seaLinePts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
function updateSea(dt, t) {
  seaLinePts.length = 0;
  for (const j of jetskis) {
    const p = loopPos(j.L, t);
    float(j.g, p.x, p.z, p.yaw, t, 0.05, 0.12);
  }
  // Dù kéo: dù bay sau và trên cano, người treo dưới dù
  const pb = loopPos(paraL, t);
  float(paraBoat, pb.x, pb.z, pb.yaw, t, 0, 0.1);
  const back = { x: -Math.sin(pb.yaw), z: -Math.cos(pb.yaw) };
  const hx = pb.x + back.x * 38, hz = pb.z + back.z * 38, hy = 32 + Math.sin(t * 0.5) * 2;
  flyer2.root.position.set(hx, hy - 1.7, hz);
  flyer2.root.rotation.y = pb.yaw;
  flyer2.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 1.5 + i) * 0.3));
  canopy.position.set(hx + back.x * 1.5, hy + 5, hz + back.z * 1.5);
  canopy.rotation.set(-0.35, pb.yaw, 0, 'YXZ');
  tmpA.set(hx, hy, hz);
  for (const [cx, cz] of [[-3, 0], [3, 0], [0, -2], [0, 2]]) pushLine(tmpA, tmpB.set(canopy.position.x + cx * Math.cos(pb.yaw), canopy.position.y, canopy.position.z - cx * Math.sin(pb.yaw) + cz * 0.2));
  pushLine(tmpA, tmpB.set(pb.x + back.x * 2.2, paraBoat.position.y + 1, pb.z + back.z * 2.2));
  // Phao chuối bám theo đuôi cano, lắc lư
  const bb = loopPos(bananaL, t);
  float(bananaBoat, bb.x, bb.z, bb.yaw, t, 0, 0.1);
  bananaPos.lerp(tmpA.set(bb.x - Math.sin(bb.yaw) * 10, 0, bb.z - Math.cos(bb.yaw) * 10), Math.min(1, dt * 1.5));
  const byaw = Math.atan2(bb.x - bananaPos.x, bb.z - bananaPos.z);
  float(banana, bananaPos.x, bananaPos.z, byaw, t, 0.05 + Math.abs(Math.sin(t * 3)) * 0.15);
  banana.rotation.z = Math.sin(t * 2.3) * 0.18;
  bananaRiders.forEach((r, i) => (r.arms[0].rotation.x = -0.9 + Math.sin(t * 5 + i) * (i % 2 ? 0.3 : 1.2))); // vài người giơ tay hò hét
  pushLine(tmpA.set(bananaPos.x, banana.position.y + 0.4, bananaPos.z), tmpB.set(bb.x - Math.sin(bb.yaw) * 2.2, bananaBoat.position.y + 0.5, bb.z - Math.cos(bb.yaw) * 2.2));
  // Flyboard: lên xuống, xoay chậm, thỉnh thoảng lộn vòng
  const h = 3.2 + Math.sin(t * 0.7) * 2.2;
  flyRig.position.set(FLY.x, seaY(FLY.x, FLY.z, t) + h, FLY.z);
  const flipK = (t % 14) / 14;
  flyRig.rotation.set(flipK > 0.9 ? (flipK - 0.9) * 10 * Math.PI * 2 : 0, t * 0.5, 0, 'YXZ');
  flyJets.forEach((j) => {
    j.scale.y = h;
    j.position.y = -h / 2;
  });
  float(flySki, FLY.x - 7, FLY.z + 2, 1.2, t);
  pushLine(tmpA.set(FLY.x, seaY(FLY.x, FLY.z, t), FLY.z), tmpB.set(FLY.x - 7, flySki.position.y + 0.3, FLY.z + 2));
  // Ván lướt phản lực
  const jb = loopPos(jetBoardL, t);
  float(jetBoard, jb.x, jb.z, jb.yaw, t, 0.05, 0.15);
  jetBoard.rotation.z = -Math.sign(jetBoardL.w) * 0.35;
  // SUP: chèo chậm dọc bờ
  for (const s of sups) {
    s.x += s.dir * 0.6 * dt;
    if (Math.abs(s.x) > 45) s.dir *= -1;
    float(s.g, s.x, s.z, s.dir > 0 ? Math.PI / 2 : -Math.PI / 2, t);
    s.p.arms[1].rotation.x = -1.2 + Math.sin(t * 1.6) * 0.6;
    s.p.arms[0].rotation.x = -1.5 + Math.sin(t * 1.6) * 0.4;
  }
  for (const k of kayaks) {
    k.x += k.dir * 0.9 * dt;
    if (Math.abs(k.x) > 45) k.dir *= -1;
    float(k.g, k.x, k.z, k.dir > 0 ? Math.PI / 2 : -Math.PI / 2, t, 0.05);
    k.paddle.rotation.z = Math.sin(t * 2.4) * 0.5;
  }
  // Thuyền lặn neo một chỗ, bọt khí nổi lên
  float(diveBoat, DIVE.x, DIVE.z, 0.6, t);
  for (const b of bubbles) {
    const k = (t * 0.6 + b.userData.phase) % 1;
    const x = DIVE.x + b.userData.dx, z = DIVE.z + b.userData.dz;
    b.position.set(x + Math.sin(t * 3 + b.userData.phase) * 0.1, seaY(x, z, t) + 0.05, z);
    b.scale.setScalar(0.3 + k);
    b.material.opacity = 0.8 * (1 - k);
  }
  // Mùa sóng đẹp (giờ Việt Nam): tháng 3–5 và 8–10
  const month = new Date(serverNow() + 7 * 3600000).getUTCMonth() + 1;
  surfG.visible = (month >= 3 && month <= 5) || (month >= 8 && month <= 10);
  if (surfG.visible) {
    for (const s of surfers) {
      s.z -= s.speed * dt;
      if (s.z < SEA_Z + 1) s.z = 72;
      float(s.g, s.x + Math.sin(t * 0.8 + s.speed) * 2, s.z, Math.PI, t, 0.05, -0.15);
    }
    const ws = loopPos(windsurfL, t);
    float(windsurf, ws.x, ws.z, ws.yaw, t, 0.05);
    windsurf.rotation.z = 0.25;
    const ks = loopPos(kiteBoardL, t);
    float(kiteBoard, ks.x, ks.z, ks.yaw, t, 0.05, 0.1);
    surfKite.position.set(ks.x + Math.sin(ks.yaw) * 10, 16 + Math.sin(t) * 1.5, ks.z + Math.cos(ks.yaw) * 10 + 6);
    surfKite.rotation.set(1.2, ks.yaw, 0, 'YXZ');
    kiter.arms[1].localToWorld(tmpA.set(0, -0.5, 0));
    pushLine(tmpA, surfKite.position);
  }
  seaLineBuf.array.set(seaLinePts.slice(0, seaLineBuf.array.length));
  seaLineBuf.needsUpdate = true;
  seaLines.geometry.setDrawRange(0, seaLinePts.length / 3);
}


// Xe chạy ngoài đường
const traffic = [];
for (let i = 0; i < 5; i++) {
  const g = makeMotorbike([0xc62828, 0x1565c0, 0x212121, 0xf9a825, 0x2e7d32][i]);
  const rider = makePerson({ shirt: [0x455a64, 0xff7043, 0x5c6bc0, 0x26a69a, 0x8d6e63][i] });
  setSeated(rider, true);
  rider.cup.visible = false;
  rider.arms.forEach((a) => (a.rotation.x = -1.2));
  rider.root.position.set(-0.2, 0.3, 0);
  rider.root.rotation.y = Math.PI / 2;
  ball(0.33, 0xf5f5f5, 0, 0.06, -0.02, rider.head).scale.set(1, 0.95, 1); // mũ bảo hiểm
  g.add(rider.root);
  const forward = i % 2 === 0;
  g.position.set(-30 + i * 13, 0, forward ? 5.2 : 8.8);
  g.rotation.y = forward ? 0 : Math.PI;
  scene.add(g);
  const base = (forward ? 1 : -1) * (6 + Math.random() * 4);
  traffic.push({ g, base, speed: base });
}

// ================= Cài đặt (lưu trong trình duyệt) =================
const settings = {
  music: 20, ambience: 70, sfx: 80, karaoke: 80, // âm lượng 0–100
  musicPicked: false, // người chơi đã tự chỉnh âm lượng nhạc nền chưa
  bgPlay: false, // phát tiếp khi chuyển tab
  voiceSpk: 'all', // thoại: vào quán là tự nghe kênh Cả quán ('all'), hoặc 'off' nếu người chơi đã chọn Đóng
  quality: 'high', // điện thoại cũng mặc định Đẹp; ai cần pin thì tự chọn Tiết kiệm pin
  qualityPicked: false, // người chơi đã tự chọn chất lượng đồ hoạ chưa
  names: true,
};
try {
  const saved = JSON.parse(localStorage.getItem('nhau-settings')) || {};
  // Bản cũ lưu sẵn 'low' cho điện thoại dù người chơi chưa chọn: bỏ đi để dùng mặc định mới.
  if (!saved.qualityPicked) delete saved.quality;
  // Bản cũ lưu sẵn nhạc nền 50: ai chưa tự chỉnh thì dùng mặc định mới.
  if (!saved.musicPicked) delete saved.music;
  Object.assign(settings, saved);
} catch {}
const saveSettings = () => { try { localStorage.setItem('nhau-settings', JSON.stringify(settings)); } catch {} };

// ================= Âm thanh =================
// Mỗi loại âm thanh một kênh riêng để chỉnh âm lượng: nhạc nền, không gian, hiệu ứng, karaoke.
let audio = null, master = null, muted = false;
const buses = {};
// iPhone: khai báo phiên âm thanh kiểu phát nhạc để nút gạt im lặng không tắt Web Audio (Safari 16.4+).
if (navigator.audioSession) navigator.audioSession.type = 'playback';
function ac() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.connect(audio.destination);
    for (const k of ['music', 'ambience', 'sfx', 'karaoke']) {
      buses[k] = audio.createGain();
      buses[k].connect(master);
    }
    applyVolumes();
  }
  return audio;
}
const out = (bus = 'sfx') => (ac(), buses[bus]);
// Karaoke chỉ vang trên tầng có sân khấu (sân thượng): ai ở tầng đó cũng nghe đủ, tầng khác không nghe.
// Karaoke trên sân thượng: tầng sân khấu nghe rõ nhất, xuống mỗi tầng nhỏ dần.
const KARAOKE_FLOOR_LEVEL = { 2: 1, 1: 0.4, 0: 0.15 };
// Ra biển: qua khỏi vỉa hè thì karaoke nhỏ dần, tới bãi biển (tường kè) thì tắt hẳn, nhường lại nhạc nền.
const beachAway = () => (meA?.f === 0 ? THREE.MathUtils.clamp((meA.z - SHORE.curbZ) / (SHORE.wallZ - SHORE.curbZ), 0, 1) : 0);
// Ra khỏi quán (bước xuống lòng đường): 0 khi còn ở vỉa hè/trong quán, lên 1 sau khoảng 1,5 m.
const leftQuan = () => (meA?.f === 0 ? THREE.MathUtils.clamp((meA.z - SHORE.curbZ) / 1.5, 0, 1) : 0);
const karaokeLevel = () => (mic.singer && meA ? (KARAOKE_FLOOR_LEVEL[meA.f] ?? 0) * (1 - beachAway()) : 0);
function applyVolumes() {
  if (!audio) return;
  const t = audio.currentTime;
  buses.ambience.gain.setTargetAtTime(settings.ambience / 100, t, 0.05);
  buses.sfx.gain.setTargetAtTime(settings.sfx / 100, t, 0.05);
  buses.karaoke.gain.setTargetAtTime((settings.karaoke / 100) * karaokeLevel(), t, 0.3);
  // Trong quán có người hát thì nhạc nền tắt; bước ra khỏi quán là nhạc nền phát lại.
  const bgm = mic.singer ? leftQuan() : 1;
  buses.music.gain.setTargetAtTime((settings.music / 100) * 0.9 * bgm, t, bgm < 1 ? 0.6 : 1.2);
}

// ---------- Nhạc nền quán: tự chơi bằng Web Audio, không dùng bài có bản quyền ----------
// Vòng hợp âm buồn kiểu bolero (Am Dm G C F Dm E Am), guitar rải, bass, pad, shaker và giai điệu ngũ cung.
const BGM = { on: false, nextT: 0, step: 0, timer: null, seed: 12345 };
const BGM_EIGHTH = 60 / 76 / 2;
const BGM_PROG = [[57, 60, 64], [62, 65, 69], [55, 59, 62], [60, 64, 67], [53, 57, 60], [62, 65, 69], [52, 56, 59], [57, 60, 64]];
const BGM_MELODY = [64, 67, 69, 72, 74, 76, 79, 81];
const bgmRnd = () => (BGM.seed = (BGM.seed * 16807) % 2147483647) / 2147483647;
function bgmTone(midi, t, dur, type, vol, attack = 0.01) {
  const a = audio, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(buses.music);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function bgmShaker(t) {
  const a = audio, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = BGM.noise || (BGM.noise = noiseBuffer(0.08, false));
  f.type = 'highpass';
  f.frequency.value = 6000;
  g.gain.value = 0.035;
  src.connect(f).connect(g).connect(buses.music);
  src.start(t);
}
function scheduleBgm() {
  const a = audio;
  while (BGM.nextT < a.currentTime + 0.6) {
    const s = BGM.step, beat = s % 8, bar = Math.floor(s / 8), chord = BGM_PROG[bar % BGM_PROG.length], t = BGM.nextT;
    if (beat === 0) {
      bgmTone(chord[0] - 12, t, BGM_EIGHTH * 3.8, 'triangle', 0.16); // bass
      for (const n of chord) bgmTone(n, t, BGM_EIGHTH * 8, 'sine', 0.025, 0.4); // pad
    }
    if (beat === 4) bgmTone(chord[2] - 24, t, BGM_EIGHTH * 3.8, 'triangle', 0.12);
    // guitar rải hợp âm
    const n = chord[[0, 1, 2, 1, 2, 1, 2, 1][beat]] + (beat === 3 || beat === 7 ? 12 : 0);
    bgmTone(n, t, 0.7, 'triangle', 0.05, 0.004);
    if (beat % 2 === 1) bgmShaker(t);
    // giai điệu: hát ở các ô nhịp lẻ, nghỉ ở ô chẵn cho đỡ ồn
    if (bar % 2 === 1 && beat % 2 === 0 && bgmRnd() < 0.7) {
      const near = BGM_MELODY.filter((m) => chord.some((c) => (m - c) % 12 === 0));
      const note = bgmRnd() < 0.6 && near.length ? near[Math.floor(bgmRnd() * near.length)] : BGM_MELODY[Math.floor(bgmRnd() * BGM_MELODY.length)];
      bgmTone(note, t, BGM_EIGHTH * (bgmRnd() < 0.3 ? 4 : 2), 'sine', 0.045, 0.03);
    }
    BGM.nextT += BGM_EIGHTH;
    BGM.step++;
  }
}
// Nhạc nền chính: beat "Ông Trời Làm Tội Anh Chưa" (đã mua bản quyền). Bản gốc dài 2 tiếng 44 phút là một
// vòng beat 338,2132 giây lặp lại, nên chỉ lưu một vòng (5,6 MB) và tự lặp: file có 0,5 giây đệm đầu và 3 giây
// đuôi; chạy tới hết vòng thì lùi đúng một vòng (hai chỗ nghe giống hệt nhau nên không thấy chỗ nối).
// Phát qua thẻ <audio> (nhẹ bộ nhớ hơn giải mã cả bài) nối vào kênh nhạc nền, nên to nhỏ, tắt khi có người hát
// và nút tắt tiếng vẫn như cũ. Không tải được file thì quay về nhạc tự chơi bằng Web Audio ở dưới.
const BGM_FILE = { src: '/music/ong-troi-lam-toi-anh-chua-beat.m4a', start: 0.5, loop: 338.2132 };
let bgmEl = null;
function startBgm() {
  if (bgmEl || BGM.on) return;
  const a = ac();
  bgmEl = new Audio(BGM_FILE.src);
  bgmEl.preload = 'auto';
  bgmEl.currentTime = BGM_FILE.start;
  a.createMediaElementSource(bgmEl).connect(buses.music);
  bgmEl.addEventListener('error', () => { bgmEl = null; startBgmSynth(); }, { once: true });
  bgmEl.play().catch(() => {}); // điện thoại chặn tự phát thì lần chạm sau bật lại (xem dưới)
  setInterval(() => {
    if (bgmEl && bgmEl.currentTime >= BGM_FILE.start + BGM_FILE.loop) bgmEl.currentTime -= BGM_FILE.loop;
  }, 100);
}
function startBgmSynth() {
  if (BGM.on) return;
  ac();
  BGM.on = true;
  BGM.nextT = audio.currentTime + 0.2;
  BGM.timer = setInterval(scheduleBgm, 100);
}

// Chuyển tab: nếu không bật "phát tiếp" thì tạm dừng mọi âm thanh như web chùa.
document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden && !settings.bgPlay) audio.suspend();
  // Quay lại tab: chờ âm thanh chạy lại rồi mới khớp giờ, tránh phát lại đoạn cũ trước khi nhảy.
  else if (!document.hidden) audio.resume().then(syncVideo);
  syncVideo();
});
// Điện thoại chỉ cho bật âm thanh trong lúc người dùng chạm: khoá màn hình/chuyển app quay lại mà âm thanh
// còn dừng ("suspended" / iOS "interrupted") thì lần chạm kế tiếp bật lại.
for (const ev of ['pointerdown', 'touchend', 'keydown']) {
  addEventListener(ev, () => {
    // Điện thoại chặn tự phát: lần chạm đầu tiên bật nhạc nền
    if (bgmEl?.paused && !(document.hidden && !settings.bgPlay)) bgmEl.play().catch(() => {});
    if (audio && audio.state !== 'running' && !(document.hidden && !settings.bgPlay)) audio.resume();
  }, { passive: true });
}
function noiseBuffer(sec, brown) {
  const a = ac(), len = a.sampleRate * sec, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w * (1 - i / len);
  }
  return buf;
}
function clinkSound(vol = 1) {
  const a = ac();
  [2400, 3100, 3900].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = f + Math.random() * 80;
    g.gain.setValueAtTime((0.15 / (i + 1)) * vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8);
    o.connect(g).connect(out());
    o.start();
    o.stop(a.currentTime + 0.8);
  });
}
function noiseHit(sec, freq, vol, type = 'bandpass', when = 0) {
  const a = ac(), src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuffer(sec, false);
  f.type = type;
  f.frequency.value = freq;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(out());
  src.start(a.currentTime + when);
  return src;
}
const pourSound = () => noiseHit(0.8, 900, 0.25);

// Tiếng hô "2, 3… dô! 2, 3… uống!" (file thu sẵn). Hết tiếng mới nâng ly uống.
// end: giây cuối còn tiếng (bỏ khoảng lặng ở đuôi file), tính khi giải mã xong.
const DZO = { buf: null, end: 0, loading: null };
function loadDzo() {
  DZO.loading ??= fetch('/music/ho-dzo.mp3')
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? ac().decodeAudioData(b) : null))
    .then((buf) => {
      if (!buf) return;
      const d = buf.getChannelData(0);
      let i = d.length - 1;
      while (i > 0 && Math.abs(d[i]) < 0.02) i--;
      DZO.buf = buf;
      DZO.end = Math.min(buf.duration, i / buf.sampleRate + 0.1);
    })
    .catch(() => {});
  return DZO.loading;
}
// Thời gian chờ trước khi uống; file chưa tải xong thì chỉ cụng ly rồi uống luôn.
const dzoWait = () => (DZO.buf ? DZO.end : 0.5);
function dzoCallSound(vol = 1) {
  if (!DZO.buf) {
    loadDzo();
    clinkSound(vol);
    return;
  }
  const a = ac(), src = a.createBufferSource(), g = a.createGain();
  src.buffer = DZO.buf;
  g.gain.value = vol;
  src.connect(g).connect(out());
  src.start(a.currentTime, 0, DZO.end);
}
// Bong bóng trên đầu người hô, chia đôi theo hai câu hô.
function dzoCount(a) {
  const w = dzoWait() * 1000;
  speak(a, '🗣️ 2, 3… dô!', w / 2 + 100);
  setTimeout(() => speak(a, '🗣️ 2, 3… uống!', w / 2 + 100), w / 2);
}
// Người khác dzô: hô xong mới nâng ly.
function cheersLater(a) {
  setTimeout(() => playAct(a, 'cheers'), dzoWait() * 1000);
}
function dingSound() {
  const a = ac();
  [1320, 990].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + i * 0.18;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(g).connect(out());
    o.start(t0);
    o.stop(t0 + 0.6);
  });
}
function clapSound() {
  for (let i = 0; i < 5; i++) noiseHit(0.08, 1500, 0.3, 'bandpass', i * 0.18 + Math.random() * 0.03);
}
function startAmbience() {
  const a = ac(), src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuffer(3, true);
  src.loop = true;
  f.type = 'lowpass';
  f.frequency.value = 500;
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(out('ambience'));
  src.start();
  // Tiếng sóng biển: tiếng ồn trầm, to nhỏ theo nhịp sóng vỗ
  const wave = a.createBufferSource(), wf = a.createBiquadFilter(), wg = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
  wave.buffer = noiseBuffer(4, true);
  wave.loop = true;
  wf.type = 'lowpass';
  wf.frequency.value = 380;
  wg.gain.value = 0.06;
  lfo.frequency.value = 0.14;
  lg.gain.value = 0.045;
  lfo.connect(lg).connect(wg.gain);
  wave.connect(wf).connect(wg).connect(out('ambience'));
  wave.start();
  lfo.start();
}

// Nhạc karaoke: giai điệu sinh ngẫu nhiên theo "song" seed, ai trong quán cũng nghe cùng một bài.
let songNodes = [];
let songTimer = null;
function stopSong() {
  clearInterval(songTimer);
  songTimer = null;
  songNodes.forEach((n) => { try { n.stop(); } catch {} });
  songNodes = [];
}
function playSong(seed, startAtServer) {
  stopSong();
  const a = ac();
  let s = seed + 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const BEAT = 0.5, BARS = Math.floor(SONG_MS / 1000 / (BEAT * 4));
  const prog = [0, 7, 9, 5]; // I V vi IV
  const penta = [0, 2, 4, 7, 9, 12, 14];
  const offset = (serverNow() - startAtServer) / 1000; // >0 nếu vào muộn
  const t0 = a.currentTime - offset;
  const note = (midi, start, dur, type, vol) => {
    if (start + dur < a.currentTime) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const st = Math.max(start, a.currentTime);
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(vol, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(out('karaoke'));
    o.start(st);
    o.stop(start + dur + 0.05);
    o.onended = () => { const i = songNodes.indexOf(o); if (i >= 0) songNodes.splice(i, 1); };
    songNodes.push(o);
  };
  // Bài dài nên chỉ tạo nốt trước vài giây (mỗi giây lên lịch tiếp). Mỗi ô nhịp có hạt giống riêng
  // để ai vào giữa bài cũng nghe đúng giai điệu như người khác.
  let bar = Math.max(0, Math.floor(offset / (4 * BEAT)));
  const pump = () => {
    for (; bar < BARS && t0 + bar * 4 * BEAT < a.currentTime + 4; bar++) scheduleBar(bar);
    if (bar >= BARS) { clearInterval(songTimer); songTimer = null; }
  };
  const scheduleBar = (bar) => {
    s = seed * 1000 + bar + 7;
    const root = prog[bar % 4], bt = t0 + bar * 4 * BEAT;
    note(43 + root, bt, BEAT * 3.8, 'triangle', 0.12);
    for (let b = 0; b < 4; b++) {
      note(36, bt + b * BEAT, 0.15, 'sine', 0.18); // trống cái
      note(55 + root + 4, bt + b * BEAT + BEAT / 2, 0.2, 'square', 0.02); // đệm
    }
    for (let e = 0; e < 8; e++) {
      if (rnd() < 0.2) continue;
      const len = rnd() < 0.3 ? BEAT : BEAT / 2;
      note(67 + root % 5 + penta[Math.floor(rnd() * penta.length)], bt + (e * BEAT) / 2, len * 0.95, 'sawtooth', 0.035);
    }
  };
  pump();
  songTimer = setInterval(pump, 1000);
}

// ================= TV karaoke (YouTube) =================
// Video được phát đồng bộ theo giờ server: ai vào sau cũng nhảy tới đúng đoạn đang hát.
let ytReady = null;
function loadYT() {
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytReady = null; reject(new Error('Không tải được YouTube')); };
      document.head.appendChild(s);
    });
  }
  return ytReady;
}

const tv = { player: null, ready: false, yt: null, startAt: 0, failed: false, local: false, fallbackTimer: null, stuck: 0, durationSent: "" };

// Bài có file nhạc riêng trong public/music (chủ quán đã mua bản quyền): phát file thay cho video YouTube cùng ID.
// Không tải được file (thiếu file, mất mạng) thì quay về video YouTube. Phát bằng Web Audio để khớp giờ server
// và chỉnh âm lượng theo tầng như các âm thanh khác.
const LOCAL_AUDIO = { t08wq1Dhsho: '/music/det-mong-uyen-uong.m4a' };
const localBuffers = {}; // yt -> Promise<AudioBuffer | null>
function localBuffer(yt) {
  if (!LOCAL_AUDIO[yt]) return Promise.resolve(null);
  localBuffers[yt] ??= fetch(LOCAL_AUDIO[yt])
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? ac().decodeAudioData(b) : null))
    .catch(() => null);
  return localBuffers[yt];
}
// local: { buf, src, gain, at: giờ AudioContext ứng với giây 0 của bài }
const local = { buf: null, src: null, gain: null, at: 0 };
function startLocal(offset) {
  const a = ac();
  local.src?.stop();
  if (!local.gain) { local.gain = a.createGain(); local.gain.connect(master); }
  const src = a.createBufferSource();
  src.buffer = local.buf;
  src.connect(local.gain);
  src.onended = () => {
    // Hết bài thì người hát trả mic cho người tiếp theo.
    if (local.src === src && mic.singer === myId) send({ t: 'mic-leave' });
  };
  // offset < 0: bài chưa tới giờ bắt đầu (server chờ MIC_DELAY_MS) thì hẹn giờ phát.
  const off = Math.min(offset, local.buf.duration);
  src.start(off < 0 ? a.currentTime - off : 0, Math.max(0, off));
  local.src = src;
  local.at = a.currentTime - off;
}
function stopLocal() {
  const src = local.src;
  local.src = null;
  try { src?.stop(); } catch {}
}

async function playVideo(track, startAt) {
  stopSong();
  stopLocal(); // đổi bài: tắt tiếng file của bài trước (nếu bài trước phát từ file)
  clearTimeout(tv.fallbackTimer);
  Object.assign(tv, { yt: track.yt, startAt, failed: false, local: false, retries: 0 });
  drawScreen(track.title, track.by);
  const buf = await localBuffer(track.yt);
  if (tv.yt !== track.yt) return; // đã đổi bài trong lúc tải
  if (buf) {
    // Tiếng phát từ file, màn sân khấu hiện tên bài. Không chạy kèm video YouTube để
    // máy khỏi phải giải mã thêm một video trong lúc phát nhạc.
    try { tv.player?.stopVideo?.(); } catch {}
    tv.local = true;
    local.buf = buf;
    startLocal((serverNow() - startAt) / 1000);
    applyVolumes();
    return;
  }
  let YT;
  try { YT = await loadYT(); } catch { videoFailed(); return; }
  if (tv.yt !== track.yt) return; // đã đổi bài trong lúc tải
  const start = Math.max(0, (serverNow() - startAt) / 1000);
  if (!tv.player) {
    tv.player = new YT.Player(tvPlayerEl, {
      width: '100%', height: '100%', videoId: track.yt,
      playerVars: { autoplay: 1, start: Math.floor(start), playsinline: 1, rel: 0, controls: 0, disablekb: 1, iv_load_policy: 3 },
      events: {
        onReady: () => {
          tv.ready = true;
          // Đổi bài trong lúc player còn khởi tạo thì giờ mới nạp bài mới.
          if (tv.yt && tv.player.getVideoData?.()?.video_id !== tv.yt) {
            tv.player.loadVideoById({ videoId: tv.yt, startSeconds: Math.max(0, (serverNow() - tv.startAt) / 1000) });
          }
          syncVideo();
        },
        onStateChange: (e) => {
          // Video hết thì người hát trả mic cho người tiếp theo (phát từ file thì startLocal lo).
          if (e.data === 0 && mic.singer === myId && tv.yt && !tv.local) send({ t: 'mic-leave' });
          // Video bắt đầu chạy: người hát báo độ dài để lượt hát kéo dài đúng hết bài.
          const dur = e.data === 1 && mic.singer === myId && tv.yt && !tv.local ? tv.player.getDuration() : 0;
          if (dur > 0 && tv.durationSent !== `${tv.yt}:${tv.startAt}`) {
            tv.durationSent = `${tv.yt}:${tv.startAt}`;
            send({ t: 'mic-duration', yt: tv.yt, sec: Math.round(dur) });
          }
        },
        onError: (e) => videoError(e.data),
      },
    });
  } else if (tv.ready) {
    // Đã nạp sẵn đúng video (lúc bấm chọn bài) thì chỉ tua tới đúng chỗ, không nạp lại.
    if (tv.player.getVideoData?.()?.video_id === track.yt) {
      tv.player.seekTo(start, true);
      tv.player.playVideo();
    } else tv.player.loadVideoById({ videoId: track.yt, startSeconds: start });
  }
  tv.stuck = 0;
  syncVideo();
}

// Điện thoại chỉ cho video phát có tiếng khi được gọi ngay trong lúc người dùng chạm.
// Bấm chọn bài là một lần chạm, nên nạp luôn video mới vào player lúc đó.
function primeVideo(yt) {
  if (!yt || LOCAL_AUDIO[yt] || !tv.player || !tv.ready) return;
  try {
    tv.player.loadVideoById({ videoId: yt, startSeconds: 0 });
    tv.player.unMute();
  } catch {}
}
function showTvPlay(on) {
  $('tv-play').classList.toggle('hidden', !on);
}
$('tv-play').onclick = () => {
  showTvPlay(false);
  tv.stuck = 0;
  ac().resume();
  const p = tv.player;
  if (!p || !tv.yt) return;
  try {
    p.seekTo(Math.max(0, (serverNow() - tv.startAt) / 1000), true);
    p.unMute();
    p.playVideo();
  } catch {}
};

function stopVideo() {
  clearTimeout(tv.fallbackTimer);
  showTvPlay(false);
  tv.yt = null;
  tv.local = false;
  stopLocal();
  try { tv.player?.stopVideo?.(); } catch {}
  drawScreen('', '');
}

// YouTube báo lỗi: lỗi chặn nhúng (101, 150) thì chịu luôn; lỗi khác (mạng chập chờn, player hỏng, mã 5…)
// thường chỉ là tạm thời, nạp lại đúng chỗ đang phát tối đa 2 lần rồi mới chuyển sang beat tự chế.
function videoError(code) {
  console.warn('YouTube lỗi', code, tv.yt);
  if (!tv.yt || tv.failed) return;
  if (code === 101 || code === 150 || (tv.retries || 0) >= 2) return videoFailed();
  tv.retries = (tv.retries || 0) + 1;
  const yt = tv.yt;
  setTimeout(() => {
    if (tv.yt !== yt || tv.failed) return;
    try { tv.player.loadVideoById({ videoId: yt, startSeconds: Math.max(0, (serverNow() - tv.startAt) / 1000) }); } catch { videoFailed(); }
  }, 1500);
}
function videoFailed() {
  if (!tv.yt || tv.failed) return;
  tv.failed = true;
  showTvPlay(false);
  if (tv.local) return; // tiếng vẫn phát từ file, màn chiếu hiện tên bài
  toast('Video này không phát được ở đây, chuyển sang beat tự chế 🎹');
  playSong(mic.song, mic.startAt);
  // Beat tự chế chỉ dài SONG_MS, hết beat thì người hát tự trả mic.
  const left = mic.startAt + SONG_MS - serverNow();
  if (mic.singer === myId) tv.fallbackTimer = setTimeout(() => send({ t: 'mic-leave' }), Math.max(0, left));
}

// Nhạc từ file trên máy: khớp giờ server, to nhỏ theo tầng (xem karaokeLevel).
function syncLocal() {
  if (!local.src || !local.gain) return;
  const a = ac(), elapsed = (serverNow() - tv.startAt) / 1000;
  // Phát từ file thì khớp được rất sát (đổi chỗ phát gần như tức thì), nên lệch quá 0,3 giây là chỉnh.
  if (elapsed < local.buf.duration && Math.abs(a.currentTime - local.at - elapsed) > 0.3) startLocal(elapsed);
  const off = muted || (document.hidden && !settings.bgPlay);
  local.gain.gain.setTargetAtTime(off ? 0 : (settings.karaoke / 100) * karaokeLevel(), a.currentTime, 0.3);
}

// Giữ video khớp giờ server; âm lượng theo tầng như syncLocal.

function syncVideo() {
  if (tv.local && tv.yt) return syncLocal();
  const p = tv.player;
  if (!tv.ready || !tv.yt || tv.failed) return;
  const elapsed = (serverNow() - tv.startAt) / 1000;
  const st = p.getPlayerState();
  if (elapsed < 0) {
    if (st === 1) p.pauseVideo();
    return;
  }
  if (st === -1 || st === 2 || st === 5) {
    p.playVideo();
    // Vẫn không chạy sau vài giây: trình duyệt chặn tự phát, nhờ người xem chạm một cái.
    if (++tv.stuck >= 3) showTvPlay(true);
  } else if (st === 1) {
    tv.stuck = 0;
    showTvPlay(false);
  }
  // Lệch quá 1 giây thì kéo về đúng chỗ; sau mỗi lần kéo chờ 4 giây cho video tải xong rồi mới đo lại.
  if (st === 1 && performance.now() - (tv.seekAt || 0) > 4000 && Math.abs(p.getCurrentTime() - elapsed) > 1) {
    tv.seekAt = performance.now();
    p.seekTo(elapsed + 0.3, true); // bù thời gian video tải lại sau khi kéo
  }
  const level = karaokeLevel();
  // Thang âm lượng của YouTube không tuyến tính: 12/100 nghe gần như im, trong khi file phát qua Web Audio ở 0,12 vẫn rõ.
  // Lấy căn bậc hai để bài YouTube và bài phát từ file to ngang nhau ở cùng chỗ đứng (vd. trong quán tầng 1: 12 → ~35).
  p.setVolume(Math.round(100 * Math.sqrt((settings.karaoke / 100) * level)));
  if (!level || muted || settings.karaoke === 0 || (document.hidden && !settings.bgPlay)) p.mute();
  else p.unMute();
}
setInterval(syncVideo, 1000);


// ---------- Chọn bài ----------
let songGenre = 'Tất cả';
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

// Lên sân khấu là hát bài mặc định luôn, muốn bài khác thì bấm "Đổi bài" trên thanh mic.
function singDefault() {
  if (mic.singer === myId) return;
  if (inMicQueue()) return toast('Bạn đang xếp hàng rồi, chờ tới lượt nhé!');
  const s = SONGS.find((x) => x.id === DEFAULT_SONG);
  send({ t: 'mic-join', song: s.id });
  toast(`🎤 Hát “${s.title}”, muốn bài khác thì bấm 🎵 Đổi bài`);
}

// force: mở cả khi đang cầm mic, để đổi bài (bài đang hát vẫn phát tới khi chọn xong).
function openSongPicker(force = false) {
  if (!force && mic.singer === myId) return;
  if (!force && inMicQueue()) return toast('Bạn đang xếp hàng rồi, chờ tới lượt nhé!');
  $('song-hint').textContent = 'Gõ tên bài rồi bấm 🔎 Tìm trên YouTube. Muốn bản có lời chạy chữ thì gõ thêm chữ "karaoke".';
  $('song-search').value = '';
  ytQuery = '';
  renderSongs();
  openModal('songs');
}

function renderSongs() {
  const genres = $('song-genres');
  genres.innerHTML = '';
  for (const g of ['Tất cả', ...GENRES]) {
    const b = document.createElement('button');
    b.textContent = g;
    b.className = g === songGenre ? 'on' : '';
    b.onclick = () => { songGenre = g; ytQuery = ''; renderSongs(); };
    genres.appendChild(b);
  }
  const q = fold($('song-search').value.trim());
  const list = $('song-list');
  list.innerHTML = '';
  const songs = SONGS.filter((s) => (songGenre === 'Tất cả' || s.genre === songGenre) && (!q || fold(`${s.title} ${s.by}`).includes(q)));
  for (const s of songs) {
    const b = document.createElement('button');
    b.className = s.id === DEFAULT_SONG ? 'song default' : 'song';
    const info = document.createElement('span');
    const t = document.createElement('b');
    t.textContent = s.title;
    const by = document.createElement('small');
    by.textContent = `${s.id === DEFAULT_SONG ? '⭐ Mặc định · ' : ''}${s.by} · ${s.genre}`;
    info.append(t, by);
    const badge = document.createElement('span');
    badge.textContent = s.yt || features.ytSearch ? '🎬' : '🎹';
    badge.title = s.yt || features.ytSearch ? 'Có video karaoke' : 'Beat tự chế';
    b.append(info, badge);
    b.onclick = () => joinMic({ song: s.id }, s.title);
    list.appendChild(b);
  }
  if (!songs.length) list.innerHTML = '<p class="small">Không có bài nào khớp. Bấm 🔎 Tìm trên YouTube nhé!</p>';
}

// Tìm trên YouTube qua server cơ sở (server lọc sẵn video cho phép chiếu trên màn hình sân khấu).
// Tìm đúng câu người chơi gõ (bài gốc, MV, remix…); muốn bản karaoke thì gõ thêm chữ "karaoke".
let ytQuery = '';
function searchYouTube() {
  const q = $('song-search').value.trim();
  if (!q) {
    $('song-search').focus();
    return toast('Gõ tên bài hoặc ca sĩ vào ô tìm kiếm trước nhé');
  }
  if (parseYouTube(q)) return joinMic({ url: q }, 'bài tự chọn'); // dán thẳng link YouTube vẫn hát được
  if (!net.online) return toast('Cần kết nối với quán mới tìm được trên YouTube');
  ytQuery = q;
  send({ t: 'yt-search', q });
  $('btn-yt-search').disabled = true;
  $('song-list').innerHTML = '<p class="small">🔎 Đang tìm trên YouTube…</p>';
}
function renderYouTube(m) {
  $('btn-yt-search').disabled = false;
  if (modal !== 'songs' || m.q !== ytQuery) return; // đã đóng hoặc đã tìm câu khác
  const list = $('song-list');
  list.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'yt-head';
  const label = document.createElement('span');
  label.textContent = `Kết quả YouTube cho “${m.q}”`;
  const back = document.createElement('button');
  back.textContent = '‹ Danh sách bài';
  back.onclick = () => { ytQuery = ''; renderSongs(); };
  head.append(label, back);
  list.appendChild(head);
  if (!m.items.length) {
    const p = document.createElement('p');
    p.className = 'small';
    p.textContent = m.error ? 'Không tìm được lúc này, thử lại sau nhé.' : 'Không thấy video nào chiếu được, thử gõ khác đi xem.';
    list.appendChild(p);
    return;
  }
  for (const v of m.items) {
    const b = document.createElement('button');
    b.className = 'song yt';
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    img.alt = '';
    img.loading = 'lazy';
    const info = document.createElement('span');
    const t = document.createElement('b');
    t.textContent = v.title;
    const by = document.createElement('small');
    by.textContent = [v.channel, v.duration].filter(Boolean).join(' · ');
    info.append(t, by);
    b.append(img, info);
    b.onclick = () => joinMic({ url: v.id }, v.title);
    list.appendChild(b);
  }
}

function joinMic(payload, title) {
  const change = mic.singer === myId;
  if (change) primeVideo(payload.url ? parseYouTube(payload.url) : SONGS.find((s) => s.id === payload.song)?.yt);
  send({ t: 'mic-join', ...payload, change });
  closeModal();
  toast(change ? `🎵 Đổi sang “${title}”` : `Đã xếp hàng hát “${title}” 🎤`);
}

$('song-search').addEventListener('input', () => { ytQuery = ''; renderSongs(); });
$('song-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchYouTube(); }
});
$('btn-yt-search').onclick = searchYouTube;
$('btn-songs-close').onclick = closeModal;

// ================= Trạng thái =================
const state = {
  name: 'Bạn', look: { s: 0, h: 0, b: 0 }, room: ROOMS[0].id, started: false, leaving: false,
  fill: 0, drunk: 0, drunkLevel: 0, cheers: 0, waters: 0,
  paid: 0, extras: [], rounds: 0, startedAt: 0, passedOut: false, // paid: tiền mình đã trả cho các bàn
};
let myId = 'me';
let meA = null; // actor của mình
const remotes = new Map();
let mic = { singer: null, queue: [], startAt: 0, endsAt: 0, song: 0, track: null };
let features = { ytSearch: false };
// Hoá đơn chung từng bàn (server giữ): { items, pours, paidBy, paidName }
const tabs = TABLES.map(() => ({ items: [], pours: 0, paidBy: null, paidName: null }));
function localTab(table) { // chế độ offline: tự mở hoá đơn mới nếu đã trả
  if (tabs[table].paidBy) tabs[table] = { items: [], pours: 0, paidBy: null, paidName: null };
  return tabs[table];
}
const roomState = new Map(); // id bàn phòng riêng -> { owner, locked }
const inMicQueue = () => mic.queue.some((q) => q.id === myId);
let modal = 'start';
let busy = null; // hoạt ảnh dzô/rót của mình đang chạy
let moveTarget = null, pending = null;
let route = []; // các điểm rẽ tới moveTarget, chỉ dùng khi moveTarget còn (xem walkTo)
// Đi tới (x,z) theo đường tránh vật cản. Đích nằm trong vật cản thì dừng ở chỗ trống gần nhất.
function walkTo(x, z) {
  const path = findPath(meA.f, meA.x, meA.z, x, z);
  route = path ? path.slice(0, -1) : [];
  moveTarget = path?.length ? path[path.length - 1] : { x, z };
}
const cam = { yaw: 0, pitch: 0.42, dist: 4.5 };

function allActors() {
  return [meA, ...remotes.values()].filter(Boolean);
}
function seatedAt(tableId) {
  return allActors().filter((a) => a.seat?.table === tableId).length;
}
function actorById(id) {
  return id === myId ? meA : remotes.get(id);
}

// ================= Mạng =================
// sameOrigin: trang có được chính server game phục vụ không (null = chưa biết, loadRooms sẽ xác định).
const net = { ws: null, online: false, offset: 0, lastSent: 0, lastKey: '', sameOrigin: null, everOnline: false, retries: 0, rejoin: null, restarting: false };
const serverNow = () => Date.now() + net.offset;
// Đo độ lệch đồng hồ với server: gửi vài mẫu, lấy mẫu đi về nhanh nhất (ít bị trễ mạng nhất),
// cộng nửa thời gian đi về. Đo lại mỗi phút để mọi máy nghe bài karaoke cùng một chỗ.
const clockSyncState = { best: null, timer: null };
function clockSync() {
  clockSyncState.best = null;
  for (let i = 0; i < 5; i++) setTimeout(() => send({ t: 'clock', c: Date.now() }), i * 250);
  clearTimeout(clockSyncState.timer);
  clockSyncState.timer = setTimeout(clockSync, 60000);
}
function onClock(m) {
  const now = Date.now(), rtt = now - m.c;
  if (rtt < 0 || rtt > 5000 || (clockSyncState.best && rtt >= clockSyncState.best.rtt)) return;
  clockSyncState.best = { rtt };
  net.offset = m.s + rtt / 2 - now;
}
// Địa chỉ server của một cơ sở: cùng host nếu trang do server game phục vụ, không thì server riêng của cơ sở.
function roomServer(id) {
  const own = ROOMS.find((r) => r.id === id)?.server;
  return net.sameOrigin || !own ? location.origin : own;
}

function connect() {
  let ws, welcomed = false;
  try {
    const url = new URL('/ws', roomServer(state.room));
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('room', state.room);
    ws = new WebSocket(url);
  }
  catch { goOffline(); return; }
  net.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: state.name, look: state.look, key: joinKey, pid: playerPid }));
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'welcome') welcomed = true;
    onMessage(m);
  };
  ws.onclose = () => {
    if (state.leaving || net.full) return;
    // Lần đầu đã không vào được thì chơi một mình; đã từng vào rồi (server deploy lại, mạng chập chờn) thì nối lại mãi.
    if (!welcomed && !net.everOnline) { goOffline(); return; }
    if (welcomed) {
      net.online = false;
      // Nhớ chỗ đang đứng/ngồi để nối lại xong đặt về đúng chỗ, ngồi lại đúng bàn.
      net.rejoin = { table: meA.seat?.table, x: meA.x, z: meA.z, f: meA.f, yaw: meA.yaw };
      net.retries = 0;
      toast(net.restarting ? '🔧 Quán đang nâng cấp, vài giây nữa vào lại…' : 'Mất kết nối, đang nối lại…');
      for (const id of [...remotes.keys()]) removeRemote(id);
      if (meA.seat) unseatActor(meA);
      updateBillButton();
    }
    // Thử lại sau 1, 2, 3… tối đa 5 giây; server miễn phí khởi động lại có thể mất cả phút.
    if (++net.retries > 60) { goOffline(); return; }
    setTimeout(connect, Math.min(5000, 1000 * net.retries));
  };
}

function goOffline() {
  net.online = false;
  net.offline = true;
  myId = 'me';
  toast('Không kết nối được server, đang ngồi một mình (offline)');
  updatePeople();
}

function send(m) {
  if (net.online && net.ws?.readyState === 1) net.ws.send(JSON.stringify(m));
  else if (net.offline) localServer(m);
}

// Khi chơi offline, giả lập phản hồi của server.
let localMicTimer = null;
function localServer(m) {
  const reply = (msg) => setTimeout(() => onMessage(msg), 30);
  switch (m.t) {
    case 'sit': {
      const T = TABLES[m.table];
      if (!T || meA.seat) return;
      const idx = nearestFreeSeat(T, () => false, meA.x, meA.z);
      reply(idx < 0 ? { t: 'sit-fail', table: T.id } : { t: 'seat', id: myId, table: T.id, idx });
      if (idx >= 0 && T.private) reply({ t: 'room', table: T.id, owner: myId, locked: false });
      break;
    }
    case 'stand':
      if (meA.seat && TABLES[meA.seat.table].private) reply({ t: 'room', table: meA.seat.table, owner: null, locked: false });
      reply({ t: 'stand', id: myId });
      break;
    case 'room-lock':
      if (meA.seat) reply({ t: 'room', table: meA.seat.table, owner: myId, locked: !!m.locked });
      break;
    case 'order':
      if (!meA.seat) break;
      reply({ t: 'dish', table: meA.seat.table, item: m.item, by: myId });
      localTab(meA.seat.table).items.push(m.item);
      reply({ t: 'tab', table: meA.seat.table, ...tabs[meA.seat.table] });
      break;
    case 'pour-round':
      if (!meA.seat) break;
      if (state.fill >= 0.5) { reply(m.cheers ? { t: 'pour-round', table: meA.seat.table, by: myId, ids: [], cheers: true } : { t: 'notice', msg: 'Ly còn đầy kìa, dzô đi! 🍻' }); break; }
      localTab(meA.seat.table).pours++;
      reply({ t: 'pour-round', table: meA.seat.table, by: myId, ids: [myId], cheers: !!m.cheers });
      reply({ t: 'tab', table: meA.seat.table, ...tabs[meA.seat.table] });
      break;
    case 'refill':
    case 'act':
      if ((m.t === 'refill' || m.k === 'pour') && meA.seat) {
        localTab(meA.seat.table).pours++;
        reply({ t: 'tab', table: meA.seat.table, ...tabs[meA.seat.table] });
      }
      break;
    case 'pay': {
      const tab = meA.seat && tabs[meA.seat.table];
      if (!tab) break;
      if (tab.paidBy) reply({ t: 'notice', msg: 'Bàn này đã thanh toán rồi 💸' });
      else if (!tab.items.length) reply({ t: 'notice', msg: 'Bàn chưa gọi món nào, gọi món trước rồi mới tính tiền nhé!' });
      else {
        const total = tabTotal(TABLES[meA.seat.table], tab);
        reply({ t: 'paid', table: meA.seat.table, by: myId, name: state.name, total });
        reply({ t: 'tab', table: meA.seat.table, ...tab, paidBy: myId, paidName: state.name });
      }
      break;
    }
    case 'round': reply({ t: 'round', id: myId, name: state.name }); break;
    case 'mic-join': {
      if (mic.singer) return;
      let track;
      if (m.url) {
        const yt = parseYouTube(m.url);
        if (!yt) { reply({ t: 'notice', msg: 'Link YouTube không hợp lệ' }); return; }
        track = { title: 'Bài tự chọn', by: '', yt };
      } else {
        const song = SONGS.find((x) => x.id === m.song);
        if (!song) return;
        track = { title: song.title, by: song.by, yt: song.yt || null };
      }
      if (meA.seat) onMessage({ t: 'stand', id: myId });
      const startAt = Date.now() + MIC_DELAY_MS, len = track.yt ? MAX_SONG_MS : SONG_MS;
      reply({ t: 'mic', singer: myId, startAt, endsAt: startAt + len, song: Math.floor(Math.random() * 1000), track, queue: [] });
      localMicTimer = setTimeout(() => onMessage({ t: 'mic', singer: null, queue: [] }), len + MIC_DELAY_MS);
      break;
    }
    case 'mic-leave':
      clearTimeout(localMicTimer);
      reply({ t: 'mic', singer: null, queue: [] });
      break;
    case 'chat':
      if (m.scope === 'all') reply({ t: 'chat', scope: 'all', id: myId, name: state.name, text: m.text.trim().slice(0, CHAT_MAX) });
      else if (meA.seat) reply({ t: 'chat', id: myId, table: meA.seat.table, text: m.text.trim().slice(0, CHAT_MAX) });
      break;
  }
}

function addRemote(p) {
  if (remotes.has(p.id)) removeRemote(p.id);
  const a = createActor(lookToOpts(p.look, Number(p.id) || 0), p.name, 'player');
  a.id = p.id;
  a.d = p.d || 0;
  if (p.seat) seatActor(a, p.seat.table, p.seat.idx);
  else placeAt(a, p.x, p.z, p.yaw, p.f || 0);
  a.hit = clickable(add(new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8), HIT_MAT, 0, 0.9, 0, a.person.root), {
    kind: 'player',
    pos: () => a,
    range: 2.5,
    label: () => `mời <b>${escapeHtml(a.name)}</b> một ly 🍻`,
    action: () => offerDrink(a),
  });
  remotes.set(p.id, a);
}
function removeRemote(id) {
  const a = remotes.get(id);
  if (!a) return;
  removeActor(a);
  remotes.delete(id);
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      net.online = true;
      myId = m.id;
      meA.id = myId;
      chatTable = -1; // vào quán mới (hoặc kết nối lại) thì khung chat làm lại từ đầu
      net.offset = m.now - Date.now(); // ước lượng thô, clockSync() đo lại chính xác ngay sau đó
      clockSync();
      lastDayK = -1;
      updateDayNight();
      // Kết nối lại (server khởi động lại, mạng chập chờn) thì danh sách cũ có thể còn người đã đi, kể cả bóng của chính mình.
      [...remotes.keys()].forEach(removeRemote);
      m.players.forEach(addRemote);
      TABLES.forEach((T) => T.dishes.clear());
      m.dishes.forEach((items, table) => items.forEach((item) => serveDish(table, item, true)));
      features = m.features || features;
      voice.leave(); // kết nối lại quán thì vào lại kênh thoại sau
      voiceMicSent = ''; // kết nối mới: server chưa biết mic mình
      onVoiceLive(m.voiceLive || {}); // kênh nào đang có người nói thì tự vào nghe
      setMic(m.mic);
      if (net.rejoin) {
        // Nối lại sau khi rớt mạng / server deploy: đứng lại chỗ cũ, đang ngồi thì ngồi lại bàn cũ.
        const r = net.rejoin;
        placeAt(meA, r.x, r.z, r.yaw, r.f);
        if (r.table !== undefined) send({ t: 'sit', table: r.table });
        toast('✅ Đã vào lại quán, nhậu tiếp thôi!');
      } else placeAt(meA, spawnSpot().x, SPAWN.z, SPAWN.yaw, 0);
      net.rejoin = null;
      net.everOnline = true;
      net.retries = 0;
      net.restarting = false;
      roomState.clear();
      (m.rooms || []).forEach((rm) => onMessage(rm));
      (m.tabs || []).forEach((tb) => onMessage(tb));
      if (m.wallet) onMessage({ t: 'wallet', ...m.wallet });
      holds.forEach((_, t) => setHold(t, 0));
      (m.holds || []).forEach((h) => setHold(h.table, h.until));
      if (m.wallet?.debt > 0) setTimeout(() => {
        speak(owner, `📒 Lần trước em còn nợ ${fmt(m.wallet.debt)} đó nha!`, 4000);
        toast(`📒 Bạn còn nợ quán ${fmt(m.wallet.debt)}. Ra quầy thu ngân trả nợ rồi mới gọi món được.`);
      }, 1500);
      setBeach(m.beach || []);
      $('chat-log-all').innerHTML = '';
      for (const c of m.chatAll || []) addChatLine(c.name, c.text, 'all');
      setChatScope('all');
      updatePeople();
      break;
    case 'join':
      addRemote(m.player);
      speak(remotes.get(m.player.id), 'vừa vào quán 👋', 2500);
      updatePeople();
      break;
    case 'leave':
      removeRemote(m.id);
      updatePeople();
      break;
    case 'moves':
      for (const [id, x, z, yaw, d, f = 0] of m.list) {
        const a = remotes.get(id);
        if (!a) continue;
        a.d = d;
        if (a.seat) continue;
        if (a.f !== f) { a.rx = x; a.rz = z; } // đổi tầng thì không trượt
        Object.assign(a, { x, z, yaw, f });
      }
      break;
    case 'seat': {
      const a = actorById(m.id);
      if (!a) return;
      const moved = a.seat?.table === m.table; // đổi ghế trong cùng bàn
      seatActor(a, m.table, m.idx);
      if (a === meA && !moved) onSitMine();
      else if (a === meA) cam.yaw = meA.yaw + Math.PI;
      updatePeople();
      break;
    }
    case 'stand': {
      const a = actorById(m.id);
      if (!a || !a.seat) return;
      const T = TABLES[a.seat.table];
      unseatActor(a);
      if (a === meA) onStandMine(T);
      updatePeople();
      break;
    }
    case 'hold':
      setHold(m.table, m.until);
      break;
    case 'debt-paid':
      speak(owner, m.left ? `Em trả ${fmt(m.paid)}, còn nợ ${fmt(m.left)} nha!` : 'Hết nợ rồi, nhậu tiếp đi em! 🍻', 3000);
      toast(m.left ? `📒 Đã trả ${fmt(m.paid)}, còn nợ ${fmt(m.left)}` : `📒 Đã trả hết nợ ${fmt(m.paid)}`);
      break;
    case 'sit-fail':
      if (m.held) { toast(`🪧 ${tableName(TABLES[m.table])} đang giữ chỗ cho nhóm vừa ra ngoài, chọn bàn khác nhé!`); break; }
      if (m.locked) {
        if (m.wait) { closeModal(); toast(`🔒 Nhập sai nhiều quá, đợi ${m.wait} giây rồi thử lại nhé`); break; }
        if (modal === 'code' && codeFor?.table === m.table) {
          $('code-msg').textContent = m.wrong ? '❌ Sai mật mã, thử lại nhé' : '';
          $('code-input').value = '';
          shakeCode();
          break;
        }
        // Lần đầu bị chặn ở cửa: gõ cửa (người trong phòng nghe thấy) rồi hỏi mật mã
        knockSound();
        send({ t: 'knock', table: m.table });
        askCode('enter', m.table, codeFor?.table === m.table ? codeFor.idx : undefined);
        break;
      }
      toast(`${tableName(TABLES[m.table])} hết ghế rồi, thử bàn khác nhé!`);
      break;
    case 'knock':
      if (m.id === myId) break;
      knockSound();
      toast(`🚪 ${m.name} đang gõ cửa ${tableName(TABLES[m.table])}. Báo mật mã nếu muốn cho vào nhé!`);
      break;
    case 'room': {
      const prev = roomState.get(m.table);
      if (m.owner) roomState.set(m.table, { owner: m.owner, locked: !!m.locked });
      else roomState.delete(m.table);
      doors.get(m.table).visible = !!m.locked;
      if (m.owner === myId && prev?.owner !== myId && meA.seat?.table === m.table) toast(`Bạn là chủ ${tableName(TABLES[m.table])}, bấm 🔒 để khoá phòng`);
      renderLockButton();
      break;
    }
    case 'act': {
      if (m.id === myId) return;
      const a = remotes.get(m.id);
      if (!a) return;
      onAnyAct(a, m.k);
      if (m.k === 'offer') {
        const target = actorById(m.to);
        speak(a, target ? `🍻 mời ${target === meA ? 'bạn' : target.name} một ly` : '🍻', 2500);
        a.anim = 'offer';
        a.animT = 0;
      } else if (m.k === 'dance' || m.k === 'dance-stop') {
        a.dancing = m.k === 'dance';
        if (a.dancing) speak(a, '💃 nhảy nào!', 1800);
      } else {
        if (m.k === 'cheers') {
          if (aloneAt(a)) playAct(a, 'cheers'); // người đó ngồi một mình: uống luôn, không hò
          else {
            dzoCount(a);
            cheersLater(a);
            tableCheers(a);
          }
        } else playAct(a, m.k);
      }
      break;
    }
    case 'dish': {
      const T = TABLES[m.table], dish = MENU[m.item];
      if (T.floor === 0) {
        deliverDish(m.table, m.item);
        speak(chef, `🔥 ${dish.name} có ngay!`, 2500);
      } else {
        // Món lên tầng trên đi bằng thang tời: đèn thang tời tầng đó sáng, kêu "ding", rồi món ra bàn.
        speak(chef, `🔥 ${dish.name} · gửi thang tời lên ${FLOOR_NAMES[T.floor]}`, 2800);
        dumbwaiterLamps[T.floor].userData.until = performance.now() + 2600;
        setTimeout(() => {
          deliverDish(m.table, m.item); // em ở tầng đó lấy món từ thang tời bưng ra bàn
          if (meA.f === T.floor && Math.hypot(meA.rx - DUMBWAITER.x, meA.rz - DUMBWAITER.z) < 12) dingSound();
          if (T.floor === 1) speak(waiter, `Món ${dish.name} lên rồi, em mang vào liền ạ!`, 2500);
        }, 1500);
      }
      if (meA.f === 0 && Math.hypot(meA.rx - chef.rx, meA.rz - chef.rz) < 9) noiseHit(1.2, 3000, 0.08, 'highpass');
      if (m.by !== myId) speak(actorById(m.by), `gọi ${MENU[m.item].icon} ${MENU[m.item].name}`, 2500);
      break;
    }
    case 'dishes':
      TABLES[m.table].dishes.clear();
      TABLES[m.table].suggested = false;
      for (const d of deliveries) if (d.table === m.table && !d.done) { d.done = true; clearTimeout(d.timer); } // bàn đã dọn thì thôi bưng
      break;
    case 'tab':
      tabs[m.table] = { items: m.items || [], pours: m.pours || 0, paidBy: m.paidBy ?? null, paidName: m.paidName ?? null };
      if (modal === 'bill' && meA?.seat?.table === m.table) showBill();
      if (meA?.seat?.table === m.table) updateBillButton();
      break;
    case 'paid': {
      if (m.by === myId) {
        state.paid += m.total;
        startPayTrip(m.total);
      } else if (meA?.seat?.table === m.table) {
        toast(`💸 ${m.name} đã thanh toán ${fmt(m.total)} cho cả bàn`);
        speak(actorById(m.by), '💸 Để tôi trả!', 2500);
      }
      break;
    }
    case 'round': {
      if (m.id === myId) state.rounds++;
      toast(`${m.id === myId ? 'Bạn' : m.name} vừa bao cả quán một két! 🍻`);
      const crate = new THREE.Group();
      box(0.5, 0.3, 0.35, 0x1b5e20, 0, 0, 0, crate);
      crate.position.set(roundCrates.children.length * 0.55, 0, 0);
      crate.scale.setScalar(0.01);
      roundCrates.add(crate);
      popIns.push({ obj: crate, t: 0 });
      if (roundCrates.children.length > 4) roundCrates.remove(roundCrates.children[0]);
      if (meA.seat && state.fill < 0.5) setFill(0.95);
      const a = actorById(m.id);
      if (a) speak(a, '🍻 Hôm nay tôi bao!', 3000);
      break;
    }
    case 'mic':
      setMic(m);
      break;
    case 'chat': {
      const a = actorById(m.id);
      if (m.scope === 'all') {
        if (a) speak(a, m.text, 6000);
        addChatLine(a === meA ? 'Bạn' : m.name, m.text, 'all');
        break;
      }
      if (!a || meA.seat?.table !== m.table) return;
      speak(a, m.text, 6000);
      addChatLine(a === meA ? 'Bạn' : a.name, m.text);
      // Ngồi bàn chú Ba thì chú cũng góp chuyện.
      if (a === meA && TABLES[m.table] === chuBaTable && Math.random() < 0.7) {
        setTimeout(() => {
          if (meA.seat?.table !== chuBaTable.id) return;
          const line = pick(LINES.chuBaReply);
          speak(chuBa, line, 5000);
          addChatLine(chuBa.name, line);
        }, 1200 + Math.random() * 1500);
      }
      break;
    }
    case 'notice':
      toast(m.msg);
      fishRefused(m.msg);
      if (modal === 'songs') $('btn-yt-search').disabled = false;
      break;
    case 'wallet':
      wallet = { money: m.money, bag: m.bag || [], debt: m.debt || 0 };
      renderWallet();
      break;
    case 'broke':
      toast(m.msg);
      walletChip.classList.add('broke');
      break;
    case 'beach':
      setBeach(m.items || []);
      break;
    case 'catch':
      if (modal === 'fish' && !catchFx) playCatch(m.k, () => showCatch(m.k));
      break;
    case 'picked': {
      const it = ITEMS[m.k];
      if (it) { toast(`${it.icon} Nhặt được ${it.name}! Mở 🎒 giỏ để ${it.bottle ? 'mở chai hoặc bán' : 'bán lấy tiền'}`); speak(meA, `${it.icon} nhặt được!`, 1800); }
      break;
    }
    case 'sold':
      if (m.gain) {
        toast(m.toDebt ? `💰 Bà Tư trả ${fmt(m.gain)}, trừ nợ quán ${fmt(m.toDebt)}` : `💰 Bà Tư trả ${fmt(m.gain)}`);
        speak(trader, pick(LINES.traderPaid), 2500);
      }
      break;
    case 'bottle':
      $('bottle-text').textContent = m.text;
      $('bottle-from').textContent = m.from ? `— ${m.from} thả lại biển —` : '— không ký tên —';
      openModal('bottle');
      break;
    case 'vendor-ok':
      speak(vendor, 'Cảm ơn con nhé!');
      state.extras.push(MENU[0]);
      speak(meA, '🥜 nhai lạc', 2000);
      break;
    case 'pour-round':
      pourRound(m);
      break;
    case 'clock':
      onClock(m);
      break;
    case 'voice-live':
      onVoiceLive(m);
      break;
    case 'restart':
      net.restarting = true; // server sắp tắt để lên bản mới: lát nữa tự nối lại
      toast('🔧 Quán đang nâng cấp, vài giây nữa vào lại…');
      break;
    case 'game':
      tableGames.onGame(m);
      break;
    case 'voice-token':
      voice.join(m.scope, m.table, m.url, m.token);
      break;
    case 'yt-results':
      renderYouTube(m);
      break;
    case 'invite': {
      const a = remotes.get(m.id);
      if (a && meA.seat && !state.passedOut) showInvite(a);
      else send({ t: 'invite-reply', to: m.id, ok: false });
      break;
    }
    case 'invite-reply': {
      const a = remotes.get(m.id);
      if (!a) break;
      if (!m.ok) { toast(`${a.name} bảo để sau 😅`); break; }
      toast(`${a.name} đồng ý, dzô! 🍻`);
      refill();
      // Cùng bàn thì cái dzô của người kia kéo cả bàn (cả mình) dzô theo; khác bàn thì tự dzô.
      if (a.seat?.table !== meA.seat?.table) { if (busy) busy = null; cheers(); }
      break;
    }
    case 'name-bad':
      net.full = true; // không tự kết nối lại, chờ người chơi đổi tên
      state.started = false;
      $('hud').classList.add('hidden');
      openModal('start');
      loadRooms();
      askName(m.msg);
      break;
    case 'full':
      net.full = true;
      $('start-msg').textContent = 'Cơ sở này đầy rồi, chọn cơ sở khác nhé!';
      state.started = false;
      openModal('start');
      loadRooms();
      break;
  }
}

let playingKey = '';
function setMic(m) {
  const wasSinging = mic.singer === myId;
  mic = {
    singer: m.singer ?? null, queue: m.queue || [], startAt: m.startAt || 0, endsAt: m.endsAt || 0,
    song: m.song || 0, track: m.track || null,
  };
  for (const a of allActors()) a.singing = a.id === mic.singer;
  const key = mic.singer ? `${mic.singer}:${mic.startAt}` : '';
  if (key === playingKey) {
    // Chỉ hàng chờ thay đổi
  } else if (mic.singer) {
    playingKey = key;
    stopSong();
    if (mic.track?.yt) playVideo(mic.track, mic.startAt);
    else {
      stopVideo();
      playSong(mic.song, mic.startAt);
    }
    const singer = actorById(mic.singer);
    if (singer === meA) {
      moveTarget = pending = null;
      placeAt(meA, STAGE.singerX, STAGE.singerZ, -Math.PI / 2, STAGE.floor);
      // Camera đứng chính giữa phía khán giả, thấy cả người hát lẫn màn chiếu sau lưng.
      cam.yaw = -Math.PI / 2;
      atStartView = false;
      cam.pitch = 0.15;
      cam.dist = Math.max(cam.dist, 4);
      toast(wasSinging ? `🎵 Đang hát: ${mic.track?.title || 'bài mới'}` : `🎤 Đến lượt bạn: ${mic.track?.title || 'hát đi nào'}!`);
    } else if (singer) {
      speak(singer, `🎤 ${mic.track?.title || 'lên hát đây!'}`, 3000);
    }
  } else {
    playingKey = '';
    stopSong();
    stopVideo();
  }
  // Hết lượt hát (hết bài, bấm Dừng hát, hay tới lượt người khác): tự bước xuống sàn nhường sân khấu.
  // Đã bấm đi chỗ khác thì đi theo chỗ đó.
  if (wasSinging && mic.singer !== myId && meA && onStage(meA) && !moveTarget) {
    walkTo(STAGE.x - STAGE.w / 2 - 1.3, STAGE.z + (Math.random() - 0.5) * 2.5);
    speak(meA, '🙇 Cảm ơn mọi người!', 2500);
  }
  applyVolumes(); // có người hát thì tắt nhạc nền
  renderMicBar();
  updatePeople();
}

function renderMicBar() {
  const bar = $('mic-bar');
  const pos = mic.queue.findIndex((q) => q.id === myId);
  if (!mic.singer && pos < 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = '';
  const singer = actorById(mic.singer);
  const text = document.createElement('span');
  text.textContent = mic.singer
    ? `🎤 ${singer === meA ? 'Bạn' : singer?.name || 'Ai đó'} đang hát ${mic.track?.title ? `“${mic.track.title}”` : ''}${mic.queue.length ? ` · ${mic.queue.length} người chờ` : ''}`
    : '';
  if (pos >= 0) text.textContent += `${text.textContent ? ' · ' : ''}Bạn xếp hàng thứ ${pos + 1} (${mic.queue[pos].title})`;
  bar.appendChild(text);
  if (mic.singer === myId || pos >= 0) {
    const b = document.createElement('button');
    b.textContent = mic.singer === myId ? 'Dừng hát' : 'Rời hàng';
    b.onclick = () => send({ t: 'mic-leave' });
    const change = document.createElement('button');
    change.textContent = '🎵 Đổi bài';
    change.onclick = () => openSongPicker(true); // bài cũ phát tiếp tới khi chọn xong bài mới
    bar.append(change, b);
  }
}

// ================= Giao diện =================
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2800);
}

const OVERLAYS = { donate: 'overlay-donate', start: 'overlay-start', menu: 'overlay-menu', songs: 'overlay-songs', settings: 'overlay-settings', elevator: 'overlay-elevator', poem: 'overlay-poem', bill: 'overlay-bill', end: 'overlay-end', leave: 'overlay-leave', pick: 'overlay-pick', fish: 'overlay-fish', bag: 'overlay-bag', bottle: 'overlay-bottle', games: 'overlay-games', code: 'overlay-code' };
function openModal(name) {
  modal = name;
  for (const [k, id] of Object.entries(OVERLAYS)) $(id).classList.toggle('hidden', k !== name);
}
function closeModal() {
  modal = null;
  for (const id of Object.values(OVERLAYS)) $(id).classList.add('hidden');
}

// ================= Thoại (LiveKit) =================
// Chọn kênh nghe (Đóng / Cả quán / Bàn) và bật mic ở Cài đặt → Thoại; phím V bật/tắt mic. Mỗi lúc chỉ ở một kênh.
// Tiết kiệm phút LiveKit (tính cả người chỉ nghe): chỉ ở trong kênh khi kênh đó có người bật mic. Server báo kênh nào
// đang có người nói (voice-live, không qua LiveKit); có người nói thì tự vào nghe, không ai nói vài giây thì tự rời.
// Mic đang bật thì hiện viên đỏ cạnh khung chat để luôn biết mọi người đang nghe mình.
let voiceSpeakers = new Set(), voicePeers = new Map();
let voiceWantMic = false; // đang chờ vào kênh xong thì bật mic
let voiceAutoOff = false; // thoại vừa tự ngắt (rời tab / im quá lâu), chờ người chơi quay lại mới vào lại
let voiceIntent = settings.voiceSpk === 'off' ? 'off' : 'all'; // kênh người chơi muốn nghe
let voiceLiveState = { all: 0, tables: {} }; // số người đang bật mic ở từng kênh (server báo)
let voiceMicSent = ''; // trạng thái mic đã báo server, để chỉ báo khi đổi
let voiceQuietSince = 0; // lúc kênh mình đang ở bắt đầu không còn ai bật mic
const VOICE_QUIET_MS = 8000; // không ai bật mic chừng này thì rời kênh
const VOICE_LABEL = { all: 'Cả quán', table: 'Bàn' };
const voiceWanted = () => (voiceIntent === 'table' && !meA?.seat ? 'all' : voiceIntent);
// Số người khác đang bật mic ở một kênh (trừ chính mình)
function voiceOthers(scope) {
  const mine = voice.mic && voice.scope === scope ? 1 : 0;
  const n = scope === 'table' ? (meA?.seat ? voiceLiveState.tables[meA.seat.table] || 0 : 0) : voiceLiveState.all;
  return Math.max(0, n - mine);
}
// Gọi khi server báo ai đang nói, khi đổi kênh / ngồi / đứng, và định kỳ: vào hoặc rời kênh cho đúng.
function voiceAutoManage() {
  if (!features.voice || !net.online || !state.started || voice.connecting) return;
  const want = voiceWanted();
  if (want !== 'off' && voiceOthers(want) > 0) {
    voiceQuietSince = 0;
    if (!voiceAutoOff && voice.scope !== want) joinVoice(want);
    return;
  }
  // Mình đang ở trong kênh mà không còn ai (kể cả mình) bật mic: chờ một lúc rồi rời để khỏi tốn phút.
  if (voice.scope && !voice.mic && voiceOthers(voice.scope) === 0) {
    voiceQuietSince ||= Date.now();
    if (Date.now() - voiceQuietSince > VOICE_QUIET_MS) {
      voiceQuietSince = 0;
      voice.leave();
    }
  } else voiceQuietSince = 0;
}
setInterval(voiceAutoManage, 2000);
const voiceComeBack = () => {
  if (!voiceAutoOff || document.hidden) return;
  voiceAutoOff = false;
  voiceAutoManage();
};
for (const evName of ['pointerdown', 'keydown']) addEventListener(evName, voiceComeBack, { passive: true });
document.addEventListener('visibilitychange', voiceComeBack);
const voice = createVoice({
  onState: renderVoice,
  onSpeakers: (set) => { voiceSpeakers = set; markSpeakers(); },
  onPeers: (map) => { voicePeers = map; updatePeople(); },
  onError: (msg) => toast(`🎧 ${msg}`),
  // Rời tab quá 1 phút / kênh im quá lâu thì voice.js tự ngắt; quay lại tab, bấm hay gõ phím là được vào lại.
  onAutoLeave: () => { voiceAutoOff = true; },
});
function onVoiceLive(m) {
  voiceLiveState = { all: m.all || 0, tables: m.tables || {} };
  voiceAutoManage();
  renderVoice();
}
function renderVoice() {
  $('voice-settings').classList.toggle('hidden', !features.voice);
  // Vừa vào kênh xong mà đang chờ bật mic (bật mic lúc chưa vào kênh)
  if (voiceWantMic && voice.scope && !voice.connecting) {
    voiceWantMic = false;
    setVoiceMic(true);
  }
  // Báo server mình đang bật mic ở kênh nào (để máy người khác biết lúc nào cần vào nghe)
  const micKey = voice.mic && voice.scope ? `${voice.scope}:${voice.table ?? ''}` : '';
  if (micKey !== voiceMicSent && net.online) {
    voiceMicSent = micKey;
    send({ t: 'voice-mic', on: !!micKey, scope: voice.scope || 'all' });
  }
  const want = voiceWanted(), ch = VOICE_LABEL[voice.scope] || '';
  document.querySelectorAll('[data-vspk]').forEach((b) => {
    b.classList.toggle('on', b.dataset.vspk === want);
    if (b.dataset.vspk === 'table') b.disabled = !meA?.seat;
  });
  document.querySelectorAll('[data-vmic]').forEach((b) => b.classList.toggle('on', (b.dataset.vmic === 'on') === voice.mic));
  $('voice-status').textContent = voice.connecting ? '⏳ Đang vào kênh…'
    : voice.scope ? `Đang nghe kênh ${ch}${voice.mic ? `, mic đang bật (${ch === 'Bàn' ? 'cả bàn' : 'cả quán'} nghe bạn nói)` : ''}.`
    : want === 'off' ? 'Thoại đang đóng. Chọn kênh để nghe, bật mic (hoặc phím V) để nói.'
    : `🔊 Sẵn sàng nghe kênh ${VOICE_LABEL[want]}: có người bật mic là tự nghe. Bật mic (hoặc phím V) để nói.`;
  // Nút mic ở hàng nút góc phải: gạch chéo khi tắt, đỏ nhấp nháy khi đang nói
  const micBtn = $('btn-mic');
  micBtn.classList.toggle('hidden', !features.voice);
  micBtn.classList.toggle('on', voice.mic);
  micBtn.title = voice.mic ? `Mic đang bật (kênh ${ch}). Bấm để tắt (V)` : 'Bật mic để nói (V)';
  const live = $('voice-live');
  live.classList.toggle('hidden', !voice.mic || !state.started);
  live.textContent = `🎙️ ${ch}`;
  markSpeakers();
}
function markSpeakers() {
  for (const a of allActors()) a.tag.classList.toggle('speaking', voiceSpeakers.has(String(a.id)));
}
function joinVoice(scope) {
  if (scope === 'off') return voice.leave();
  if (!net.online) return toast('Cần kết nối với quán mới dùng thoại được');
  if (scope === 'table' && !meA?.seat) return toast('Ngồi vào bàn rồi mới nói chuyện với cả bàn được nhé!');
  if (voice.scope === scope && (scope !== 'table' || voice.table === meA.seat.table)) return;
  send({ t: 'voice-token', scope });
}
async function setVoiceMic(want) {
  const on = await voice.setMic(want);
  if (on) toast(voice.scope === 'table' ? '🎙️ Cả bàn đang nghe bạn nói' : '🎙️ Cả quán đang nghe bạn nói');
  renderVoice();
}
// Cài đặt → Thoại: chọn kênh muốn nghe. Chỉ vào kênh khi có người nói (xem voiceAutoManage);
// đang ở kênh khác thì chuyển ngay. Nhớ lựa chọn: chọn Đóng thì lần sau vào quán cũng đóng.
document.querySelectorAll('[data-vspk]').forEach((b) => (b.onclick = () => {
  const next = b.dataset.vspk;
  voiceIntent = next;
  settings.voiceSpk = next === 'off' ? 'off' : 'all';
  saveSettings();
  voiceAutoOff = false;
  if (!voice.connecting && voice.scope && voice.scope !== next) {
    voiceWantMic = next !== 'off' && voice.mic; // đổi kênh lúc mic đang bật thì sang kênh mới vẫn bật mic
    joinVoice(next);
  }
  voiceAutoManage();
  renderVoice();
}));
// Bật mic: chưa vào kênh nào thì vào kênh đang chọn (Đóng thì: đang ngồi vào Bàn, không thì Cả quán) rồi bật.
function voiceMicOn() {
  if (!features.voice || voice.connecting) return;
  voiceAutoOff = false;
  if (voice.scope) return setVoiceMic(true);
  voiceWantMic = true;
  const want = voiceWanted();
  joinVoice(want !== 'off' ? want : meA?.seat ? 'table' : 'all');
}
const toggleVoiceMic = () => (voice.mic ? setVoiceMic(false) : voiceMicOn());
$('btn-mic').onclick = () => toggleVoiceMic();
document.querySelectorAll('[data-vmic]').forEach((b) => (b.onclick = () => (b.dataset.vmic === 'on' ? voiceMicOn() : setVoiceMic(false))));
$('voice-live').onclick = (e) => { e.currentTarget.blur(); setVoiceMic(false); };
// Rời bàn / đổi bàn thì ra khỏi kênh thoại của bàn cũ; lúc đó muốn nghe Bàn thì chuyển sang Cả quán.
function voiceSeatChanged() {
  if (voice.scope === 'table' && voice.table !== meA?.seat?.table) {
    voice.leave().then(voiceAutoManage);
    toast('🎧 Đã rời kênh thoại của bàn');
  }
  voiceAutoManage();
  renderVoice();
}

function updatePeople() {
  const list = allActors();
  $('people-count').textContent = list.length;
  const ul = $('people-list');
  ul.innerHTML = '';
  for (const a of list) {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.textContent = a === meA ? `${a.name} (bạn)` : a.name;
    const s = document.createElement('small');
    s.textContent = a.singing ? `🎤 ${mic.track?.title || 'đang hát'}` : a.seat ? `🪑 ${tableName(TABLES[a.seat.table])}` : `🚶 ${FLOOR_NAMES[a.f]}`;
    li.append(n, s);
    // Người đang trong kênh thoại của mình: nút tắt tiếng riêng người đó (chỉ ở máy mình)
    if (a !== meA && voicePeers.has(String(a.id))) {
      const b = document.createElement('button');
      b.className = 'voice-mute';
      b.textContent = voice.isBlocked(String(a.id)) ? '🔇 Đã tắt' : '🔊 Tắt tiếng';
      b.onclick = () => { voice.toggleBlock(String(a.id)); updatePeople(); };
      li.appendChild(b);
    }
    ul.appendChild(li);
  }
}

function loadStats() {
  try { return JSON.parse(localStorage.getItem('nhau3d-stats')) || { sessions: 0, cheers: 0, spent: 0 }; }
  catch { return { sessions: 0, cheers: 0, spent: 0 }; }
}
function saveStats(s) {
  try { localStorage.setItem('nhau3d-stats', JSON.stringify(s)); } catch {}
}

function updateDrunk() {
  state.drunk = clamp(state.drunk, 0, 100);
  meA.d = state.drunk;
  $('drunk-bar').style.width = state.drunk + '%';
  let lvl = 0;
  DRUNK_LEVELS.forEach((l, i) => { if (state.drunk >= l.at) lvl = i; });
  $('drunk-label').textContent = DRUNK_LEVELS[lvl].label;
  $('drunk-pct').textContent = `${Math.round(state.drunk)}%`;
  $('drunk-ico').textContent = DRUNK_LEVELS[lvl].ico;
  const meter = $('drunk-meter');
  meter.dataset.lvl = lvl;
  if (lvl !== state.drunkLevel) { // lên / xuống cấp say: huy hiệu nảy lên
    meter.classList.remove('pop');
    void meter.offsetWidth;
    meter.classList.add('pop');
  }
  if (lvl > state.drunkLevel && DRUNK_LEVELS[lvl].msg) toast(DRUNK_LEVELS[lvl].msg);
  state.drunkLevel = lvl;
}

function setFill(f) {
  state.fill = f;
  meA.person.liquid.scale.y = Math.max(0.001, f);
  meA.person.liquid.visible = f > 0.02;
}

let menuCat = null; // nhóm món đang lọc, null = tất cả
// Thực đơn là danh sách chọn kèm số lượng: bấm món để thêm 1 phần, −/+ để chỉnh (về 0 là bỏ chọn),
// bấm Gọi mới gửi tất cả.
const menuPicks = new Map(); // chỉ số món trong MENU -> số phần
const MENU_MAX_QTY = 10;
const menuPickCount = () => [...menuPicks.values()].reduce((a, b) => a + b, 0);
function menuPickTotal() {
  let total = 0;
  for (const [i, q] of menuPicks) total += MENU[i].price * q;
  return total;
}
function renderMenuDone() {
  const n = menuPickCount();
  $('btn-menu-close').textContent = n ? `✅ Gọi ${n} món · ${fmt(menuPickTotal())}` : 'Xong';
}
function setMenuQty(i, q) {
  q = clamp(q, 0, MENU_MAX_QTY);
  if (q) menuPicks.set(i, q);
  else menuPicks.delete(i);
}
function renderMenu() {
  const cats = $('menu-cats');
  cats.innerHTML = '';
  for (const c of [null, ...MENU_CATS]) {
    const b = document.createElement('button');
    b.textContent = c ?? 'Tất cả';
    b.className = c === menuCat ? 'on' : '';
    b.onclick = () => { menuCat = c; renderMenu(); $('menu-items').parentElement.scrollTop = 0; };
    cats.appendChild(b);
  }
  const wrap = $('menu-items');
  wrap.innerHTML = '';
  MENU.forEach((m, i) => {
    if (menuCat && m.cat !== menuCat) return;
    // Ô món: bấm vào tên món để thêm 1 phần; đã chọn thì hiện bộ đếm − số lượng +
    const item = document.createElement('div');
    item.className = 'menu-item';
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'mi-main';
    main.innerHTML = `<b>${m.icon} ${m.name}</b><small>${fmt(m.price)}</small>`;
    const qty = document.createElement('div');
    qty.className = 'mi-qty';
    const minus = document.createElement('button'), plus = document.createElement('button'), num = document.createElement('span');
    minus.type = plus.type = 'button';
    minus.textContent = '−';
    plus.textContent = '+';
    minus.setAttribute('aria-label', `Bớt ${m.name}`);
    plus.setAttribute('aria-label', `Thêm ${m.name}`);
    qty.append(minus, num, plus);
    item.append(main, qty);
    const sync = () => {
      const q = menuPicks.get(i) || 0;
      item.classList.toggle('picked', q > 0);
      num.textContent = q;
      plus.disabled = q >= MENU_MAX_QTY;
      main.setAttribute('aria-label', `${m.name}, ${q ? `đã chọn ${q} phần` : 'chưa chọn'}`);
      renderMenuDone();
    };
    main.disabled = minus.disabled = !meA?.seat;
    main.onclick = () => { setMenuQty(i, (menuPicks.get(i) || 0) + 1); sync(); };
    plus.onclick = () => { setMenuQty(i, (menuPicks.get(i) || 0) + 1); sync(); };
    minus.onclick = () => { setMenuQty(i, (menuPicks.get(i) || 0) - 1); sync(); };
    sync();
    if (!meA?.seat) plus.disabled = true;
    wrap.appendChild(item);
  });
  renderMenuDone();
}
// Xong: gọi các món đã chọn. Server nhận mỗi người một món mỗi nửa giây nên gửi lần lượt cách nhau 0,6 giây.
function confirmMenu() {
  // Mỗi phần là một lần gọi (2 phần mực = 2 đĩa mực)
  const picks = [...menuPicks].flatMap(([i, q]) => Array(q).fill(i));
  if (picks.length && meA?.seat) {
    if (!canAfford(menuPickTotal())) return;
    picks.forEach((i, k) => setTimeout(() => send({ t: 'order', item: i }), k * 600));
    const first = MENU[picks[0]];
    toast(picks.length === 1 ? `Đã gọi ${first.icon} ${first.name}, bếp làm ngay!` : `Đã gọi ${picks.length} món, bếp làm ngay! 🔥`);
  }
  menuPicks.clear();
  closeModal();
}

// ================= Hành động của mình =================
// Nhảy theo nhạc karaoke: chỉ khi có người đang hát và mình đứng ở tầng có sân khấu.
// Nhảy được ở bất cứ đâu khi đang đứng (người đang cầm mic thì đang hát, không nhảy).
const canDance = () => !!meA && !meA.seat && state.started; // đang hát cũng nhảy được, tay vẫn cầm mic
function toggleDance(on = !meA?.dancing) {
  if (!meA || modal || state.passedOut) return;
  if (on && !canDance()) return toast('Đứng dậy rồi mới nhảy được nhé!');
  if (!!meA.dancing === on) return;
  meA.dancing = on;
  sendAct(on ? 'dance' : 'dance-stop');
  if (on) speak(meA, '💃 quẩy lên!', 1800);
}

let chatTable = -1; // bàn đang có tin nhắn trong khung chat
function onSitMine() {
  if (modal === 'code') closeModal(); // vừa nhập đúng mật mã
  codeFor = null;
  if (meA.dancing) toggleDance(false);
  voiceSeatChanged();
  tableGames.onSeatChanged();
  if (paying) setPaying(false); // đang đi thanh toán mà bấm E ngồi lại bàn thì thôi
  pourPending = false;
  updateBillButton();
  moveTarget = pending = null;
  state.fill = 0;
  setFill(0);
  cam.yaw = meA.yaw + Math.PI;
  atStartView = false;
  if (TABLES[meA.seat.table].private) {
    // Phòng riêng: nhìn từ trên cao, lùi ra cho thấy cả phòng (tường phòng tự mờ, xem fadeRoomWalls).
    cam.pitch = 0.95;
    cam.dist = 5.5;
  } else {
    cam.pitch = 0.5;
    cam.dist = Math.min(cam.dist, 3);
  }
  const T = TABLES[meA.seat.table];
  if (T === chuBaTable) setTimeout(() => speak(chuBa, 'Ngồi đây con, uống với chú ly rượu.'), 400);
  toast(`Đã ngồi ${tableName(T)} · 1 dzô · 5 gọi mồi`);
  // Ngồi lại đúng bàn vừa rời thì giữ tin nhắn cũ.
  if (chatTable !== T.id) $('chat-log').innerHTML = '';
  else addChatLine(null, `Đã quay lại ${tableName(T)}. Lúc vắng mặt bạn không nhận được tin nhắn.`);
  chatTable = T.id;
  setChatScope('table');
  renderLockButton();
}

// Hai kênh: 'table' (cùng bàn) và 'all' (cả quán). Tin đến kênh đang ẩn thì hiện chấm đỏ trên tab.
let chatScope = 'all';
function setChatScope(scope) {
  if (scope === 'table' && !meA?.seat) scope = 'all';
  chatScope = scope;
  for (const s of ['table', 'all']) {
    const tab = $(`chat-tab-${s}`);
    tab.classList.toggle('on', s === scope);
    tab.setAttribute('aria-selected', s === scope);
    if (s === scope) setBadge(tab, 0);
  }
  $('chat-log').classList.toggle('hidden', scope !== 'table');
  $('chat-log-all').classList.toggle('hidden', scope !== 'all');
  // Điện thoại không có phím Enter/E nên gợi ý ngắn gọn
  $('chat-input').placeholder = matchMedia('(max-width: 900px), (max-height: 500px)').matches
    ? (scope === 'all' ? 'Nhắn cả quán…' : 'Nhắn cả bàn…')
    : scope === 'all' ? 'Enter để chat với cả quán' : 'Enter để chat với cả bàn · E đứng dậy';
  const log = scope === 'all' ? $('chat-log-all') : $('chat-log');
  log.scrollTop = log.scrollHeight;
}
for (const s of ['table', 'all']) {
  $(`chat-tab-${s}`).onclick = (e) => {
    setChatScope(s);
    e.currentTarget.blur(); // trả phím về cho game
  };
}

// Khung chat đóng/mở được: thu gọn thành nút 💬 (có số tin chưa đọc), bấm mới mở, ✕ để thu lại.
const chatMQ = matchMedia('(max-width: 900px), (max-height: 500px)');
let chatCollapsed = true; // mặc định đóng chat, bấm 💬 hoặc Enter để mở
const chatFolded = () => chatCollapsed;
// Số tin chưa đọc trên nút (thay cho chấm đỏ); add = true thì cộng dồn.
function setBadge(btn, n, add = false) {
  const b = btn.querySelector('.badge');
  const v = add ? (Number(b.dataset.n) || 0) + n : n;
  b.dataset.n = v;
  b.textContent = v > 99 ? '99+' : v;
  b.classList.toggle('hidden', !v);
}
function applyChatLayout() {
  const chat = $('chat'), btn = $('chat-toggle');
  chat.classList.toggle('collapsed', chatFolded());
  btn.setAttribute('aria-expanded', !chatFolded());
  if (!chatFolded()) {
    setBadge(btn, 0);
    const log = chatScope === 'all' ? $('chat-log-all') : $('chat-log');
    log.scrollTop = log.scrollHeight;
  }
}
function setChatOpen(open) {
  chatCollapsed = !open;
  if (!open) $('chat-input').blur(); // thu gọn chat thì trả phím về cho game
  applyChatLayout();
}
$('chat-toggle').onclick = (e) => {
  setChatOpen(true);
  e.currentTarget.blur();
};
$('chat-close').onclick = (e) => { // ‹ ở mép khung chat: thu gọn lại thành nút 💬
  setChatOpen(false);
  e.currentTarget.blur();
};
chatMQ.addEventListener('change', applyChatLayout);
applyChatLayout();

function addChatLine(name, text, scope = 'table') {
  // Tin cả quán lúc đang ngồi bàn: hiện luôn trong tab Bàn, có nhãn [Cả quán] (tab 🌐 vẫn giữ đủ tin).
  const mirror = scope === 'all' && name && meA?.seat;
  const seen = scope === chatScope || (mirror && chatScope === 'table');
  const other = name && name !== 'Bạn'; // tin của chính mình không tính là chưa đọc
  if (!seen && other) setBadge($(`chat-tab-${scope}`), 1, true);
  if (chatFolded() && other) setBadge($('chat-toggle'), 1, true);
  appendChatLine(scope === 'all' ? $('chat-log-all') : $('chat-log'), name, text);
  if (mirror) appendChatLine($('chat-log'), name, text, true);
}
function appendChatLine(log, name, text, fromAll = false) {
  const line = document.createElement('div');
  if (name) {
    if (fromAll) {
      const tag = document.createElement('span');
      tag.className = 'ch-all';
      tag.textContent = '[Cả quán]';
      line.appendChild(tag);
    }
    const b = document.createElement('b');
    b.textContent = name + ': ';
    line.append(b, text);
  } else {
    line.className = 'sys';
    line.textContent = text;
  }
  log.appendChild(line);
  while (log.children.length > 30) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('chat-input');
  const text = input.value.trim();
  if (text && chatScope === 'all') send({ t: 'chat', scope: 'all', text: text.slice(0, CHAT_MAX) });
  else if (text && meA?.seat) send({ t: 'chat', text: text.slice(0, CHAT_MAX) });
  input.value = '';
  // Gửi xong vẫn ở trong ô chat để nhắn tiếp; Enter khi ô trống, Esc, bấm ra ngoài hoặc đóng chat mới trả phím về game.
  if (!text) input.blur();
  else input.focus();
});
$('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.target.value = '';
    e.target.blur();
  }
});
function onStandMine(T) {
  voiceSeatChanged();
  tableGames.onSeatChanged();
  const dx = meA.x - T.x, dz = meA.z - T.z, d = Math.hypot(dx, dz) || 1;
  placeAt(meA, T.x + (dx / d) * 1.75, T.z + (dz / d) * 1.75);
  busy = null;
  updateBillButton();
  renderLockButton();
  setChatScope('all');
  if (payTrip) payTripWalk();
}

// Nút 💸 chỉ hiện khi đang ngồi ở bàn đã gọi mồi mà chưa ai trả (kể cả mồi do người khác trong bàn gọi).
function billPayable() {
  const tab = meA?.seat ? tabs[meA.seat.table] : null;
  return !!(tab?.items.length && !tab.paidBy);
}
function updateBillButton() {
  $('btn-bill').classList.toggle('hidden', !billPayable());
}

// Thanh toán xong: đứng dậy, tự đi tới quầy thu ngân (ở tầng trên thì đi thang máy xuống),
// chị chủ thu tiền cảm ơn, rồi tự đi ra khỏi quán. Trong lúc đó (paying) không đổi được hướng đi
// (bấm chỗ khác, phím di chuyển); các thao tác khác vẫn dùng bình thường.
const CASHIER_SPOT = { x: 4.8, z: -1.7 };
// Chỗ đứng lúc mới vào game (vỉa hè trước quán, quay mặt vào quán); trả tiền xong ra đứng lại đây.
const SPAWN = { z: 2.6, yaw: Math.PI };
const spawnSpot = () => ({ x: Math.random() * 2 - 1, z: SPAWN.z });
let payTrip = null; // { total }
let paying = false, payingTimer = null, payPause = false; // payPause: đang đứng trả tiền ở quầy
function setPaying(on) {
  paying = on;
  clearTimeout(payingTimer);
  // Phòng khi kẹt đường không tới được nơi: quá 90 giây thì trả lại quyền điều khiển.
  if (on) payingTimer = setTimeout(() => setPaying(false), 90000);
}
function startPayTrip(total) {
  // Đã gục thì không đi ra quầy được: ở lại hoá đơn (giờ ghi "đã thanh toán"), còn nút về nhà.
  if (state.passedOut) {
    toast(`💸 Bạn đã thanh toán ${fmt(total)} cho cả bàn.`);
    return showBill();
  }
  if (modal === 'bill') closeModal();
  payTrip = { total };
  setPaying(true);
  if (meA.seat) send({ t: 'stand' }); // đứng dậy xong (onStandMine) mới đi
  else payTripWalk();
}
function walkThen(spot, range, action) {
  pending = { pos: () => spot, range, action };
  walkTo(spot.x, spot.z);
}
function payTripWalk() {
  const trip = payTrip;
  payTrip = null;
  if (!trip) return;
  if (meA.f !== 0) {
    toast('💸 Xuống quầy thu ngân thanh toán…');
    walkThen({ x: ELEVATOR.x, z: ELEVATOR.doorZ + 0.7 }, 0.8, async () => {
      await rideElevator(0);
      payTrip = trip;
      payTripWalk();
    });
    return;
  }
  toast('💸 Ra quầy thu ngân thanh toán…');
  walkThen(CASHIER_SPOT, 0.5, () => {
    payPause = true;
    meA.yaw = Math.PI; // quay vào quầy
    speak(meA, '💸 Tính tiền em ơi!', 1800);
    setTimeout(() => {
      dingSound();
      speak(owner, `Của em ${fmt(trip.total)}, cảm ơn em nha! 🙏`, 3000);
      toast(`💸 Bạn đã thanh toán ${fmt(trip.total)} cho cả bàn. Hào phóng quá!`);
    }, 900);
    setTimeout(() => {
      payPause = false;
      if (!paying) return;
      walkThen(spawnSpot(), 0.25, () => {
        meA.yaw = SPAWN.yaw;
        setPaying(false);
        toast('👋 Thanh toán xong rồi, về nhà an toàn nhé!');
      });
    }, 2600);
  });
}

// ---------- Đổi tầng, nhà vệ sinh, phòng riêng ----------
// ---------- Thang máy ----------
let riding = false;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
function openFloorPicker(title, floorsToShow, onPick) {
  if (!meA || meA.seat || riding || state.passedOut) return;
  $('elevator-title').textContent = title;
  $('btn-elevator-close').textContent = onPick === rideElevator ? 'Thôi, đi bộ' : 'Đóng';
  const wrap = $('elevator-floors');
  wrap.innerHTML = '';
  FLOOR_NAMES.forEach((name, f) => {
    if (!floorsToShow.includes(f)) return;
    const b = document.createElement('button');
    const arrow = f > meA.f ? '⬆ ' : f < meA.f ? '⬇ ' : '';
    b.innerHTML = `<b>${f + 1}</b><span>${arrow}${name.replace(/^Tầng \d · ?/, '') || 'Tầng trệt'}</span>`;
    b.className = 'lift-btn' + (f === meA.f ? ' here' : '');
    b.disabled = f === meA.f;
    b.onclick = () => { closeModal(); onPick(f); };
    wrap.appendChild(b);
  });
  $('elevator-here').textContent = `Bạn đang ở ${FLOOR_NAMES[meA.f]}`;
  openModal('elevator');
}
const openElevator = () => openFloorPicker('🛗 Thang máy', [0, 1, 2], rideElevator);

async function rideElevator(target) {
  if (riding || !meA || target === meA.f) return;
  riding = true;
  if (meA.dancing) toggleDance(false);
  moveTarget = pending = null;
  marker.visible = false;
  const from = meA.f, inside = { x: ELEVATOR.x, z: ELEVATOR.z };
  // Mở cửa, bước vào cabin, quay mặt ra cửa, đóng cửa
  elevatorDoors[from].target = 1;
  dingSound();
  await sleep(700);
  placeAt(meA, inside.x, inside.z, 0, from); // đứng trong cabin, quay mặt ra cửa
  cam.yaw = 0;
  atStartView = false;
  await sleep(400);
  elevatorDoors[from].target = 0;
  await sleep(700);
  // Thang chạy: tiếng máy ù ù, mờ màn hình một chút rồi sang tầng mới
  noiseHit(1.6, 180, 0.25, 'lowpass');
  const fade = $('fade');
  fade.style.transition = 'opacity .4s';
  fade.style.opacity = 0.55;
  toast(`🛗 ${target > from ? 'Đang lên' : 'Đang xuống'} ${FLOOR_NAMES[target]}…`);
  await sleep(500 + Math.abs(target - from) * 500);
  placeAt(meA, inside.x, inside.z, 0, target);
  camTarget.set(inside.x, target * FLOOR_H + 1.45, inside.z);
  fade.style.opacity = state.passedOut ? 1 : 0;
  await sleep(400);
  fade.style.transition = '';
  // Đến nơi: ding, mở cửa, bước ra
  dingSound();
  elevatorDoors[target].target = 1;
  await sleep(700);
  placeAt(meA, ELEVATOR.x, ELEVATOR.doorZ + 0.7, 0, target);
  cam.yaw = 0; // camera đứng đón phía trước người vừa bước ra
  atStartView = false;
  toast(`📍 ${FLOOR_NAMES[target]}`);
  await sleep(600);
  elevatorDoors[target].target = 0;
  riding = false;
}

let lastRefresh = -Infinity;
function refresh(kind) {
  if (state.passedOut) return;
  const now = performance.now();
  if (now - lastRefresh < 20000) return toast('Vừa đi xong mà, từ từ đã 😅');
  lastRefresh = now;
  state.drunk -= 8;
  updateDrunk();
  noiseHit(1.2, 2500, 0.1);
  toast('Rửa mặt nước lạnh, tỉnh hẳn ra 💦');
}

// Bước vào buồng / đứng trước bồn tiểu là tự giải quyết: khoá di chuyển vài giây rồi trả lại.
let wcBusy = false, wcZone = null;
function useFixture(fx) {
  if (state.passedOut || wcBusy) return;
  const now = performance.now();
  if (now - lastRefresh < 20000) return toast('Vừa đi xong mà, từ từ đã 😅');
  lastRefresh = now;
  wcBusy = true;
  moveTarget = pending = null;
  marker.visible = false;
  if (meA.dancing) toggleDance(false);
  placeAt(meA, fx.x, fx.z, fx.yaw);
  const stall = fx.kind === 'stall';
  if (stall) {
    setSeated(meA.person, true);
    meA.person.cup.visible = false;
    speak(meA, '🚽 …', 2800);
  } else {
    speak(meA, '💦', 2300);
    noiseHit(2.2, 3200, 0.05, 'bandpass'); // tiếng róc rách
  }
  setTimeout(() => {
    noiseHit(1.6, 500, 0.2, 'lowpass'); // tiếng xả nước
    if (stall) {
      setSeated(meA.person, false);
      placeAt(meA, fx.out.x, fx.out.z, fx.yaw);
    }
    state.drunk -= stall ? 12 : 10;
    updateDrunk();
    toast('Nhẹ cả người 😌 (độ say giảm)');
    wcBusy = false;
  }, stall ? 3200 : 2600);
}
// Gọi mỗi khung hình: chỉ kích hoạt khi vừa bước vào một chỗ mới, đứng yên trong đó không lặp lại.
function updateWC() {
  if (!meA || meA.seat || wcBusy) return;
  const fx = wcFixtures.find((x) => x.f === meA.f && inRect(x.zone, meA.x, meA.z)) || null;
  if (fx && fx !== wcZone) useFixture(fx);
  wcZone = fx;
}

function renderLockButton() {
  const b = $('btn-lock');
  const T = meA?.seat ? TABLES[meA.seat.table] : null, st = T && roomState.get(T.id);
  const show = !!(T?.private && st?.owner === myId);
  b.classList.toggle('hidden', !show);
  if (show) b.textContent = st.locked ? '🔓 Mở khoá phòng' : '🔒 Khoá phòng';
}
// Mật mã 4 số: chủ phòng đặt khi khoá; người ngoài gõ cửa rồi nhập đúng mới vào được.
let codeFor = null; // { mode: 'lock' | 'enter', table, idx }
function askCode(mode, table, idx) {
  codeFor = { mode, table, idx };
  const T = TABLES[table];
  $('code-title').textContent = mode === 'lock' ? '🔒 Khoá phòng' : `🚪 ${T.name} đang khoá`;
  $('code-sub').textContent = mode === 'lock'
    ? 'Đặt mật mã 4 chữ số. Ai biết mật mã mới vào được, nhân viên phục vụ vẫn vào bình thường.'
    : 'Cốc cốc! Đã gõ cửa. Nhập mật mã 4 số chủ phòng đặt để vào.';
  $('code-msg').textContent = '';
  $('code-input').value = '';
  $('btn-code-ok').textContent = mode === 'lock' ? '🔒 Khoá' : '🔑 Vào phòng';
  openModal('code');
  setTimeout(() => $('code-input').focus(), 50);
}
function submitCode() {
  if (!codeFor) return closeModal();
  const code = $('code-input').value.trim();
  if (!/^\d{4}$/.test(code)) {
    $('code-msg').textContent = 'Mật mã gồm đúng 4 chữ số';
    return shakeCode();
  }
  if (codeFor.mode === 'lock') {
    send({ t: 'room-lock', locked: true, code });
    closeModal();
  } else {
    send({ t: 'sit', table: codeFor.table, idx: codeFor.idx, code });
    $('code-msg').textContent = 'Đang mở cửa…';
  }
}
function shakeCode() {
  const p = $('overlay-code').querySelector('.panel');
  p.classList.remove('shake');
  void p.offsetWidth;
  p.classList.add('shake');
}
$('code-input').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCode(); if (e.key === 'Escape') closeModal(); });
$('btn-code-ok').onclick = submitCode;
$('btn-code-cancel').onclick = closeModal;
function knockSound() {
  for (let i = 0; i < 3; i++) setTimeout(() => noiseHit(0.08, 700, 0.5, 'lowpass'), i * 170);
}
$('btn-lock').onclick = () => {
  const st = roomState.get(meA?.seat?.table);
  if (!st) return;
  if (st.locked) send({ t: 'room-lock', locked: false });
  else askCode('lock', meA.seat.table);
};

// Ở trong nhà thì ẩn các tầng phía trên và tường mặt tiền tầng đang đứng (kiểu cắt lớp như The Sims).
// Tên khu vực ở tầng 1 theo khoảng cách ra biển (xem SHORE trong world.js).
function outdoorArea(z) {
  if (z < BUILDING.maxZ) return 'Trong nhà';
  if (z < SHORE.curbZ) return 'Vỉa hè';
  if (z < SHORE.roadMaxZ) return 'Đang qua đường';
  if (z < SHORE.wallZ) return 'Đường đi bộ ven biển';
  if (z < SEA_Z - 0.4) return 'Bãi biển';
  return 'Mép nước';
}
// Lội ra mép nước: báo một lần mỗi lần xuống nước, kèm tiếng sóng vỗ.
let inWater = false;
function updateWading() {
  if (!meA || meA.f !== 0) return;
  const wet = meA.z > SEA_Z - 0.4;
  if (wet && !inWater) {
    noiseHit(1.4, 900, 0.15, 'lowpass');
    toast('🌊 Nước biển mát rượi, tỉnh cả người!');
  }
  inWater = wet;
}
let lastWhere = '', heardKey = ''; // heardKey: tầng + độ xa phía biển lúc cập nhật âm lượng gần nhất
function updateVisibility() {
  const f = meA?.f ?? 0;
  const inside = !!meA && state.started && (f > 0 || meA.rz < BUILDING.maxZ - 0.1);
  floors.forEach((g, i) => (g.visible = !inside || i <= f));
  facade.forEach((list, i) => list.forEach((m) => (m.visible = !(inside && i === f))));
  for (const a of [...allActors(), ...npcs]) a.person.root.visible = floors[a.f].visible;
  if (!meA) return;
  const T = meA.seat ? TABLES[meA.seat.table] : null;
  const where = T ? `🪑 ${T.name} · ${FLOOR_NAMES[T.floor]}`
    : `📍 ${FLOOR_NAMES[f]}${f === 0 ? ` · ${outdoorArea(meA.rz)}` : ''}`;
  if (where !== lastWhere) $('where').textContent = lastWhere = where;
}

function interact() {
  if (modal || state.passedOut || mic.singer === myId || riding || wcBusy) return;
  if (meA.seat) { askStand(); return; }
  if (focus) focus.action();
}

// Hỏi lại trước khi đứng dậy, vì bấm nhầm là mất hết tin nhắn của bàn.
let afterStand = null;
function askStand(then = null) {
  afterStand = then;
  const T = TABLES[meA.seat.table], tab = tabs[T.id];
  // Mình là người cuối cùng của bàn mà bàn chưa trả: nhắc thanh toán, hoặc đi một lát (quán giữ chỗ).
  const last = !allActors().some((a) => !isMe(a) && a.seat?.table === T.id);
  const unpaid = net.online && last && !tab.paidBy && tabTotal(T, tab) > 0;
  $('leave-msg').textContent = unpaid
    ? `${tableName(T)} còn ${fmt(tabTotal(T, tab))} chưa thanh toán. Đi một lát thì quán giữ chỗ 3 phút; quá giờ chưa ai trả thì ai gọi món nấy tự trả (ví không đủ thì ghi sổ nợ).`
    : `Đứng dậy khỏi ${tableName(T)} thì sẽ không thấy tin nhắn của bàn nữa.`;
  $('btn-leave-go').textContent = unpaid ? '🚶 Đi một lát' : 'Rời bàn';
  $('btn-leave-pay').classList.toggle('hidden', !unpaid);
  openModal('leave');
}
$('btn-leave-pay').onclick = () => {
  closeModal();
  afterStand = null;
  send({ t: 'pay' }); // trả xong (paid) thì tự ra quầy rồi đi về, xem startPayTrip
};

// Bàn trống còn nợ đang được giữ chỗ: biển "Đang giữ chỗ" trên bàn.
const holds = new Map(); // id bàn -> { until, sign }
function setHold(table, until) {
  const old = holds.get(table);
  if (old) { old.sign.parent?.remove(old.sign); holds.delete(table); }
  if (!until) return;
  const T = TABLES[table];
  const tex = canvasTexture(512, 112, (g, w, h) => {
    g.fillStyle = '#ffecb3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8d6e63';
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#4e342e';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🪧 Đang giữ chỗ', w / 2, h / 2 + 2);
  });
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sign.scale.set(1.3, 0.28, 1);
  sign.position.set(T.x, 1.25, T.z);
  floors[T.floor].add(sign);
  holds.set(table, { until, sign });
}
function confirmStand(go) {
  closeModal();
  const then = afterStand;
  afterStand = null;
  if (!go || !meA.seat) return;
  send({ t: 'stand' });
  then?.();
}
$('btn-leave-stay').onclick = () => confirmStand(false);
$('btn-leave-go').onclick = () => confirmStand(true);

function sendAct(k, extra) {
  send({ t: 'act', k, ...extra });
}

// Dzô gộp luôn việc rót: hỏi server ai trong bàn còn ly rỗng; có thì em rót bia tới rót cho những người đó,
// rót xong cả bàn mới hô dzô (xem pourRound). Ly ai cũng đầy thì dzô ngay.
let dzoWaiting = null; // { timer } đang chờ rót xong mới dzô
function cheers() {
  if (modal || state.passedOut) return;
  if (!meA.seat) return toast('Phải ngồi vào bàn mới dzô được!');
  if (busy || dzoWaiting) return;
  if (!net.online) return doCheers();
  dzoWaiting = { timer: setTimeout(finishDzoWait, 1500) }; // server chưa trả lời (bản cũ) thì dzô luôn
  send({ t: 'pour-round', cheers: true });
}
function finishDzoWait() {
  if (!dzoWaiting) return;
  clearTimeout(dzoWaiting.timer);
  dzoWaiting = null;
  if (meA.seat && !state.passedOut) doCheers();
}
function doCheers() {
  if (busy) return;
  if (!refill()) return;
  sendAct('cheers');
  onAnyAct(meA, 'cheers');
  // Ngồi uống một mình thì khỏi hò dzô, uống luôn.
  const solo = !tableMates().length;
  if (!solo) {
    dzoCount(meA);
    dzoCallSound();
  }
  drinkUp(solo);
  tableCheers(meA);
}
// Không ai khác (kể cả NPC) ngồi cùng bàn với a
const aloneAt = (a) => ![...allActors(), ...npcs].some((o) => o !== a && a.seat && o.seat?.table === a.seat.table);

// Một người dzô là cả bàn cùng nâng ly (mỗi máy tự diễn cho bàn của người đó).
function tableCheers(by) {
  const table = by.seat?.table;
  if (table === undefined) return;
  for (const o of [...allActors(), ...npcs]) {
    if (o === by || o.seat?.table !== table) continue;
    if (o === meA) joinCheers();
    else cheersLater(o);
  }
  if (table === chuBaTable.id) setTimeout(() => speak(chuBa, pick(LINES.chuBaCheers)), 200);
}
function joinCheers() {
  if (state.passedOut || busy) return;
  if (!refill()) { playAct(meA, 'cheers'); return; } // hết tiền rót thì nâng ly không
  drinkUp();
}
// Ly rỗng thì tự rót đầy trước khi dzô (server tính vào hoá đơn bàn).
function refill() {
  if (state.fill >= 0.5) return true;
  if (pourPending) { fillMine(); return true; } // em rót bia đang tới, ly này đã tính tiền rồi
  if (!canAfford(drinkOf(meA.seat.table).price)) return false;
  setFill(0.95);
  send({ t: 'refill' });
  pourSound();
  return true;
}

// ================= Ví tiền, câu cá, nhặt đồ trên bãi =================
let wallet = { money: START_MONEY, bag: [] };
const walletChip = $('btn-wallet');
function renderWallet() {
  $('money').textContent = fmt(wallet.money);
  $('bag-count').textContent = wallet.bag.length;
  $('debt-chip').classList.toggle('hidden', !wallet.debt);
  $('debt').textContent = fmt(wallet.debt || 0);
  walletChip.classList.toggle('broke', wallet.money < 20000 || wallet.debt > 0);
  if (modal === 'bag') renderBag();
}
// Kiểm tra trước ở máy mình (server vẫn kiểm tra lại): ví phải đủ trả hoá đơn bàn đang nợ cộng món mới.
function canAfford(extra) {
  if (net.online && wallet.debt > 0) { toast(`📒 Còn nợ quán ${fmt(wallet.debt)}, ra quầy thu ngân trả nợ rồi gọi tiếp nhé!`); return false; }
  if (!net.online || !meA?.seat) return true;
  const T = TABLES[meA.seat.table], tab = tabs[T.id];
  const need = (tab.paidBy ? 0 : tabTotal(T, tab)) + extra;
  if (wallet.money >= need) return true;
  toast(`💸 Ví còn ${fmt(wallet.money)}, chưa đủ ${fmt(need)} (gồm cả hoá đơn bàn). Ra biển câu cá, nhặt ốc kiếm thêm nhé!`);
  return false;
}
walletChip.onclick = () => !modal && openBag();

function openBag() {
  renderBag();
  openModal('bag');
}
function renderBag() {
  $('bag-money').textContent = fmt(wallet.money);
  const canSell = !net.online || (meA && nearTrader(meA));
  $('btn-sell-all').disabled = !canSell || !wallet.bag.length;
  $('bag-hint').textContent = canSell
    ? '🧺 Bà Tư thu mua hết: cá, cua, ốc, vỏ sò, chai. Cá hiếm được giá cao.'
    : '🧺 Muốn bán thì mang ra sạp Bà Tư (chân bậc xuống biển).';
  const list = $('bag-list');
  list.innerHTML = '';
  const counts = {};
  for (const k of wallet.bag) counts[k] = (counts[k] || 0) + 1;
  const kinds = Object.keys(counts).sort((a, b) => (ITEMS[b]?.price || 0) - (ITEMS[a]?.price || 0));
  if (!kinds.length) list.innerHTML = '<p class="small">Giỏ trống trơn. Ra bãi biển nhặt đồ hoặc câu cá nhé!</p>';
  for (const k of kinds) {
    const it = ITEMS[k];
    if (!it) continue;
    const row = document.createElement('div');
    row.className = 'bag-row';
    row.innerHTML = `<span class="ico">${it.icon}</span><span class="info"><b>${it.name} ×${counts[k]}</b><small>${it.junk ? 'Đồ bỏ đi' : `Bán ${fmt(it.price)}/con`}${it.rare ? ' · cá hiếm' : ''}</small></span>`;
    const btn = (text, fn, disabled) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.disabled = !!disabled;
      b.onclick = fn;
      row.appendChild(b);
    };
    if (it.bottle) btn('📜 Mở chai', () => send({ t: 'open-bottle' }));
    btn(it.junk ? '🗑️ Bỏ' : it.rare ? `💰 Bán ${fmt(it.price)}` : '💰 Bán', () => send({ t: 'sell', k }), !canSell);
    list.appendChild(row);
  }
}
$('btn-sell-all').onclick = () => send({ t: 'sell', all: true });
$('btn-bag-close').onclick = closeModal;

// Lời nhắn trong chai
$('btn-bottle-send').onclick = () => {
  const text = $('bottle-reply').value.trim();
  if (!text) return $('bottle-reply').focus();
  send({ t: 'write-note', text });
  $('bottle-reply').value = '';
  closeModal();
};
$('btn-bottle-close').onclick = closeModal;

// Đồ trôi dạt trên bãi: server rải vài phút một lần, ai đến trước nhặt trước.
const beachItems = new Map(); // id -> { it, group, hit }
function setBeach(list) {
  const keep = new Set(list.map((x) => x.id));
  for (const [id, b] of beachItems) if (!keep.has(id)) {
    unclickable(b.hit);
    F1.remove(b.group);
    beachItems.delete(id);
  }
  for (const it of list) {
    if (beachItems.has(it.id) || !ITEMS[it.k]) continue;
    const group = new THREE.Group();
    group.position.set(it.x, 0, it.z);
    const sprite = emojiSprite(ITEMS[it.k].icon, 0.55);
    sprite.position.y = 0.35;
    group.add(sprite);
    const shadow = add(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }), 0, 0.02, 0, group);
    shadow.rotation.x = -Math.PI / 2;
    const hit = clickable(add(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 8), HIT_MAT, 0, 0.45, 0, group), {
      f: 0,
      pos: () => it,
      range: 1.6,
      label: () => `nhặt ${ITEMS[it.k].icon} <b>${ITEMS[it.k].name}</b>`,
      action: () => send({ t: 'pickup', id: it.id }),
    });
    F1.add(group);
    beachItems.set(it.id, { it, group, sprite, hit, phase: Math.random() * 6 });
  }
}
function updateBeachItems(t) {
  for (const b of beachItems.values()) b.sprite.position.y = 0.35 + Math.sin(t * 2 + b.phase) * 0.06;
}

// Câu cá: chờ cá cắn câu, rồi vạch chạy qua lại; giật đúng lúc vạch nằm trong vùng xanh thì kéo được cá to.
const canFish = () => !!meA && state.started && !meA.seat && meA.f === 0 && meA.rz >= FISH_ZONE_Z - 0.5 && !state.passedOut;
const fishGame = { phase: 'idle', t: 0, pos: 0, dir: 1, speed: 1, zone: 0.4, width: 0.18, timer: 0, lastCast: 0 };
function startFishing() {
  if (!canFish()) return toast('Ra sát mép nước rồi mới câu được nhé 🌊');
  if (!net.online) return toast('Cần kết nối với quán mới câu cá được');
  openModal('fish');
  $('hud').classList.add('fishing');
  moveTarget = pending = null;
  meA.yaw = 0; // quay mặt ra biển
  // Góc máy mở đầu: chéo sau lưng bên trái, nhìn ra phao (người chơi xoay tiếp tuỳ ý)
  fishGame.camBefore = { ...cam };
  Object.assign(cam, { yaw: Math.PI + 0.5, pitch: 0.42, dist: 5.2 });
  meA.fixedArms = -1.4;
  speak(meA, '🎣 thả câu…', 2000);
  castLine();
}
// Thời gian chờ cá cắn: lúc nhanh lúc chậm như câu thật (đôi khi vừa thả đã dính, đôi khi đợi cả chục giây).
function biteDelay() {
  const r = Math.random();
  return r < 0.2 ? 0.8 + Math.random() * 1.5 : r < 0.75 ? 2.5 + Math.random() * 3.5 : 6 + Math.random() * 6;
}
function castLine() {
  clearTimeout(fishGame.recast);
  const cooldown = Math.max(0, 4000 - (Date.now() - fishGame.lastCast)) / 1000; // server cho mỗi 4 giây một lần
  // Mỗi lần thả cần là một khoảng giật mới: vị trí và độ rộng vùng xanh ngẫu nhiên (hẹp thì khó hơn).
  const width = 0.1 + Math.random() * 0.14;
  Object.assign(fishGame, { phase: 'wait', t: 0, pos: 0, width, zone: 0.05 + Math.random() * (0.9 - width), biteAt: performance.now() + Math.max(cooldown, biteDelay()) * 1000 });
  $('fish-zone').style.left = `${fishGame.zone * 100}%`;
  $('fish-zone').style.width = `${width * 100}%`;
  $('fish-bar').classList.add('idle');
  $('fish-status').textContent = '🌊 Thả cần… chờ cá cắn câu';
}
function updateFishGame(dt) {
  if (modal !== 'fish') return;
  const g = fishGame;
  // Đếm theo đồng hồ thật (máy yếu ít khung hình vẫn đúng giờ)
  if (g.phase === 'wait' && performance.now() >= g.biteAt) {
    Object.assign(g, { phase: 'bite', t: 0, pos: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, speed: 0.7 + Math.random() * 0.8 });
    $('fish-bar').classList.remove('idle');
    $('fish-status').textContent = '❗ Cá cắn câu! Giật cần đi!';
    dingSound();
  }
  if (g.phase === 'bite') {
    g.t += dt;
    g.pos += g.dir * g.speed * dt;
    if (g.pos > 1) { g.pos = 1; g.dir = -1; }
    if (g.pos < 0) { g.pos = 0; g.dir = 1; }
    if (g.t > 5) strikeFish(); // để lâu quá cá ăn mồi rồi bỏ đi
  }
  $('fish-mark').style.left = `${g.pos * 100}%`;
}
function strikeFish() {
  const g = fishGame;
  if (g.phase === 'wait') {
    $('fish-status').textContent = '😅 Giật sớm quá, cá chưa cắn! Chờ chút…';
    g.biteAt += 1000;
    return;
  }
  if (g.phase !== 'bite') return;
  // Trong vùng xanh: 0.7–1 (giữa vùng là chuẩn nhất); lệch ra ngoài thì giảm nhanh.
  const half = g.width / 2, d = Math.abs(g.pos - (g.zone + half));
  const power = g.t > 5 ? 0 : d <= half ? 1 - (0.3 * d) / half : Math.max(0, 0.7 - (d - half) * 3);
  g.phase = 'pull';
  g.lastCast = Date.now();
  send({ t: 'fish', power: +power.toFixed(2) });
  $('fish-status').textContent = power >= 0.7 ? '💪 Chuẩn! Đang kéo lên…' : '🎣 Đang kéo…';
}
// Câu xong một con: hiện tên và mô tả, rồi tự thả cần lại (không cần bấm), tới khi bấm Nghỉ câu.
function showCatch(k) {
  if (modal !== 'fish') return;
  fishGame.phase = 'done';
  const it = k && ITEMS[k];
  $('fish-status').textContent = it ? `${it.rare ? '🎉 ' : ''}${it.icon} ${it.name}${it.junk ? '' : ` · ${fmt(it.price)}`}` : '💦 Sổng mất rồi!';
  $('fish-result').textContent = it ? it.desc : 'Lần sau giật đúng lúc vạch nằm trong vùng xanh nhé.';
  if (it) speak(meA, `${it.icon} ${it.junk ? 'vớt được dép 😂' : it.name + '!'}`, 2500);
  fishGame.recast = setTimeout(() => { if (modal === 'fish' && canFish()) castLine(); }, 1800);
}
// Server từ chối (giỏ đầy, đứng xa nước…) thì dừng lại cho người chơi xử lý.
function fishRefused(msg) {
  if (modal !== 'fish' || fishGame.phase !== 'pull') return;
  fishGame.phase = 'done';
  $('fish-status').textContent = '✋ Tạm dừng câu';
  $('fish-result').textContent = msg;
}
function stopFishing() {
  clearTimeout(fishGame.recast);
  endCatch();
  if (fishGame.camBefore) { Object.assign(cam, fishGame.camBefore); fishGame.camBefore = null; }
  $('hud').classList.remove('fishing');
  fishGame.phase = 'idle';
  if (meA) meA.fixedArms = 0;
  closeModal();
}
// ---------- Cần câu, phao và đoạn phim kéo cá lên ----------
// Lúc câu: cần trên tay, dây nối xuống phao ngoài nước. Giật cần xong (server báo kết quả) thì chiếu đoạn
// phim ngắn: cần bật lên, nước bắn tung, con cá bay vòng cung lên treo lủng lẳng đầu dây, camera quay cận.
const rod = new THREE.Group();
cyl(0.012, 0.024, 1.8, 0x4e342e, 0, 0.9, 0, rod);
cyl(0.035, 0.035, 0.06, 0x212121, 0, 0.35, 0.03, rod).rotation.x = Math.PI / 2; // ống cuộn dây
const fishLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
fishLine.frustumCulled = false;
const bobber = new THREE.Group();
ball(0.06, 0xff3d00, 0, 0.03, 0, bobber);
ball(0.035, 0xffffff, 0, 0.09, 0, bobber);
scene.add(rod, fishLine, bobber);
rod.visible = fishLine.visible = bobber.visible = false;
const ROD_TIP = new THREE.Vector3(0, 1.8, 0);
const rodTip = new THREE.Vector3(), bobberPos = new THREE.Vector3(), fishPos = new THREE.Vector3();
// Nước bắn và kim tuyến: một hệ hạt dùng chung
const SPLASH_N = 90;
const splash = (() => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPLASH_N * 3).fill(-999), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPLASH_N * 3).fill(1), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, pos: geo.attributes.position, col: geo.attributes.color, vel: new Float32Array(SPLASH_N * 3), life: new Float32Array(SPLASH_N), i: 0 };
})();
function burst(at, n, { speed = 2.5, up = 3, colors = [0xdff6ff, 0xffffff, 0x9be7ff] } = {}) {
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const i = splash.i = (splash.i + 1) % SPLASH_N, a = Math.random() * Math.PI * 2, r = Math.random() * speed;
    splash.pos.setXYZ(i, at.x, at.y, at.z);
    splash.vel.set([Math.cos(a) * r, up * (0.6 + Math.random() * 0.6), Math.sin(a) * r], i * 3);
    c.setHex(colors[k % colors.length]);
    splash.col.setXYZ(i, c.r, c.g, c.b);
    splash.life[i] = 0.7 + Math.random() * 0.6;
  }
}
function updateSplash(dt) {
  const p = splash.pos.array, v = splash.vel;
  for (let i = 0; i < SPLASH_N; i++) {
    if (splash.life[i] <= 0) { p[i * 3 + 1] = -999; continue; }
    splash.life[i] -= dt;
    v[i * 3 + 1] -= 9 * dt;
    p[i * 3] += v[i * 3] * dt;
    p[i * 3 + 1] += v[i * 3 + 1] * dt;
    p[i * 3 + 2] += v[i * 3 + 2] * dt;
  }
  splash.pos.needsUpdate = splash.col.needsUpdate = true;
}

let catchFx = null; // { t, dur, it, sprite, banner, manual }
function playCatch(k, onDone) {
  const it = k ? ITEMS[k] : null;
  const sprite = emojiSprite(it ? it.icon : '🐟', 0.6);
  sprite.visible = false;
  scene.add(sprite);
  catchFx = { t: 0, dur: it ? 3.6 : 2, it, sprite, onDone, splashed: false, shown: false };
  $('overlay-fish').classList.add('cine'); // ẩn hộp câu cá cho thấy cảnh
  $('hud').classList.add('cine');
}
function catchBanner(it) {
  const b = $('catch-banner');
  b.className = 'catch-banner' + (it?.rare ? ' rare' : '');
  b.innerHTML = !it ? '💦 Sổng mất rồi!'
    : it.junk ? `${it.icon} Vớt được… chiếc dép! 😂`
    : it.rare ? `🎉 CÁ HIẾM! 🎉<br><span>${it.icon} ${it.name}</span><small>${fmt(it.price)}</small>`
    : `${it.icon} ${it.name}!<small>${fmt(it.price)}</small>`;
}
const easeOut = (x) => 1 - (1 - x) * (1 - x);
function updateFishing(dt, t) {
  const on = !!meA && (modal === 'fish' || !!catchFx);
  rod.visible = fishLine.visible = on;
  bobber.visible = on && !(catchFx?.it && catchFx.t > 0.35);
  if (!catchFx?.manual) updateSplash(dt);
  if (!on) return;
  // Cần cầm tay phải, chĩa ra biển (nhân vật quay mặt về +z khi câu)
  const fx = catchFx;
  if (fx && !fx.manual) fx.t += dt;
  const ft = fx?.t ?? 0;
  let tilt = 1.05 + Math.sin(t * 1.3) * 0.03;
  if (fishGame.phase === 'bite') tilt += Math.sin(t * 25) * 0.04; // cá rỉa mồi, đầu cần rung
  if (fx) tilt = ft < 0.35 ? 1.05 - easeOut(ft / 0.35) * 0.95 : 0.1 + Math.sin(ft * 9) * 0.06 * Math.max(0, 1 - (ft - 0.35));
  rod.position.set(meA.rx + 0.24, meA.f * FLOOR_H + 0.62, meA.rz + 0.12);
  rod.rotation.set(tilt, 0, -0.08);
  rod.updateMatrixWorld();
  rodTip.copy(ROD_TIP).applyMatrix4(rod.matrixWorld);
  bobberPos.set(meA.rx + 0.4, -0.02 + Math.sin(t * 2.2) * 0.03 - (fishGame.phase === 'bite' ? Math.abs(Math.sin(t * 9)) * 0.08 : 0), Math.max(meA.rz + 3.4, SEA_Z + 1));
  bobber.position.copy(bobberPos);
  let end = bobberPos;
  if (fx) {
    const s = fx.sprite;
    if (!fx.splashed && ft > 0.05) {
      fx.splashed = true;
      burst(bobberPos, 40, { speed: 1.6, up: 3.2 });
    }
    if (fx.it) {
      // 0.35–1.5s: cá bay vòng cung từ phao lên đầu dây; sau đó treo lủng lẳng, xoay qua lại
      const hang = tmp.copy(rodTip).add(new THREE.Vector3(0, -0.55, 0));
      if (ft > 0.35) {
        s.visible = true;
        const k = Math.min(1, (ft - 0.35) / 1.15), e = easeOut(k);
        fishPos.lerpVectors(bobberPos, hang, e);
        fishPos.y += Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) {
          const sw = ft - 1.5;
          fishPos.x += Math.sin(sw * 5) * 0.18 * Math.exp(-sw * 0.8);
          fishPos.y += Math.sin(sw * 9) * 0.05;
        }
        s.position.copy(fishPos);
        s.scale.setScalar(0.35 + e * 0.45);
        s.material.rotation = k < 1 ? k * Math.PI * 4 : Math.sin(ft * 6) * 0.35;
        end = fishPos;
        if (k >= 1 && !fx.shown) {
          fx.shown = true;
          catchBanner(fx.it);
          if (!fx.it.junk) burst(fishPos, fx.it.rare ? 70 : 35, { speed: 2.2, up: 2.5, colors: fx.it.rare ? [0xffd54f, 0xff4081, 0x69f0ae, 0x40c4ff] : [0xffffff, 0xffe082] });
          dingSound();
        }
      }
    } else {
      // Sổng: cá nhảy khỏi mặt nước rồi rơi tõm lại
      s.visible = ft > 0.3 && ft < 1.25;
      const k = Math.min(1, Math.max(0, (ft - 0.3) / 0.95));
      s.position.set(bobberPos.x, bobberPos.y + Math.sin(k * Math.PI) * 1.3, bobberPos.z + k * 0.6);
      s.material.rotation = k * Math.PI * 2;
      if (k >= 1 && !fx.shown) {
        fx.shown = true;
        burst(s.position, 30, { speed: 1.2, up: 2.4 });
        catchBanner(null);
      }
    }
    if (ft >= fx.dur && !fx.manual) endCatch();
  }
  const arr = fishLine.geometry.attributes.position.array;
  arr.set([rodTip.x, rodTip.y, rodTip.z, end.x, end.y + (fx?.it && ft > 0.35 ? 0.25 : 0.06), end.z]);
  fishLine.geometry.attributes.position.needsUpdate = true;
}
function endCatch() {
  const fx = catchFx;
  if (!fx) return;
  catchFx = null;
  scene.remove(fx.sprite);
  fx.sprite.material.map.dispose();
  fx.sprite.material.dispose();
  $('catch-banner').className = 'catch-banner hidden';
  $('overlay-fish').classList.remove('cine');
  $('hud').classList.remove('cine');
  fx.onDone?.();
}
// Chạy đoạn phim từng khung (dùng khi quay video thử): tiến h giây.
function stepCatch(h) {
  if (!catchFx) return;
  catchFx.manual = true;
  catchFx.t += h;
  updateSplash(h);
}
// Camera khi câu cá. Lúc câu: máy đứng chéo sau lưng, cao hơn đầu, nhìn ra phao (nhân vật nằm nửa trên màn hình,
// hộp câu cá ở dưới không che). Lúc chiếu đoạn kéo cá: nhìn ngang từ bên trái, thấy cả người lẫn phao, lia chậm ra biển.
const cineCam = new THREE.Vector3(), cineLook = new THREE.Vector3(), cineCur = new THREE.Vector3(), cineLookCur = new THREE.Vector3();
let cineOn = false;
let fairBase = null; // góc camera thường lúc vào góc nhìn trò chơi: kéo/zoom trong lúc chơi tính lệch từ đây, hết trò trả lại
function cinematicCamera(dt) {
  const fairT = !catchFx && modal !== 'fish' && meA?.seat ? tableGames.fairView() : null;
  if (fairT === null && fairBase) { Object.assign(cam, fairBase); fairBase = null; }
  if (!meA || (!catchFx && modal !== 'fish' && fairT === null)) { cineOn = false; return false; }
  const y0 = meA.f * FLOOR_H;
  if (fairT !== null) {
    // Trò chơi cần nhìn công bằng (chai chỉ vào ai, xí ngầu, bốc thăm, oẳn tù tì lộ bài): máy lên cao nhìn
    // xuống giữa bàn, thấy đủ mọi ghế; đặt lệch về phía ghế mình để hướng nhìn quen thuộc.
    const T = TABLES[fairT], s = seatPos(T, meA.seat.idx);
    let R = 0;
    for (let i = 0; i < T.seats; i++) { const p = seatPos(T, i); R = Math.max(R, Math.hypot(p.x - T.x, p.z - T.z)); }
    const dx = s.x - T.x, dz = s.z - T.z, d = Math.hypot(dx, dz) || 1;
    const fit = (R + 0.9) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.min(1, camera.aspect);
    // Màn hình dọc (điện thoại): bảng trò chơi nằm dưới, nên nhìn vào điểm lệch về phía mình để bàn nằm nửa trên.
    const shift = camera.aspect < 1 ? (R + 0.9) * 0.7 : 0;
    cineLook.set(T.x + (dx / d) * shift, y0 + 0.6, T.z + (dz / d) * shift);
    // Mặc định đứng sau ghế mình, gần như thẳng đứng; kéo chuột/vuốt để xoay quanh bàn, lăn/chụm để zoom
    if (!fairBase) fairBase = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    const yaw = Math.atan2(dx, dz) + (cam.yaw - fairBase.yaw);
    const elev = THREE.MathUtils.clamp(1.21 + (cam.pitch - fairBase.pitch), 0.35, 1.5);
    const r = fit * cam.dist / fairBase.dist;
    cineCam.set(cineLook.x + Math.sin(yaw) * Math.cos(elev) * r, cineLook.y + Math.sin(elev) * r, cineLook.z + Math.cos(yaw) * Math.cos(elev) * r);
  } else if (catchFx) {
    const ft = catchFx.t, a = -1.95 + Math.min(ft, 3.5) * 0.1;
    cineLook.set(meA.rx + 0.3, y0 + 1.1 + (catchFx.it && ft > 0.4 ? 0.35 : 0), meA.rz + 1.7);
    cineCam.set(cineLook.x + Math.sin(a) * 4, cineLook.y + 0.55, cineLook.z + Math.cos(a) * 4);
  } else {
    // Đang câu: xoay quanh điểm giữa người câu và phao; kéo chuột/vuốt để xoay, lăn/chụm để zoom như bình thường.
    const cp = Math.cos(cam.pitch);
    cineLook.set(meA.rx + 0.3, y0 + 0.7, meA.rz + 1.8);
    cineCam.set(cineLook.x + Math.sin(cam.yaw) * cp * cam.dist, cineLook.y + Math.sin(cam.pitch) * cam.dist, cineLook.z + Math.cos(cam.yaw) * cp * cam.dist);
    cineCam.y = Math.max(y0 + 0.4, cineCam.y);
  }
  if (!cineOn || catchFx?.manual) {
    // vừa vào chế độ: bắt đầu từ chỗ camera thường đang đứng (lúc quay video thì đặt thẳng)
    cineCur.copy(catchFx?.manual ? cineCam : camera.position);
    cineLookCur.copy(catchFx?.manual ? cineLook : camTarget);
    cineOn = true;
  }
  const k = Math.min(1, dt * (catchFx ? 4 : 3));
  cineCur.lerp(cineCam, k);
  cineLookCur.lerp(cineLook, k);
  camera.position.copy(cineCur);
  camera.lookAt(cineLookCur);
  return true;
}
$('btn-fish-strike').onclick = strikeFish;
$('btn-fish-close').onclick = stopFishing;
// Chờ hô xong mới nâng ly uống.
// solo: uống một mình, không chờ hò dzô, không cụng ly.
function drinkUp(solo = false) {
  const T = TABLES[meA.seat.table];
  const wait = solo ? 0 : dzoWait(), from = state.fill, dur = wait + 2.1;
  let raised = false;
  busy = {
    t: 0, dur,
    tick: (k) => {
      const d = (k * dur - wait) / 2.1;
      if (d < 0) return;
      if (!raised) { raised = true; playAct(meA, 'cheers'); if (!solo) clinkSound(); }
      setFill(from * (1 - clamp((d - 0.45) / 0.45, 0, 1)));
    },
    done: () => {
      state.cheers++;
      // Có mồi trên bàn thì ngấm chậm hơn.
      state.drunk += drinkOf(T.id).strength - Math.min(T.dishes.children.filter((d) => d.userData.portion > 0).length, 5);
      updateDrunk();
      if (state.drunk >= 100) passOut();
    },
  };
}

function emote(k) {
  if (modal || state.passedOut) return;
  playAct(meA, k);
  sendAct(k);
  if (k === 'clap') clapSound();
}

function drinkWater() {
  if (modal || state.passedOut) return;
  state.waters++;
  state.drunk -= 6;
  updateDrunk();
  playAct(meA, 'water');
  sendAct('water');
}

// Tên trong một cơ sở không trùng nhau, nên trùng tên với mình là chính mình (hoặc bóng cũ của mình).
const isMe = (a) => a === meA || a.id === myId || a.name === meA.name;
function offerDrink(a) {
  if (state.passedOut || isMe(a)) return;
  playAct(meA, 'offer');
  speak(meA, `🍻 mời ${a.name} một ly`, 2500);
  sendAct('offer', { to: a.id });
  // Cùng ngồi thì gửi lời mời, đồng ý là dzô. Chú Ba thì lúc nào cũng nhận.
  if (!meA.seat || !a.seat) return;
  refill(); // mời thì tự rót sẵn
  if (a === chuBa) {
    setTimeout(() => { speak(chuBa, 'Được, dzô con!', 2000); cheers(); }, 900);
    return;
  }
  send({ t: 'invite', to: a.id });
  toast(`Đã mời ${a.name}, chờ trả lời…`);
}

// Người ngồi đối diện: người ngồi trước mặt, lệch sang hai bên ít nhất.
function oppositeOf(a) {
  const T = TABLES[a.seat.table], yaw = seatYaw(T, a.seat.idx), fx = Math.sin(yaw), fz = Math.cos(yaw);
  let best = null, bestScore = Infinity;
  for (const o of [...allActors(), ...npcs]) {
    if (o === a || isMe(o) || o.seat?.table !== T.id) continue;
    const dx = o.x - a.x, dz = o.z - a.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
    if (along < 0.3) continue;
    const score = side + along * 0.1;
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}
// Chọn người cùng bàn để mời. Bàn chỉ có một người khác thì mời luôn.
let pickList = [];
// Những người khác đang ngồi cùng bàn với mình (kể cả NPC như chú Ba).
function tableMates() {
  const T = meA?.seat?.table;
  if (T === undefined) return [];
  return [...allActors(), ...npcs].filter((o) => !isMe(o) && o.seat?.table === T).sort((a, b) => a.seat.idx - b.seat.idx);
}
function invitePick() {
  if (modal || state.passedOut || !meA?.seat) return;
  pickList = tableMates();
  if (!pickList.length) return toast('Bàn chưa có ai khác, mời ai bây giờ? 😅');
  if (pickList.length === 1) return offerDrink(pickList[0]);
  const opp = oppositeOf(meA);
  const wrap = $('pick-list');
  wrap.innerHTML = '';
  pickList.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'lift-btn';
    b.innerHTML = `<b>${i + 1}</b><span>${escapeHtml(o.name)}${o === opp ? '<small>ngồi đối diện</small>' : ''}</span>`;
    b.onclick = () => pickInvite(i);
    wrap.appendChild(b);
  });
  openModal('pick');
}
function pickInvite(i) {
  const o = pickList[i];
  closeModal();
  if (o && meA.seat && o.seat?.table === meA.seat.table) offerDrink(o);
}
$('btn-pick-close').onclick = closeModal;

let invitedBy = null, inviteTimer = 0;
function showInvite(a) {
  invitedBy = a.id;
  $('invite-text').innerHTML = `<b>${escapeHtml(a.name)}</b> mời bạn một ly 🍻`;
  $('invite').classList.remove('hidden');
  clearTimeout(inviteTimer);
  inviteTimer = setTimeout(() => answerInvite(false), 12000);
}
function answerInvite(ok) {
  if (!invitedBy) return;
  clearTimeout(inviteTimer);
  $('invite').classList.add('hidden');
  send({ t: 'invite-reply', to: invitedBy, ok });
  invitedBy = null;
  if (!ok || !meA.seat || state.passedOut) return;
  refill();
  if (busy) busy = null;
  cheers();
}
$('btn-invite-ok').onclick = () => answerInvite(true);
$('btn-invite-no').onclick = () => answerInvite(false);

function openMenu() {
  if (state.passedOut) return;
  const T = meA.seat ? TABLES[meA.seat.table] : null;
  $('menu-target').textContent = T ? `Chọn món rồi bấm Gọi, món sẽ mang ra ${tableName(T)}` : 'Ngồi vào bàn để gọi mồi nhé!';
  menuPicks.clear(); // mỗi lần mở thực đơn chọn lại từ đầu
  renderMenu();
  openModal('menu');
}

// Mỗi lần có người dzô: âm thanh.
function onAnyAct(a, k) {
  if (k === 'cheers') {
    if (a !== meA && meA.seat && a.seat?.table === meA.seat.table && !aloneAt(a)) dzoCallSound(0.7);
  }
  if (k === 'clap' && a !== meA && Math.hypot(a.rx - meA.rx, a.rz - meA.rz) < 8) clapSound();
}

const popIns = [];
function serveDish(tableId, item, silent) {
  const T = TABLES[tableId], m = MENU[item];
  if (!T || !m) return;
  const plate = new THREE.Group();
  const spot = spotOnTable(T);
  plate.position.set(spot.x, 0.58, spot.z);
  cyl(0.13, 0.1, 0.02, 0xffffff, 0, 0, 0, plate);
  const s = emojiSprite(m.icon, 0.22);
  s.position.y = 0.1;
  plate.add(s);
  plate.userData = { item, portion: 1, sprite: s }; // portion: phần món còn lại trên đĩa (gắp ăn thì vơi dần)
  T.dishes.add(plate);
  T.suggested = false; // có món mới thì em order chưa cần gợi ý
  if (!silent) {
    plate.scale.setScalar(0.01);
    popIns.push({ obj: plate, t: 0 });
  }
}

function passOut() {
  state.passedOut = true;
  $('fade').style.opacity = 1;
  toast('Bạn đã gục. Anh em gọi xe ôm đưa về 🛵');
  setTimeout(showBill, 2500);
}

// Hoá đơn chung của bàn đang ngồi. Quy tắc: gọi món rồi mới tính tiền được,
// một người trả cho cả bàn thì những người khác không thanh toán được nữa.
function showBill() {
  const T = meA?.seat ? TABLES[meA.seat.table] : null;
  const tab = T ? tabs[T.id] : null;
  const rows = [];
  if (tab) {
    const d = drinkOfTable(T);
    if (tab.pours) rows.push([`${d.icon} ${d.name} x${tab.pours}`, tab.pours * d.price]);
    const grouped = {};
    tab.items.forEach((i) => {
      const m = MENU[i];
      grouped[m.name] = grouped[m.name] || { ...m, qty: 0 };
      grouped[m.name].qty++;
    });
    for (const m of Object.values(grouped)) rows.push([`${m.icon} ${m.name} x${m.qty}`, m.price * m.qty]);
  }
  const total = tab ? tabTotal(T, tab) : 0;
  const people = T ? seatedAt(T.id) + (T.npcSeats?.length || 0) : 1;
  const extras = state.extras.reduce((s, m) => s + m.price, 0) + state.rounds * ROUND_PRICE;
  const minutes = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));
  let status, canPay = false;
  if (!tab) status = '🪑 Ngồi vào bàn để xem hoá đơn của bàn.';
  else if (tab.paidBy) status = `✅ Đã thanh toán bởi <b>${tab.paidBy === myId ? 'bạn' : escapeHtml(tab.paidName || 'một người')}</b>. Gọi thêm món sẽ mở hoá đơn mới.`;
  else if (!tab.items.length) status = '🍽️ Bàn chưa gọi món nào. <b>Gọi món trước</b> rồi mới tính tiền được.';
  else { status = '💡 Một người trả cho cả bàn. Ai bấm thanh toán trước thì người khác không cần trả nữa.'; canPay = true; }

  const bill = $('bill');
  bill.innerHTML = `
    <div><b>${SHOP_NAME}</b>${T ? ` · ${escapeHtml(T.name)}` : ''}</div>
    <div>Ngồi ${minutes} phút · Dzô ${state.cheers} lần · Nước lọc ${state.waters} lần</div>
    <hr>
    ${rows.map(([n, p]) => `<div class="row"><span>${n}</span><span>${fmt(p)}</span></div>`).join('') || '<div>Chưa có gì trên hoá đơn 😅</div>'}
    <hr>
    <div class="row total"><span>Tổng cả bàn</span><span>${fmt(total)}</span></div>
    ${net.online ? `<div class="row"><span>💰 Ví của bạn</span><span>${fmt(wallet.money)}</span></div>` : ''}
    ${T && total ? `<div class="row"><span>Nếu chia ${people} người</span><span>${fmt(Math.ceil(total / people / 1000) * 1000)}/người</span></div>` : ''}
    ${extras ? `<div class="row"><span>Bạn đã trả riêng (lạc, bao quán)</span><span>${fmt(extras)}</span></div>` : ''}
    <div class="bill-status ${tab?.paidBy ? 'paid' : ''}">${status}</div>
    <div class="note">🩺 Đã uống rượu bia thì không lái xe. Nhậu online thì an toàn tuyệt đối 😉</div>`;

  const pay = $('btn-pay');
  pay.disabled = !canPay;
  pay.textContent = tab?.paidBy ? '✅ Đã thanh toán' : !tab || !tab.items.length ? '💸 Gọi món trước đã' : `💸 Thanh toán ${fmt(total)}`;
  // Đã gục thì không quay lại bàn được, chỉ còn về nhà.
  $('btn-bill-back').classList.toggle('hidden', state.passedOut);
  if (modal !== 'bill') openModal('bill');
}

// Lưu thống kê khi kết thúc cuộc (về nhà), không phải mỗi lần xem hoá đơn.
function saveSession() {
  if (!state.started || state.saved) return;
  state.saved = true;
  const spent = state.paid + state.extras.reduce((s, m) => s + m.price, 0) + state.rounds * ROUND_PRICE;
  const s = loadStats();
  saveStats({ sessions: s.sessions + 1, cheers: s.cheers + state.cheers, spent: s.spent + spent });
}

// Popup chào về nhà chưa rời quán thật: ✕ là ở lại quán, "Quay lại quán" mới kết thúc cuộc và vào lại từ đầu.
function leaveForHome() {
  voice.leave();
  openModal('end');
}
function closeEnd() {
  // Đã gục thì không ngồi tiếp được, quay về hoá đơn (còn thanh toán / về nhà).
  if (state.passedOut) showBill();
  else closeModal();
}

// ================= Trò chơi cùng bàn (public/tablegames.js) =================
const tableGames = createTableGames({
  THREE, $, send, toast, speak, fmt, escapeHtml, actorById, TABLES, seatPos, floors, serverNow, playAct,
  openModal, closeModal,
  me: () => meA, myId: () => myId, online: () => net.online,
  // Thua: server đã tính ly phạt vào hoá đơn; ở đây rót đầy rồi uống cạn một mình (đang gục thì thôi).
  penaltyDrink: function drinkPenalty() {
    if (!meA?.seat || state.passedOut) return;
    if (busy) return setTimeout(drinkPenalty, 500);
    setFill(0.95);
    speak(meA, '😵 Phạt 1 ly!', 2000);
    drinkUp(true);
  },
});

// ================= Điều khiển =================
const keys = {};
const ACTIONS = {
  cheers, water: drinkWater, interact,
  wave: () => emote('wave'),
  clap: () => emote('clap'),
  menu: () => openMenu(),
  stand: () => meA?.seat && !modal && askStand(),
  dance: () => toggleDance(),
  invite: invitePick,
  games: () => !modal && !document.querySelector('[data-act="games"]').disabled && tableGames.openPicker(),
  fish: startFishing,
  voiceMic: () => toggleVoiceMic(),
};

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Escape') closeActionGroups();
  if (e.code === 'Enter' && !modal && state.started) {
    e.preventDefault();
    setChatOpen(true);
    $('chat-input').focus();
    return;
  }
  keys[e.code] = true;
  if (modal) {
    if (e.code === 'Escape' && modal === 'settings') closeSettings();
    else if (e.code === 'Escape' && modal === 'end') closeEnd();
    else if (modal === 'leave' && (e.code === 'Escape' || e.code === 'Enter')) confirmStand(e.code === 'Enter');
    else if (modal === 'pick' && e.code === 'Escape') closeModal();
    else if (modal === 'fish' && catchFx) { /* đang chiếu đoạn kéo cá */ }
    else if (modal === 'fish' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); strikeFish(); }
    else if (modal === 'fish' && e.code === 'Escape') stopFishing();
    else if ((modal === 'bag' || modal === 'bottle') && e.code === 'Escape') closeModal();
    else if (modal === 'pick' && /^Digit[1-9]$/.test(e.code)) pickInvite(Number(e.code.slice(5)) - 1);
    else if (e.code === 'Escape' && modal === 'donate') closeDonate();
    else if (e.code === 'Escape' && (modal === 'elevator' || modal === 'poem')) closeModal();
    else if (e.code === 'Escape' && (modal === 'menu' || modal === 'songs' || (modal === 'bill' && !state.passedOut))) closeModal();
    return;
  }
  const map = {
    Digit1: 'cheers', Space: 'cheers', Digit3: 'wave', Digit4: 'clap',
    Digit5: 'menu', KeyM: 'menu', Digit6: 'water', KeyN: 'water', KeyE: 'interact', Digit7: 'dance', Digit8: 'invite', Digit9: 'games', KeyF: 'fish', KeyV: 'voiceMic',
  };
  if (map[e.code]) {
    e.preventDefault();
    ACTIONS[map[e.code]]();
  }
  if (e.code === 'KeyB' && billPayable()) showBill();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Chuột / cảm ứng: kéo để xoay, click để đi tới hoặc tương tác, lăn/chụm để zoom.
const pointers = new Map();
let pinchDist = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const marker = add(new THREE.RingGeometry(0.15, 0.22, 24), new THREE.MeshBasicMaterial({ color: 0xf2a900, transparent: true, opacity: 0.8 }), 0, 0.03, 0);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;

// skip: vật click bỏ qua (đang hát thì khối sân khấu bao quanh mình, bấm đâu cũng trúng nó).
function pickAt(x, y, skip) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const f = meA?.f ?? 0;
  const here = clickables.filter((o) => o !== skip && floorOf(o.userData.click) === f);
  const hits = raycaster.intersectObjects(here, false).filter((h) => h.object !== meA?.hit);
  if (hits.length) {
    // Vùng bấm của bàn to (trùm cả ghế quanh bàn), hay che người đứng cạnh hay bên kia bàn (em order, khách):
    // tia bấm có trúng người nằm trong khoảng một cái bàn phía sau thì ưu tiên người.
    const first = hits[0];
    if (first.object.userData.click.tableId !== undefined) {
      const person = hits.find((h) => h.object.userData.click.tableId === undefined && h.distance - first.distance < 3.5);
      if (person) return { info: person.object.userData.click };
    }
    return { info: first.object.userData.click, point: first.point };
  }
  groundPlane.constant = -f * FLOOR_H;
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, p)) return { point: p };
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (document.activeElement === $('chat-input')) $('chat-input').blur(); // bấm ra cảnh thì thoát ô chat
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) {
    if (e.pointerType === 'mouse' && !modal) canvas.classList.toggle('hover', !!pickAt(e.clientX, e.clientY)?.info);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) p.moved = true;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) { cam.dist = clamp(cam.dist * (pinchDist / d), 1.6, 9); atStartView = false; }
    pinchDist = d;
  } else if (p.moved) {
    canvas.classList.add('dragging');
    cam.yaw -= dx * 0.006;
    atStartView = false;
    cam.pitch = clamp(cam.pitch + dy * 0.004, 0.05, 1.35);
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  if (p.moved || pointers.size > 0 || modal || !state.started || state.passedOut || riding || wcBusy || paying) return;
  const hit = pickAt(e.clientX, e.clientY, mic.singer === myId ? stageClick : null);
  if (!hit) return;
  if (mic.singer === myId) {
    // Đang hát: bấm trên sân khấu thì thôi, bấm ra ngoài thì rời mic và đi tới đó.
    const at = hit.info ? hit.info.pos() : hit.point;
    if (Math.abs(at.x - STAGE.x) < STAGE.w / 2 && Math.abs(at.z - STAGE.z) < STAGE.d / 2) return;
    send({ t: 'mic-leave' });
    mic.singer = null; // không chờ server báo lại mới cho đi
  }
  // Bấm vào vùng bàn: nhớ ghế gần chỗ bấm nhất để ngồi đúng ghế đó (nếu còn trống).
  chosenSeat = hit.info?.tableId !== undefined && hit.point ? { table: hit.info.tableId, idx: seatNear(TABLES[hit.info.tableId], hit.point) } : null;
  if (meA.seat) {
    if (hit.info?.tableId === meA.seat.table) {
      // Đang ngồi mà bấm sang ghế trống khác cùng bàn thì đổi ghế (không phải đứng dậy).
      if (chosenSeat && chosenSeat.idx !== meA.seat.idx && seatFree(meA.seat.table, chosenSeat.idx)) send({ t: 'sit', table: meA.seat.table, idx: chosenSeat.idx });
      return;
    }
    if (hit.info && hit.info.tableId === undefined) {
      // Mời ly người khác, gọi món với em order đứng cạnh bàn…: đủ gần thì làm luôn, không cần đứng dậy.
      const pos = hit.info.pos();
      if (Math.hypot(pos.x - meA.x, pos.z - meA.z) <= hit.info.range + 0.8) { hit.info.action(); return; }
    }
    askStand(() => goTo(hit)); // đồng ý rời bàn thì mới đi tới chỗ vừa bấm
    return;
  }
  goTo(hit);
}
// Ghế (không phải ghế NPC) gần một điểm nhất, và ghế đó còn trống không.
let chosenSeat = null; // { table, idx } ghế vừa bấm chọn
function seatNear(T, p) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < T.seats; i++) {
    if (T.npcSeats?.includes(i)) continue;
    const s = seatPos(T, i), d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
const seatFree = (table, idx) => !TABLES[table].npcSeats?.includes(idx) && !allActors().some((a) => a.seat?.table === table && a.seat.idx === idx);
function goTo(hit) {
  if (hit.info) {
    pending = hit.info;
    const pos = hit.info.pos();
    walkTo(pos.x, pos.z);
  } else {
    pending = null;
    const B = FLOOR_BOUNDS[meA.f];
    walkTo(clamp(hit.point.x, B.minX, B.maxX), clamp(hit.point.z, B.minZ, B.maxZ));
    marker.position.set(moveTarget.x, meA.f * FLOOR_H + 0.04, moveTarget.z);
    marker.visible = true;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.6, 9);
  atStartView = false;
}, { passive: false });

document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
  closeActionGroups(); // bấm một nút con xong thì đóng nhóm
  ACTIONS[b.dataset.act]();
  b.blur(); // để phím Space không bấm lại nút
}));

// Thanh hành động: mỗi nhóm là một nút, bấm mở bảng nút con. Nhóm chỉ còn một nút con hiện thì nút nhóm làm luôn
// việc của nút đó (khỏi bấm hai lần). Bấm ra ngoài, Esc hoặc mở nhóm khác thì đóng.
const actionGroups = [...document.querySelectorAll('.ab-group')].map((g) => {
  const trigger = g.querySelector('.ab-trigger');
  return { g, trigger, icon: trigger.querySelector('b').textContent, label: trigger.querySelector('span').textContent, key: '' };
});
const groupItems = (grp) => [...grp.g.querySelectorAll('.ab-menu > button:not(.hidden)')];
function closeActionGroups(except) {
  for (const grp of actionGroups) {
    if (grp === except || !grp.g.classList.contains('open')) continue;
    grp.g.classList.remove('open');
    grp.trigger.setAttribute('aria-expanded', 'false');
  }
}
for (const grp of actionGroups) {
  grp.trigger.onclick = (e) => {
    grp.trigger.blur();
    const items = groupItems(grp);
    if (items.length === 1) { closeActionGroups(); items[0].click(); return; }
    const open = !grp.g.classList.contains('open');
    closeActionGroups(grp);
    grp.g.classList.toggle('open', open);
    grp.trigger.setAttribute('aria-expanded', String(open));
  };
}
addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.ab-group')) closeActionGroups(); });
// Gọi mỗi khung hình (updateFocus): nút nhóm hiện đúng nút con duy nhất, hoặc biểu tượng nhóm; sáng xanh khi có nút con đang bật.
function syncActionGroups() {
  for (const grp of actionGroups) {
    const items = groupItems(grp), one = items.length === 1 ? items[0] : null, on = items.some((b) => b.classList.contains('on'));
    const key = `${one ? one.dataset.act + one.querySelector('span').textContent : items.length}|${on}`;
    if (key === grp.key) continue;
    grp.key = key;
    grp.trigger.querySelector('b').textContent = one ? one.querySelector('b').textContent : grp.icon;
    grp.trigger.querySelector('span').textContent = one ? one.querySelector('span').textContent : grp.label;
    grp.trigger.title = one ? one.title : grp.label;
    grp.trigger.classList.toggle('on', on);
    if (one || !items.length) { grp.g.classList.remove('open'); grp.trigger.setAttribute('aria-expanded', 'false'); }
  }
}

// ================= Màn bắt đầu =================
// ---------- Xem trước nhân vật ở màn bắt đầu ----------
const preview = (() => {
  const cv = $('preview');
  const r3 = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  r3.setPixelRatio(Math.min(devicePixelRatio, 2));
  r3.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8d6e63, 1.8));
  const key = new THREE.DirectionalLight(0xffe0b0, 1.8);
  key.position.set(2, 3, 3);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0, 1.2, 4.4);
  cam.lookAt(0, 0.95, 0);
  add(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 40), mat(0xb71c1c, { roughness: 0.6 }), 0, -0.025, 0, sc);
  let person = null, yaw = 0.6, drag = null, waveT = 0;
  cv.addEventListener('pointerdown', (e) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (drag === null) return;
    yaw += (e.clientX - drag) * 0.012;
    drag = e.clientX;
  });
  const end = () => (drag = null);
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  return {
    rebuild() {
      if (person) {
        sc.remove(person.root);
        person.root.traverse((o) => o.geometry?.dispose());
      }
      person = makePerson(lookToOpts(state.look, 1));
      person.cup.visible = true; // cầm sẵn ly bia
      sc.add(person.root);
      waveT = 1.3; // đổi đồ xong thì vẫy chào
    },
    render(dt, t) {
      if (!person) return;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * r3.getPixelRatio()) || cv.height !== Math.round(h * r3.getPixelRatio())) {
        r3.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      if (drag === null) yaw += dt * 0.6;
      person.root.rotation.y = yaw;
      const [L, R] = person.arms;
      waveT -= dt;
      L.rotation.x += ((waveT > 0 ? -2.9 : 0.05) - L.rotation.x) * Math.min(1, dt * 10);
      L.rotation.z = waveT > 0 ? -0.3 + Math.sin(t * 12) * 0.35 : 0;
      R.rotation.x = -0.7 + Math.sin(t * 1.5) * 0.08;
      person.cup.rotation.x = -R.rotation.x;
      person.head.rotation.y = Math.sin(t * 0.8) * 0.3;
      person.body.position.y = Math.sin(t * 2) * 0.01;
      r3.render(sc, cam);
    },
  };
})();

// ---------- Sáng / tối theo giờ thật ở Việt Nam ----------
// Không chỉnh tay: 6h–18h (giờ Việt Nam, UTC+7, theo đồng hồ server) là ban ngày, còn lại là ban đêm.
// Bình minh 5h30–6h30 và hoàng hôn 17h30–18h30 chuyển dần, có ráng cam. Cả quán thấy cùng một cảnh.
const VN_OFFSET_H = 7;
const vnHours = () => (((serverNow() / 3600000 + VN_OFFSET_H) % 24) + 24) % 24;
function dayFactor(h) {
  if (h >= 6.5 && h <= 17.5) return 1;
  if (h > 5.5 && h < 6.5) return h - 5.5;
  if (h > 17.5 && h < 18.5) return 18.5 - h;
  return 0;
}
const C = (hex) => new THREE.Color(hex);
const mixC = (a, b, k) => C(a).lerp(C(b), k);
const lerp = (a, b, k) => a + (b - a) * k;
function setSceneDay(k) {
  const day = k >= 0.5, dusk = 4 * k * (1 - k); // dusk = 1 lúc chạng vạng
  scene.background.copy(mixC(0x0b1020, 0x9fd3f5, k).lerp(C(0xf08a4b), dusk * 0.55));
  scene.fog.color.copy(mixC(0x0b1020, 0xcfe6f5, k).lerp(C(0xf3a36b), dusk * 0.5));
  fogFar = lerp(320, 520, k);
  hemi.color.copy(mixC(0x8899cc, 0xe3f2ff, k));
  hemi.groundColor.copy(mixC(0x2a1d10, 0x9c8a6a, k));
  hemi.intensity = lerp(0.9, 2.2, k);
  ambient.intensity = lerp(0.25, 0.6, k);
  moonLight.color.copy(mixC(0xbcd0ff, 0xfff1d6, k).lerp(C(0xffa060), dusk * 0.6));
  moonLight.intensity = lerp(0.5, 2.4, k);
  moonLight.position.copy(day ? SUN : MOON);
  sea.material.color.copy(mixC(0x0b2742, 0x2a86c2, k));
  nightOnly.forEach((o) => (o.visible = !day));
  boats.forEach((b) => (b.visible = !day));
  dayOnly.forEach((o) => (o.visible = day));
  hotelMats.forEach((m) => {
    m.map = m.emissiveMap = day ? m.userData.dayMap : m.userData.nightMap;
    m.emissiveIntensity = day ? 0 : 0.35;
    m.needsUpdate = true;
  });
  // Đèn trong quán vẫn bật nhưng ban ngày dịu hơn (trừ đèn sân khấu và lửa bếp, tự chỉnh mỗi khung hình)
  scene.traverse((o) => {
    if (!o.isPointLight || o === stageLight || o === strobe || o === stoveLight) return;
    o.userData.base ??= o.intensity;
    o.intensity = o.userData.base * lerp(1, 0.4, k);
  });
}

let lastDayK = -1;
function updateDayNight() {
  const h = vnHours(), k = dayFactor(h);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  // Đồng hồ gọn: biểu tượng theo buổi + giờ:phút (giờ Việt Nam); tên buổi để trong chú thích khi rê chuột.
  const part = k === 1 ? 'Ban ngày' : k === 0 ? 'Ban đêm' : h < 12 ? 'Bình minh' : 'Hoàng hôn';
  const icon = k === 1 ? '☀️' : k === 0 ? '🌙' : h < 12 ? '🌅' : '🌇';
  $('clock').textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('clock').title = `${part} · giờ Việt Nam`;
  if (Math.abs(k - lastDayK) < 0.01) return;
  lastDayK = k;
  setSceneDay(k);
  const light = k >= 0.5;
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]').content = light ? '#fffaf2' : '#0b1020';
}
updateDayNight();
setInterval(updateDayNight, 10000);

if (isTouch) {
  $('controls-list').innerHTML = `
    <li><b>Chạm sàn</b> để đi · <b>vuốt</b> để xoay · <b>chụm hai ngón</b> để zoom</li>
    <li><b>Chạm bàn</b> để ngồi vào ghế trống, chạm <b>👆 gợi ý</b> giữa màn hình để tương tác</li>
    <li>Ngồi rồi: thanh dưới cùng để <b>dzô</b>, <b>rót</b>, <b>gọi mồi</b>, <b>nước lọc</b>, <b>đứng dậy</b></li>
    <li>Chạm người khác để <b>mời một ly</b> · nút 💸 để tính tiền</li>
    <li>Lên <b>sân khấu karaoke</b> trên sân thượng để hát · nút 🎲 rủ cả bàn chơi trò chơi</li>`;
  $('chat-input').placeholder = 'Nhắn cho cả bàn…';
}
$('prompt').addEventListener('click', () => interact());
// Tên do người chơi tự điền (không có tên ngẫu nhiên); vào lần sau điền sẵn tên đã dùng.
function setName(v) {
  $('player-name').value = v;
  $('player-name').classList.remove('invalid');
  $('preview-name').textContent = v.trim() || '…';
}
$('player-name').addEventListener('input', () => setName($('player-name').value));
function askName(msg) {
  $('start-msg').textContent = msg;
  $('player-name').classList.add('invalid');
  $('player-name').focus();
  $('player-name').select();
}
const joinKey = crypto.randomUUID?.() ?? String(Math.random()).slice(2); // để server nhận ra tab này khi kết nối lại
// Mã người chơi cố định của trình duyệt này: server giữ ví tiền theo mã này nên vào lại vẫn còn tiền.
const playerPid = (() => {
  try {
    let id = localStorage.getItem('nhau3d-pid');
    if (!id) localStorage.setItem('nhau3d-pid', (id = crypto.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2)}`));
    return id;
  } catch { return joinKey; }
})();

function renderPickers() {
  const sp = $('shirt-picker');
  sp.innerHTML = '';
  SHIRTS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (state.look.s === i ? ' on' : '');
    b.style.background = '#' + c.toString(16).padStart(6, '0');
    b.title = 'Màu áo';
    b.onclick = () => { state.look.s = i; renderPickers(); };
    sp.appendChild(b);
  });
  const hp = $('hair-picker');
  hp.innerHTML = '';
  HAIRS.forEach((h, i) => {
    const b = document.createElement('button');
    b.textContent = h;
    b.className = state.look.h === i ? 'on' : '';
    b.onclick = () => { state.look.h = i; renderPickers(); };
    hp.appendChild(b);
  });
  $('belly').checked = !!state.look.b;
  preview.rebuild();
}
$('belly').onchange = (e) => {
  state.look.b = e.target.checked ? 1 : 0;
  preview.rebuild();
};

async function loadRooms() {
  const wrap = $('room-list');
  const getRooms = async (base) => {
    const r = await fetch(new URL('/api/rooms', base), { cache: 'no-store' });
    if (!r.ok) throw new Error();
    return r.json();
  };
  let list = null;
  if (net.sameOrigin !== false) {
    try {
      list = await getRooms(location.origin);
      net.sameOrigin = true;
    } catch { net.sameOrigin = false; }
  }
  if (!list) {
    // Host tĩnh: hỏi từng server cơ sở. Server miễn phí đang ngủ có thể mất gần một phút mới dậy.
    if (!wrap.children.length) wrap.innerHTML = '<span class="small">Đang gọi các cơ sở mở cửa… (lần đầu có thể mất tới 1 phút)</span>';
    const results = await Promise.all(ROOMS.filter((r) => r.server).map((room) =>
      getRooms(room.server).then((l) => l.find((x) => x.id === room.id) || null).catch(() => null)
        .then((info) => info || { id: room.id, name: room.name, down: true })));
    list = results;
  }
  if (!list.length || list.every((r) => r.down)) {
    wrap.innerHTML = '<span class="small">Không thấy server, sẽ chơi một mình (offline). Chạy <code>npm start</code> để chơi nhiều người.</span>';
    return;
  }
  wrap.innerHTML = '';
  for (const r of list) {
    const b = document.createElement('button');
    const full = !r.down && r.count >= r.capacity;
    b.className = r.id === state.room ? 'on' : '';
    b.disabled = full || r.down;
    b.innerHTML = r.down
      ? `${escapeHtml(r.name)}<small>đóng cửa</small>`
      : `${escapeHtml(r.name)}<small>${r.count}/${r.capacity} người${full ? ' · đầy' : ''}</small>`;
    b.onclick = () => { state.room = r.id; loadRooms(); };
    wrap.appendChild(b);
  }
  // Cơ sở đang chọn đóng cửa thì chuyển sang cơ sở đầu tiên còn mở.
  const cur = list.find((r) => r.id === state.room);
  if (!cur || cur.down) {
    const open = list.find((r) => !r.down);
    if (open) { state.room = open.id; loadRooms(); }
  }
}

$('btn-enter').onclick = () => {
  state.name = $('player-name').value.replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!state.name) {
    askName('Nhập tên của bạn trước rồi mới vào quán nhé!');
    return;
  }
  $('start-msg').textContent = '';
  try {
    localStorage.setItem('nhau3d-name', state.name);
    localStorage.setItem('nhau3d-look', JSON.stringify(state.look));
  } catch {}
  const url = new URL(location.href);
  url.searchParams.set('room', state.room);
  history.replaceState(null, '', url);
  $('room-name').textContent = ROOMS.find((r) => r.id === state.room)?.name || '';

  if (meA) removeActor(meA);
  meA = createActor(lookToOpts(state.look, 1), state.name, 'me');
  meA.id = myId;
  placeAt(meA, spawnSpot().x, SPAWN.z, SPAWN.yaw, 0);
  startView();
  setFill(0);
  updateDrunk();

  state.started = true;
  state.startedAt = Date.now();
  net.full = false;
  $('hud').classList.remove('hidden');
  if (!audio) startAmbience();
  loadDzo(); // tải sẵn tiếng hô dzô
  startBgm();
  ac().resume();
  closeModal();
  connect();
  updatePeople();
  setTimeout(() => toast('Click vào một bàn để ngồi. Không có nát, chỉ có dzô 🍻'), 800);
};
$('btn-menu-close').onclick = confirmMenu;
$('btn-menu-x').onclick = () => { menuPicks.clear(); closeModal(); }; // ✕: đóng, bỏ các món đang chọn
$('btn-bill').onclick = () => !modal && showBill();
$('btn-leave').onclick = leaveForHome;
$('btn-home').onclick = leaveForHome;
$('btn-bill-back').onclick = closeModal;
$('btn-pay').onclick = () => send({ t: 'pay' });
$('btn-return').onclick = () => {
  saveSession();
  state.leaving = true; // không tự kết nối lại trong lúc tải lại trang
  net.ws?.close();
  location.reload();
};
$('btn-end-close').onclick = closeEnd;
$('btn-people').onclick = () => $('people-panel').classList.toggle('hidden');
$('btn-sound').onclick = () => {
  muted = !muted;
  ac();
  master.gain.value = muted ? 0 : 1;
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
  voice.setMuteAll(muted);
  syncVideo();
};

// ---------- Bảng cài đặt ----------
const QUALITIES = [['high', 'Đẹp'], ['low', 'Tiết kiệm pin']];
function applyQuality() {
  renderer.setPixelRatio(settings.quality === 'high' ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1));
  renderer.setSize(innerWidth, innerHeight);
  const sw = $('quality-switch');
  sw.innerHTML = '';
  for (const [q, label] of QUALITIES) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = q === settings.quality ? 'on' : '';
    b.onclick = () => { settings.quality = q; settings.qualityPicked = true; saveSettings(); applyQuality(); };
    sw.appendChild(b);
  }
}
function renderSettings() {
  for (const el of document.querySelectorAll('#overlay-settings [data-set]')) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!settings[k];
    else {
      el.value = settings[k];
      el.nextElementSibling.textContent = settings[k];
    }
  }
  document.body.classList.toggle('hide-names', !settings.names);
}
for (const el of document.querySelectorAll('#overlay-settings [data-set]')) {
  el.addEventListener('input', () => {
    const k = el.dataset.set;
    settings[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
    if (k === 'music') settings.musicPicked = true;
    saveSettings();
    renderSettings();
    applyVolumes();
    syncVideo();
  });
}
let settingsReturn = null;
function openSettings() {
  settingsReturn = modal;
  renderSettings();
  openModal('settings');
}
function closeSettings() {
  if (settingsReturn === 'start') openModal('start');
  else closeModal();
}
$('btn-settings').onclick = openSettings;
$('btn-settings-close').onclick = closeSettings;
$('btn-elevator-close').onclick = closeModal;
$('btn-poem-close').onclick = closeModal;

// ---------- Bao chủ quán một ly (giống "cúng dường gạo" của web chùa) ----------
let donateReturn = null;
function openDonate() {
  donateReturn = modal;
  $('donate-bank').textContent = `${DONATE.bank} · ${DONATE.owner}`;
  $('donate-account').textContent = DONATE.account;
  $('btn-copy-account').textContent = '📋 Sao chép';
  openModal('donate');
}
function closeDonate() {
  if (donateReturn === 'start') openModal('start');
  else closeModal();
}
async function copyAccount() {
  let ok = false;
  try {
    await navigator.clipboard.writeText(DONATE.account);
    ok = true;
  } catch {
    // trình duyệt chặn clipboard (http, iframe…): chọn sẵn số để người dùng tự sao chép
    const range = document.createRange();
    range.selectNodeContents($('donate-account'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    ok = document.execCommand?.('copy') ?? false;
  }
  $('btn-copy-account').textContent = ok ? '✅ Đã chép' : '👆 Giữ để chép';
  toast(ok ? 'Đã sao chép số tài khoản 🍻' : 'Không chép tự động được, bạn giữ vào số tài khoản để sao chép nhé');
}
$('btn-donate').onclick = openDonate;
$('btn-donate-close').onclick = closeDonate;
$('btn-copy-account').onclick = copyAccount;
function openPoem(i) {
  const body = $('poem-body');
  body.innerHTML = '';
  for (const line of POEMS[i]) {
    const p = document.createElement('p');
    p.textContent = line;
    body.appendChild(p);
  }
  $('poem-title').textContent = `📜 Thơ nhậu · Bài ${i + 1}`;
  openModal('poem');
}
renderSettings();
applyQuality();

{
  try {
    const saved = localStorage.getItem('nhau3d-name');
    setName(saved && saved !== 'Khách' ? saved : ''); // "Khách" là tên mặc định cũ, không giữ
    Object.assign(state.look, JSON.parse(localStorage.getItem('nhau3d-look')) || {});
  } catch {}
  const qRoom = new URLSearchParams(location.search).get('room');
  if (ROOMS.some((r) => r.id === qRoom)) state.room = qRoom;
  const s = loadStats();
  $('stats').textContent = s.sessions
    ? `Bạn đã nhậu ${s.sessions} cuộc, dzô ${s.cheers} lần, "tiêu" ${fmt(s.spent)} (ảo).`
    : 'Chưa nhậu cuộc nào. Hôm nay mở hàng nhé!';
  renderPickers();
  renderMenu();
  loadRooms();
}

// ================= Vòng lặp =================
const tmp = new THREE.Vector3();
const camTarget = new THREE.Vector3(0, 1.4, 2.4);
const clock = new THREE.Clock();
let focus = null;
let chatTimer = 4, ownerTimer = 10, vendorTimer = 6, singTimer = 0, chefTimer = 5, staffTimer = 8, frameNo = 0;
let lastFilter = '';

function updateMe(dt, t) {
  if (!meA) return;
  if (busy) {
    // Tính theo đồng hồ thật để động tác khớp với tiếng hô dzô, kể cả khi máy chậm, tụt khung hình.
    busy.start ??= performance.now();
    busy.t = (performance.now() - busy.start) / 1000;
    const k = Math.min(1, busy.t / busy.dur);
    busy.tick?.(k);
    if (k >= 1) {
      const done = busy.done;
      busy = null;
      done?.();
    }
  }
  // Chuyến đi thanh toán bị ngắt (lên sân khấu, vào WC…) thì trả lại quyền điều khiển ngay.
  if (paying && !meA.seat && !pending && !riding && !payPause) setPaying(false);
  if (meA.seat || modal || state.passedOut || mic.singer === myId || riding || wcBusy) return;

  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (paying) f = s = 0; // phím đã giữ từ trước cũng không làm lệch đường đi thanh toán
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  let vx = -sy * f + cy * s, vz = -cy * f - sy * s;
  if ((f || s || moveTarget) && meA.dancing) toggleDance(false);
  if (f || s) {
    moveTarget = pending = null;
    marker.visible = false;
  } else if (moveTarget) {
    // Đi qua từng điểm rẽ trước, tới gần điểm rẽ là chuyển sang điểm kế tiếp.
    while (route.length && Math.hypot(route[0].x - meA.x, route[0].z - meA.z) < 0.25) route.shift();
    const wp = route[0] || moveTarget;
    const dx = wp.x - meA.x, dz = wp.z - meA.z, d = Math.hypot(dx, dz);
    if (!route.length && d < 0.12) {
      moveTarget = null;
      marker.visible = false;
      vx = vz = 0;
    } else {
      vx = dx / d;
      vz = dz / d;
    }
  }
  if (pending) {
    const p = pending.pos();
    // Đang đi tới một người cũng đang đi (nhân viên): người đó đổi chỗ thì tính lại đường.
    if (moveTarget && Math.hypot(p.x - moveTarget.x, p.z - moveTarget.z) > 0.8 && (pending.repath = (pending.repath || 0) + dt) > 0.4) {
      pending.repath = 0;
      const keep = pending;
      walkTo(p.x, p.z);
      pending = keep;
    }
    if (Math.hypot(p.x - meA.x, p.z - meA.z) <= pending.range) {
      const action = pending.action;
      pending = moveTarget = null;
      marker.visible = false;
      action();
      return;
    }
  }
  const len = Math.hypot(vx, vz);
  if (len < 0.01) return;
  vx /= len;
  vz /= len;
  // Say thì đi lảo đảo.
  const k = state.drunk / 100, wob = Math.sin(t * 1.7) * k * 0.8;
  const wx = vx + -vz * wob, wz = vz + vx * wob;
  const speed = keys.ShiftLeft || keys.ShiftRight ? 4.2 : 2.4;
  const prev = { x: meA.x, z: meA.z };
  const p = { x: meA.x + wx * speed * dt, z: meA.z + wz * speed * dt };
  collide(p, meA.f);
  meA.x = p.x;
  meA.z = p.z;
  meA.yaw = Math.atan2(vx, vz);
  // Kẹt (đâm vào bàn) thì bỏ đích đến.
  if (moveTarget && !pending && Math.hypot(p.x - prev.x, p.z - prev.z) < speed * dt * 0.2) {
    moveTarget = null;
    marker.visible = false;
  }
}

function updateActor(a, dt, t) {
  const p = a.person;
  if (a.kind === 'me' || a === vendor) {
    a.rx = a.x;
    a.rz = a.z;
  }
  if (!a.seat) {
    const k = Math.min(1, dt * 10);
    const px = a.rx, pz = a.rz;
    a.rx += (a.x - a.rx) * k;
    a.rz += (a.z - a.rz) * k;
    const sp = a === meA || a === vendor ? (a._sp ?? 0) : Math.hypot(a.rx - px, a.rz - pz) / Math.max(dt, 1e-4);
    a.ryaw = lerpAngle(a.ryaw, a.yaw, Math.min(1, dt * 10));
    p.root.position.set(a.rx, a.f * FLOOR_H + (onStage(a) ? 0.2 : 0), a.rz);
    p.root.rotation.y = a.ryaw + (a.dancing ? Math.sin(t * 3 + a.rx) * 0.6 : 0);
    a.walk = sp > 0.3 ? a.walk + dt * Math.min(sp, 4) * 3.2 : 0;
    p.legs.forEach((l, i) => (l.rotation.x = a.walk ? Math.sin(a.walk + i * Math.PI) * 0.5
      : a.dancing ? Math.max(0, Math.sin(t * 6 + i * Math.PI)) * -0.6 : 0));
  }
  // Say thì lắc lư
  p.body.rotation.z = Math.sin(t * 1.3 + a.rx) * 0.12 * (a.d / 100);
  p.body.position.y = (p.seated ? SEAT_DROP : 0)
    + (a.dancing && !p.seated ? Math.abs(Math.sin(t * 6)) * 0.08 : a.singing ? Math.abs(Math.sin(t * 6)) * 0.04 : 0);

  a.animT += dt;
  if (a.anim === 'cheers' && a.animT > 0.8) { a.anim = 'drink'; a.animT = 0; }
  const dur = { drink: 1.3, wave: 1.6, clap: 1.8, pour: 0.9, water: 1.2, offer: 1.4, eat: 1.7 }[a.anim];
  if (dur && a.animT > dur) a.anim = null;

  const rest = p.seated ? -0.35 : 0.05;
  let rx = rest, rz = 0, lx = rest, lz = 0;
  switch (a.anim) {
    case 'cheers': rx = -1.9; break;
    case 'drink': case 'water': rx = -2.6; rz = -0.5; break;
    case 'wave': lx = -2.9; lz = -0.3 + Math.sin(t * 12) * 0.35; break;
    case 'clap': rx = lx = -1.3; rz = -(0.25 + Math.sin(t * 22) * 0.25); lz = -rz; break;
    case 'pour': lx = -1.5; lz = 0.4; rx = -0.9; break;
    case 'offer': rx = -1.6; break;
    case 'eat': { // với xuống đĩa, gắp, đưa lên miệng rồi hạ tay nhai
      const k = a.animT;
      if (k < 0.55) { rx = -0.35 - (k / 0.55) * 0.75; rz = -0.15; }
      else if (k < 0.75) { rx = -1.1; rz = -0.15; }
      else if (k < 1.25) { rx = -1.1 - ((k - 0.75) / 0.5) * 1.5; rz = -0.15 - ((k - 0.75) / 0.5) * 0.35; }
      else { rx = -2.6 + ((k - 1.25) / 0.45) * 2.25; rz = -0.5; }
      break;
    }
  }
  if (a.singing) { rx = -2.5; rz = -0.45; }
  if (a.dancing && !p.seated) {
    // tay vung lên xuống so le theo nhịp
    rx = -2.4 + Math.sin(t * 6) * 0.6;
    lx = -2.4 + Math.sin(t * 6 + Math.PI) * 0.6;
    rz = -0.3 - Math.sin(t * 3) * 0.2;
    lz = 0.3 + Math.sin(t * 3) * 0.2;
    // Vừa hát vừa nhảy: tay phải vẫn cầm mic sát miệng, chỉ nhún nhẹ theo nhịp; tay trái vung tự do
    if (a.singing) { rx = -2.5 + Math.sin(t * 6) * 0.12; rz = -0.45; }
  }
  if (a.fixedArms) rx = lx = a.fixedArms + (a.stir ? Math.sin(t * 5) * 0.25 : 0);
  const k = Math.min(1, dt * 10);
  const [L, R] = p.arms;
  R.rotation.x += (rx - R.rotation.x) * k;
  R.rotation.z += (rz - R.rotation.z) * k;
  L.rotation.x += (lx - L.rotation.x) * k;
  L.rotation.z += (lz - L.rotation.z) * k;
  // Ly để trên bàn trước mặt, chỉ cầm lên tay khi dzô hoặc mời.
  const inHand = a.anim === 'cheers' || a.anim === 'drink' || a.anim === 'offer' || !p.seated;
  if (inHand && p.cup.parent !== R) {
    R.add(p.cup);
    p.cup.position.set(0, -0.28, 0.06);
    p.cup.scale.setScalar(1.3);
  } else if (!inHand && p.cup.parent !== p.root) {
    p.root.add(p.cup);
    p.cup.position.set(-0.16, 0.66, 0.7); // mặt bàn cao 0.57, ly to hơn cho dễ nhìn
    p.cup.rotation.set(0, 0, 0);
    p.cup.scale.setScalar(1.8);
  }
  if (inHand) p.cup.rotation.x = -R.rotation.x + (a.anim === 'drink' ? -0.9 : 0);
  p.cup.visible = p.seated && !a.singing;
  p.bottle.visible = a.anim === 'pour';
  p.bottle.rotation.x = -L.rotation.x + 1.9;
  p.mic.visible = a.singing;
  p.mic.rotation.x = -R.rotation.x - 0.6;

  // NPC quay đầu nhìn mình khi ở gần
  if (a.kind === 'npc' && meA) {
    p.root.worldToLocal(tmp.set(meA.rx, 1.2, meA.rz));
    const near = Math.hypot(meA.rx - a.rx, meA.rz - a.rz) < 5;
    const target = near ? clamp(Math.atan2(tmp.x, tmp.z), -1.1, 1.1) : 0;
    p.head.rotation.y += (target - p.head.rotation.y) * Math.min(1, dt * 3);
  }
  const talking = performance.now() < a.bubbleUntil;
  const chewing = a.anim === 'eat' && a.animT > 1.15;
  p.head.rotation.x = chewing ? Math.sin(t * 18) * 0.07 : talking && a.kind === 'npc' ? Math.sin(t * 14) * 0.08 : 0;
  // Miếng mồi trên tay lúc gắp lên miệng
  if (p.food) p.food.visible = a.anim === 'eat' && a.animT > 0.55 && a.animT < 1.3;
}

// ================= Ăn mồi =================
// Bàn có món thì người ngồi bàn (cả mình, người khác, chú Ba) thỉnh thoảng gắp ăn, món trên đĩa vơi dần.
// Gần hết món thì em order của tầng đó tới bàn gợi ý gọi thêm. Chỉ là diễn hoạt ở máy mình (mỗi máy tự diễn).
const BITE = 0.12; // mỗi miếng ăn bớt chừng này phần đĩa (khoảng 8 miếng hết một đĩa)
const orderTakers = () => [orderTaker, orderTaker2, orderTaker3];
function handFood(a, icon) {
  const p = a.person;
  if (p.foodIcon === icon) return;
  if (p.food) p.food.parent?.remove(p.food);
  p.food = emojiSprite(icon, 0.12);
  p.food.position.set(0, -0.3, 0.1);
  p.food.visible = false;
  p.arms[1].add(p.food);
  p.foodIcon = icon;
}
function setPortion(plate, v) {
  const d = plate.userData;
  d.portion = Math.max(0, v);
  d.sprite.visible = d.portion > 0; // ăn hết thì còn cái đĩa không
  d.sprite.scale.setScalar(0.22 * (0.35 + 0.65 * d.portion));
}
function updateEating(dt) {
  for (const a of [...allActors(), ...npcs]) {
    if (!a.seat || a.anim || a.singing) continue;
    if ((a.eatTimer = (a.eatTimer ?? 3 + Math.random() * 10) - dt) > 0) continue;
    a.eatTimer = 7 + Math.random() * 11;
    if (a === meA && (busy || state.passedOut)) continue;
    const T = TABLES[a.seat.table];
    const plates = T.dishes.children.filter((d) => d.userData.portion > 0);
    if (!plates.length) continue;
    // gắp đĩa gần mình nhất (trong bàn có nhiều đĩa thì đổi món cho tự nhiên)
    plates.sort((x, y) => Math.hypot(x.position.x - a.rx, x.position.z - a.rz) - Math.hypot(y.position.x - a.rx, y.position.z - a.rz));
    const plate = plates[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * plates.length)];
    handFood(a, MENU[plate.userData.item].icon);
    a.anim = 'eat';
    a.animT = 0;
    a.yaw = lerpAngle(seatYaw(T, a.seat.idx), Math.atan2(plate.position.x - a.rx, plate.position.z - a.rz), 0.25); // hơi nghiêng về phía đĩa
    setPortion(plate, plate.userData.portion - BITE);
    if (Math.random() < 0.12) speak(a, pick(['ngon!', 'mồi bén ghê', '😋', 'đưa cay quá', 'nhậu với cái này là hết sẩy']), 1600);
    checkLowFood(T);
  }
}
// Gần hết mồi (còn chưa tới nửa đĩa) mà bàn có khách: em order tầng đó tới gợi ý một món chưa có trên bàn.
function checkLowFood(T) {
  if (T.suggested || !seatedAt(T.id)) return;
  const left = T.dishes.children.reduce((sum, d) => sum + d.userData.portion, 0);
  if (left >= 0.5) return;
  const st = orderTakers()[T.floor];
  if (!st || st.job) return; // em đang bận thì lần gắp sau tính tiếp
  T.suggested = true;
  const onTable = new Set(T.dishes.children.map((d) => d.userData.item));
  const choices = MENU.map((m, i) => i).filter((i) => !MENU[i].special && !onTable.has(i));
  const m = MENU[pick(choices.length ? choices : [0])];
  st.job = 'suggest';
  st.wait = 6;
  goServe(st, T, null, () => {
    st.a.yaw = Math.atan2(T.x - st.a.x, T.z - st.a.z);
    const line = pick([`Mồi sắp hết rồi, anh chị gọi thêm ${m.icon} ${m.name} không ạ?`, `Bàn mình thêm đĩa ${m.icon} ${m.name} nhé, đang ngon lắm ạ!`,
      `Hết mồi là uống không vô đâu ạ, làm thêm ${m.icon} ${m.name} nha?`]);
    speak(st.a, line, 4000);
    if (meA?.seat?.table === T.id) toast(`💁 ${st.a.name}: ${line} (bấm 📜 Gọi mồi để gọi thêm)`);
    setTimeout(() => { st.job = null; }, 4000);
  });
}

function updateWorld(dt, t) {
  updateBeach(dt, t);
  if (seaG.visible) updateSea(dt, t);
  // Cô bán lạc
  vendor.x += vendor.dir * 0.8 * dt;
  vendor._sp = 0.8;
  if (Math.abs(vendor.x) > B.maxX - 1.5) vendor.dir *= -1;
  vendor.yaw = vendor.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

  // Biển: sóng nhấp nhô, bọt sóng vỗ bờ, đèn thuyền bập bềnh
  const pos = seaGeo.attributes.position, arr = pos.array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = seaBase[i], z = seaBase[i + 2] + SEA_Z + 300;
    const amp = 0.12 + Math.min(1, (z - SEA_Z) / 80) * 0.35;
    arr[i + 1] = Math.sin(x * 0.05 + t * 0.9) * amp * 0.6 + Math.sin(z * 0.11 - t * 1.4) * amp;
  }
  pos.needsUpdate = true;
  if ((frameNo = (frameNo + 1) % (settings.quality === 'high' ? 3 : 12)) === 0) seaGeo.computeVertexNormals();
  foams.forEach((f) => {
    const k = Math.sin(t * 0.45 + f.userData.phase);
    f.position.z = SEA_Z + 1 + k * 2.2 + f.userData.phase;
    f.material.opacity = 0.15 + Math.max(0, -k) * 0.45;
  });
  boats.forEach((b) => (b.position.y = 0.6 + Math.sin(t * 0.8 + b.userData.phase) * 0.25));
  turbine.rotation.y += dt * 3;
  for (const d of elevatorDoors) {
    d.open += (d.target - d.open) * Math.min(1, dt * 7);
    const w = LIFT_PANEL * (1 - d.open * 0.9);
    d.left.scale.x = d.right.scale.x = w / LIFT_PANEL;
    d.left.position.x = EL.x - EL.w / 2 + 0.1 + w / 2;
    d.right.position.x = EL.x + EL.w / 2 - 0.1 - w / 2;
  }
  // Cửa WC: có người (cùng tầng) đứng gần thì mở vào trong, đi rồi thì đóng lại
  for (const d of wcDoors) {
    const near = allActors().some((a) => a.f === d.f && Math.hypot(a.rx - d.x, a.rz - d.z) < 1.4);
    d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 6);
    d.pivot.rotation.y = d.open * 1.45 * d.dz;
  }
  // Cửa buồng nữ: trống thì để mở, có người vào thì đóng
  for (const d of stallDoors) {
    const used = allActors().some((a) => a.f === d.f && inRect(d.zone, a.rx, a.rz));
    d.open += ((used ? 0 : 1) - d.open) * Math.min(1, dt * 5);
    d.pivot.rotation.y = d.open * d.openAng;
  }
  dumbwaiterLamps.forEach((l) => {
    const on = performance.now() < (l.userData.until || 0);
    l.material.color.setHex(on ? (Math.floor(t * 6) % 2 ? 0x76ff03 : 0x33691e) : 0x33691e);
  });

  // Bếp: lửa bập bùng, khói bốc lên
  flames.forEach((fl, i) => fl.scale.set(1, 0.8 + Math.sin(t * 13 + i * 2) * 0.25 + Math.random() * 0.1, 1));
  stoveLight.intensity = 5 + Math.sin(t * 11) * 1.2;
  for (const s of steam) {
    s.userData.t = (s.userData.t + dt * 0.35) % 1;
    s.position.y = 1.3 + s.userData.t * 1.6;
    s.material.opacity = 0.5 * (1 - s.userData.t);
  }

  for (const c of traffic) {
    // Có người đi ngang ngay trước mặt (trong làn, phía trước tối đa 6 m) thì phanh, qua rồi chạy tiếp.
    const dir = Math.sign(c.base), cx = c.g.position.x, cz = c.g.position.z;
    const blocked = allActors().some((a) => a.f === 0 && Math.abs(a.rz - cz) < 1.3 && (a.rx - cx) * dir > -0.6 && (a.rx - cx) * dir < 6);
    c.speed += ((blocked ? 0 : c.base) - c.speed) * Math.min(1, dt * (blocked ? 6 : 1.2));
    c.g.position.x += c.speed * dt;
    if (Math.abs(c.g.position.x) > 32) c.g.position.x = -Math.sign(c.speed) * 32;
  }
  for (let i = popIns.length - 1; i >= 0; i--) {
    const p = popIns[i];
    p.t += dt * 3;
    p.obj.scale.setScalar(Math.min(1, p.t) * (1 + Math.sin(Math.min(1, p.t) * Math.PI) * 0.3));
    if (p.t >= 1) popIns.splice(i, 1);
  }
  karaokeSign.material.color.setHSL(0.85, 1, mic.singer ? 0.5 + Math.sin(t * 8) * 0.2 : 0.35);
}

function updateChatter(dt) {
  if (!meA) return;
  const near = (a, r) => a.f === meA.f && Math.hypot(a.rx - meA.rx, a.rz - meA.rz) < r;
  chatTimer -= dt;
  if (chatTimer <= 0) {
    chatTimer = 6 + Math.random() * 5;
    if (near(chuBa, 7)) speak(chuBa, pick(LINES.chuBa));
  }
  ownerTimer -= dt;
  if (ownerTimer <= 0) {
    ownerTimer = 16 + Math.random() * 10;
    if (near(owner, 8)) speak(owner, pick(LINES.owner));
  }
  staffTimer -= dt;
  if (staffTimer <= 0) {
    staffTimer = 14 + Math.random() * 8;
    if (near(waiter, 7)) speak(waiter, pick(LINES.waiter));
    else if (near(guard, 7)) speak(guard, pick(LINES.guard));
  }
  chefTimer -= dt;
  if (chefTimer <= 0) {
    chefTimer = 12 + Math.random() * 8;
    if (near(chef, 7)) speak(chef, pick(LINES.chef));
  }
  vendorTimer -= dt;
  if (vendorTimer <= 0) {
    vendorTimer = 10 + Math.random() * 6;
    if (near(vendor, 10)) speak(vendor, pick(LINES.vendor));
  }
  for (const a of allActors()) {
    if (!a.dancing) continue;
    a.danceTimer = (a.danceTimer ?? Math.random() * 2) - dt;
    if (a.danceTimer <= 0) {
      a.danceTimer = 2.5 + Math.random() * 1.5;
      speak(a, pick(['💃', '🕺', '🎶', '🙌', '🎵 la la']), 1400);
    }
  }
  singTimer -= dt;
  if (singTimer <= 0 && mic.singer) {
    singTimer = 2.5;
    speak(actorById(mic.singer), pick(['🎵', '🎶', '🎤🎵', `🎶 ${mic.track?.title || 'la la la'}`]), 2000);
  }
}

const seatOnlyBtns = document.querySelectorAll('.seat-only');
function updateFocus() {
  focus = null;
  const el = $('prompt');
  const seated = !!meA?.seat && state.started;
  const danceBtn = $('btn-dance');
  // Dzô, rót, gọi mồi, nước lọc chỉ dùng khi ngồi bàn; nút nhảy chỉ hiện khi đứng.
  seatOnlyBtns.forEach((b) => b.classList.toggle('hidden', !seated));
  danceBtn.classList.toggle('hidden', seated);
  danceBtn.classList.toggle('on', !!meA?.dancing);
  danceBtn.querySelector('span').textContent = meA?.dancing ? 'Thôi nhảy' : 'Nhảy';
  syncActionGroups();
  $('btn-stand').classList.toggle('hidden', !seated);
  $('btn-fish').classList.toggle('hidden', !canFish());
  $('btn-invite').classList.toggle('hidden', !seated || !tableMates().length); // bàn từ 2 người trở lên mới mời ly được
  // Trò chơi cùng bàn cần ít nhất 2 người chơi thật (không tính nhân viên, khách ảo)
  const gamesBtn = document.querySelector('[data-act="games"]'), canGame = seated && tableMates().some((o) => !npcs.includes(o));
  gamesBtn.disabled = !canGame;
  gamesBtn.title = canGame ? 'Trò chơi cùng bàn (9)' : 'Cần ít nhất 2 người ngồi cùng bàn mới chơi được';
  $('chat').classList.toggle('hidden', !state.started);
  $('chat-tab-table').disabled = !seated;
  if (!meA || modal || !state.started || meA.seat) { el.classList.add('hidden'); return; }
  let best = Infinity;
  for (const o of clickables) {
    const c = o.userData.click;
    if (o === meA.hit || floorOf(c) !== meA.f) continue;
    const p = c.pos();
    const d = Math.hypot(p.x - meA.x, p.z - meA.z);
    if (d <= c.range && d < best) { best = d; focus = c; }
  }
  if (focus) {
    el.innerHTML = `${KEY_HINT} ${focus.label()}`;
    el.classList.remove('hidden');
  } else el.classList.add('hidden');
}

// Tầng phòng riêng: đứng/ngồi trong phòng thì tường của phòng đó mờ đi; tường nào chắn giữa camera và mình cũng mờ.
const wallRay = new THREE.Raycaster();
function fadeRoomWalls(dt) {
  if (!roomFloorWalls.length) return;
  const here = meA?.f === 1 && floors[1].visible ? meA : null;
  const room = here && TABLES.find((T) => T.private && T.room && here.rx > T.room.minX && here.rx < T.room.maxX && here.rz > T.room.minZ && here.rz < T.room.maxZ)?.room;
  const block = new Set();
  if (here) {
    const dir = camera.position.clone().sub(camTarget), len = dir.length();
    wallRay.set(camTarget, dir.normalize());
    wallRay.far = len;
    for (const h of wallRay.intersectObjects(roomFloorWalls, false)) block.add(h.object);
  }
  const k = Math.min(1, dt * 8);
  for (const m of roomFloorWalls) {
    const p = m.position, edge = 0.15;
    const ofRoom = room && p.x >= room.minX - edge && p.x <= room.maxX + edge && p.z >= room.minZ - edge && p.z <= room.maxZ + edge;
    const want = ofRoom || block.has(m) ? 0.15 : 1;
    if (Math.abs(m.userData.fade - want) < 0.005) continue;
    m.userData.fade += (want - m.userData.fade) * k;
    if (Math.abs(m.userData.fade - want) < 0.01) m.userData.fade = want;
    const see = m.userData.fade < 1;
    if (m.material.transparent !== see) { m.material.transparent = see; m.material.needsUpdate = true; }
    m.material.opacity = m.userData.fade;
    m.material.depthWrite = m.userData.fade >= 1;
  }
}
function updateCamera(dt, t) {
  const k = state.drunk / 100;
  if (meA) {
    const y = meA.f * FLOOR_H + (meA.seat ? 1.05 : 1.45 + (onStage(meA) ? 0.2 : 0));
    camTarget.lerp(tmp.set(meA.rx, y, meA.rz), Math.min(1, dt * 8));
  }
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist,
    Math.max((meA?.f ?? 0) * FLOOR_H + 0.3, camTarget.y + Math.sin(cam.pitch) * cam.dist),
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  camera.lookAt(camTarget);
  fadeRoomWalls(dt);
  if (!cinematicCamera(dt)) camera.rotateZ(Math.sin(t * 0.9) * 0.08 * k);
  camera.rotateY(Math.sin(t * 0.5) * 0.04 * k);
  const filter = k > 0.3 ? `blur(${((k - 0.3) * 3).toFixed(1)}px) saturate(${(1 + k * 0.6).toFixed(2)})` : '';
  if (filter !== lastFilter) {
    canvas.style.filter = filter;
    lastFilter = filter;
  }
  scene.fog.far = fogFar - k * (fogFar - 40);
}

function updateTags() {
  const now = performance.now();
  for (const a of [...allActors(), ...npcs]) {
    if (a.bubbleUntil && now > a.bubbleUntil) {
      a.bubble.classList.add('hidden');
      a.bubbleUntil = 0;
    }
    if (!floors[a.f].visible || (meA && a.f !== meA.f)) {
      a.tag.style.display = 'none';
      continue;
    }
    a.person.head.getWorldPosition(tmp);
    tmp.y += 0.42;
    const dist = tmp.distanceTo(camera.position);
    const talking = a.bubbleUntil > 0;
    tmp.project(camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.2 || dist > (talking ? 16 : 11)) {
      a.tag.style.display = 'none';
      continue;
    }
    a.tag.style.display = '';
    const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight;
    a.tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${clamp(5 / dist, 0.65, 1)})`;
  }
}

function sendMove() {
  if (!meA || !net.online) return;
  const now = performance.now();
  if (now - net.lastSent < 100) return;
  const key = `${meA.x.toFixed(2)},${meA.z.toFixed(2)},${meA.yaw.toFixed(2)},${Math.round(state.drunk)},${meA.f}`;
  if (key === net.lastKey) return;
  net.lastKey = key;
  net.lastSent = now;
  send({ t: 'move', x: meA.x, z: meA.z, f: meA.f, yaw: meA.yaw, d: Math.round(state.drunk) });
}

let firstFrame = true;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (meA) {
    const px = meA.x, pz = meA.z;
    updateMe(dt, t);
    updateWC();
    updateWading();
    const hk = `${meA.f}:${Math.round(beachAway() * 20)}:${Math.round(leftQuan() * 10)}`;
    if (hk !== heardKey) {
      heardKey = hk;
      applyVolumes();
      syncVideo();
    }
    meA._sp = Math.hypot(meA.x - px, meA.z - pz) / Math.max(dt, 1e-4);
  }
  updateWorld(dt, t);
  updateTrader(dt);
  updateEating(dt);
  updateStaff(dt);
  updateStageFx(dt, t);
  tableGames.update();
  updateBeachItems(t);
  updateFishGame(dt);
  updateFishing(dt, t);
  for (const a of [...allActors(), ...npcs]) updateActor(a, dt, t);
  if (state.started) {
    updateChatter(dt);
    sendMove();
  }
  updateVisibility();
  updateFocus();
  updateCamera(dt, t);
  updateTags();
  renderer.render(scene, camera);
  updateScreen();
  if (modal === 'start') preview.render(dt, t);
  if (firstFrame) {
    firstFrame = false;
    window.__boot?.(92, 'Đang bày bàn ghế…');
    requestAnimationFrame(() => window.__bootDone?.()); // khung hình đầu đã vẽ xong
  }
  requestAnimationFrame(loop);
}
loop();

// Dùng cho kiểm thử trong console
window.__beachFirst = () => [...beachItems.values()][0]?.it;
window.__bgmEl = () => bgmEl;
window.__nhau = { state, updateDrunk, clickDoor: (id) => goTo({ info: doors.get(id).userData.click }), doorScreen: (id) => { const v = new THREE.Vector3(); doors.get(id).getWorldPosition(v); v.project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, popups: { openDonate, openBag, openSettings, showBill, openMenu, openPoem, askStand, invitePick, rideMenu: () => openFloorPicker("🛗 Thang máy", [0, 1, 2], rideElevator), openModal, songs: () => openSongPicker(true), games: () => tableGames.openPicker() }, lockState: () => ({ modal, paying, payPause, riding, wcBusy, busy: !!busy, passedOut: state.passedOut, fade: +($('fade').style.opacity || 0), started: state.started, fishing: modal === 'fish', cine: !!catchFx }), openSongPicker, FX, playCatch, stepCatch, get catchFx() { return catchFx; }, endCatch, showCatch, fishGame, rideElevator, cam, audioInfo: () => ({ bgmFile: bgmEl && { t: +bgmEl.currentTime.toFixed(2), paused: bgmEl.paused }, bgmStep: BGM.step, music: buses.music?.gain.value, karaoke: buses.karaoke?.gain.value, video: tv.player?.getVolume?.(), ctx: audio?.state }), get me() { return meA; }, walkTo, findPath, get localPlaying() { return !!local.src && { t: +(audio.currentTime - local.at).toFixed(1), dur: +local.buf.duration.toFixed(1), gain: +local.gain.gain.value.toFixed(2) }; }, remotes, TABLES, send, cheers, emote, get mic() { return mic; }, tv, screenVideoEl, local, get audio() { return audio; }, DZO, tabs, trader, staff };
