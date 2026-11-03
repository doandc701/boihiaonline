// Bơi Hia Dứt Cạn — quán nhậu 3D nhiều người: ngồi chung bàn, không chat, chỉ có hành động.
import * as THREE from 'three';
window.__boot?.(65, 'Đang dựng quán…');
import {
  ROOMS, TABLES, STAGE, MENU, MENU_CATS, SHIRTS, HAIRS, SONG_MS, MIC_DELAY_MS,
  FLOOR_H, FLOOR_NAMES, FLOOR_BOUNDS, SHORE, BUILDING, CORE, ELEVATOR, KITCHEN, WCS, DUMBWAITER, PARKING,
  GOLDEN_EVERY, GOLDEN_MS, MAX_SONG_MS, CHAT_MAX, seatPos, seatYaw, nearestFreeSeat, DRINKS, drinkOfTable, tabTotal,
} from '/shared/world.js';
import { SONGS, GENRES, DEFAULT_SONG, parseYouTube } from '/shared/songs.js';

// ================= Cấu hình =================
// Tài khoản nhận ủng hộ ("Bao chủ quán một ly"), ảnh QR ở public/donate-qr.png.
const DONATE = { bank: 'BIDV', owner: 'NGUYEN XUAN DOAN', account: '2152971408' };
const BEER = DRINKS.beer; // giá đồ uống dùng chung với server (shared/world.js)
const ROUND_PRICE = 500000;
const HAIR_COLORS = [0x1b1b1b, 0x3b2314, 0x5a3a22, 0x111111];
const drinkOf = (tableId) => drinkOfTable(TABLES[tableId]);
const tableName = (T) => T.name;

const LINES = {
  chuBa: ['Hồi xưa chú đi bộ đội…', 'Rượu này chú ngâm mười năm đấy.', 'Đời mà con, vui được ngày nào hay ngày đó.',
    'Con có người yêu chưa?', 'Uống rượu phải từ từ, ngấm mới ngon.', 'Ngồi đây với chú một lát.'],
  chuBaCheers: ['Cạn!', 'Dzô con!', 'Uống cho ấm bụng!'],
  chuBaReply: ['Ừ, chú nghe đây.', 'Nói hay lắm, dzô cái nào!', 'Hồi xưa chú cũng thế.', 'Thôi uống đi con, chuyện đâu còn đó.',
    'Ha ha, con nói chí phải!', 'Tuổi trẻ mà, cứ từ từ.'],
  owner: ['Ăn gì gọi chị nhé!', 'Mực nướng hôm nay tươi lắm!', 'Bàn ngoài kia tính tiền chưa em?'],
  vendor: ['Lạc rang đây!', 'Đậu phộng nóng đây!', 'Mua giúp cô gói lạc đi con!'],
  guard: ['Xe để đây bác trông cho, yên tâm mà nhậu!', 'Say thì để xe lại, mai lấy nhé con.', 'Gió biển đêm nay mát ghê.'],
  waiter: ['Tầng này có thang tời, đồ ăn lên nhanh lắm ạ!', 'Cần thêm đá cứ gọi em nhé!', 'Phòng view biển đẹp nhất quán đó ạ.'],
  chef: ['Bếp nóng lắm, đứng xa ra kẻo bỏng!', 'Mực hôm nay tươi rói, gọi đi!', 'Nấu ba chục năm rồi đấy.',
    'Lẩu thái phải chua cay mới đúng vị.', 'Ra ngoài uống đi, đồ ăn chú mang ra ngay.'],
};
const ACT_EMOJI = { cheers: '🥂 Dzô!', pour: '🍺', wave: '👋', clap: '👏', water: '💧' };

const DRUNK_LEVELS = [
  { at: 0, label: 'Tỉnh táo' },
  { at: 25, label: 'Lâng lâng', msg: 'Bắt đầu thấy lâng lâng rồi đấy 😊' },
  { at: 55, label: 'Say rồi', msg: 'Mặt đỏ tưng bừng, đi đứng loạng choạng 🥴' },
  { at: 85, label: 'Sắp gục', msg: 'Sắp gục rồi! Uống nước lọc đi (6) 💧' },
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
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
function wall(f, x1, z1, x2, z2, h, color, { y = 0, solid = true, front = false } = {}) {
  const w = Math.abs(x2 - x1) || 0.2, d = Math.abs(z2 - z1) || 0.2, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const m = box(w, h, d, color, cx, y + h / 2, cz, floors[f]);
  if (solid) solidBox(f, cx, cz, w, d);
  if (front) facade[f].push(m);
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
cyl(0.015, 0.015, 1.3, 0x888888, STAGE.x - 0.1, 0.85, STAGE.z, F3);
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
const karaokeSign = add(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: karaokeTex }), STAGE.x + 1.8, 1.9, STAGE.z, F3);
karaokeSign.rotation.y = -Math.PI / 2;
const stageLight = pointLight(F3, 0xe040fb, 0, 7, STAGE.x, 2.4, STAGE.z);
solidBox(2, STAGE.x + 1.6, STAGE.z, 0.5, 3.6);
clickable(box(STAGE.w, 1.8, STAGE.d, HIT_MAT, STAGE.x, 0.9, STAGE.z, F3), {
  f: STAGE.floor,
  pos: () => ({ x: STAGE.x - 0.8, z: STAGE.z }),
  range: 2,
  label: () => (mic.singer === myId ? 'đang hát…' : inMicQueue() ? 'đang xếp hàng hát' : '🎤 lên <b>hát karaoke</b>'),
  action: () => singDefault(),
});

// ---------- Bàn & ghế ----------
const glassMat = mat(0x1d6b35, { roughness: 0.15, metalness: 0.1 });
const STOOL = { 'Vỉa hè': 0xd62828, 'Trong nhà': 0xd62828, 'Phòng riêng': 0x6d4c41, 'Sân thượng': 0x1e88e5 };
// Điểm ngẫu nhiên trên mặt bàn (để đặt chai, đĩa mồi)
function spotOnTable(T) {
  if (T.shape === 'long') return { x: T.x + (Math.random() - 0.5) * (T.len - 0.3), z: T.z + (Math.random() - 0.5) * (T.w - 0.3) };
  const a = Math.random() * Math.PI * 2, r = Math.random() * (T.r - 0.2);
  return { x: T.x + Math.sin(a) * r, z: T.z + Math.cos(a) * r };
}
for (const T of TABLES) {
  const P = floors[T.floor];
  const top = T.private ? mat(0x795548, { roughness: 0.5 }) : mat(0xb0b8c0, { metalness: 0.6, roughness: 0.35 });
  if (T.shape === 'long') {
    // Ghép nhiều bàn vuông thành bàn dài cho nhóm 10–12 người
    const piece = T.len / T.pieces;
    for (let k = 0; k < T.pieces; k++) {
      const px = T.x - T.len / 2 + piece * (k + 0.5);
      box(piece - 0.03, 0.04, T.w, top, px, 0.55, T.z, P);
      for (const [lx, lz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        cyl(0.02, 0.02, 0.55, 0x90a4ae, px + lx * (piece / 2 - 0.08), 0.27, T.z + lz * (T.w / 2 - 0.08), P);
      }
    }
    solidBox(T.floor, T.x, T.z, T.len + 0.3, T.w + 1.3);
  } else {
    cyl(T.r, T.r, 0.04, top, T.x, 0.55, T.z, P);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      cyl(0.02, 0.02, 0.55, 0x90a4ae, T.x + Math.sin(a) * (T.r - 0.15), 0.27, T.z + Math.cos(a) * (T.r - 0.15), P);
    }
    solidCircle(T.floor, T.x, T.z, T.r + 0.65);
  }
  const sc = STOOL[T.area] ?? 0xd62828;
  for (let i = 0; i < T.seats; i++) {
    const s = seatPos(T, i);
    cyl(0.16, 0.16, 0.04, sc, s.x, 0.32, s.z, P);
    cyl(0.14, 0.19, 0.3, sc, s.x, 0.15, s.z, P);
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
  clickable(hit, {
    tableId: T.id,
    f: T.floor,
    pos: () => T,
    range: T.shape === 'long' ? T.len / 2 + 1.6 : T.r + 1.6,
    label: () => {
      const used = seatedAt(T.id) + (T.npcSeats?.length || 0);
      const st = roomState.get(T.id);
      if (st?.locked && st.owner !== myId) return `🔒 ${T.name} đã khoá`;
      return used >= T.seats ? `${T.name} đã đủ người` : `ngồi vào <b>${T.name}</b> (${used}/${T.seats})`;
    },
    action: () => send({ t: 'sit', table: T.id }),
  });
}

// ================= Nhân vật =================
// Nhân vật kiểu chibi: đầu to tròn, mắt nhắm cười "^ ^", má hồng, thân tròn ngắn, tay chân mũm mĩm.
const PERSON_HIP = 0.5; // độ cao hông khi đứng
const SEAT_DROP = -0.12; // hạ thân khi ngồi ghế nhựa
const SKIN_DEFAULT = 0xf0b27a;
function makePerson(o = {}) {
  const { shirt = 0x2e86de, pants = 0x2d3436, skin = SKIN_DEFAULT, hair = 0x1b1b1b, bald = false, female = false, belly = 1, hat = false, chefHat = false } = o;
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
  label: () => 'gọi món / tính tiền ở <b>quầy thu ngân</b>',
  action: () => { speak(owner, 'Em ăn gì nào?'); openMenu(); },
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
    speak(vendor, 'Cảm ơn con nhé!');
    state.extras.push(MENU[0]);
    speak(meA, '🥜 nhai lạc', 2000);
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
  pos: () => ({ x: 4, z: -9.6 }),
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
const npcs = [chuBa, owner, vendor, chef, waiter, guard];

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
  music: 50, ambience: 70, sfx: 80, karaoke: 80, // âm lượng 0–100
  bgPlay: false, // phát tiếp khi chuyển tab
  quality: 'high', // điện thoại cũng mặc định Đẹp; ai cần pin thì tự chọn Tiết kiệm pin
  qualityPicked: false, // người chơi đã tự chọn chất lượng đồ hoạ chưa
  names: true,
};
try {
  const saved = JSON.parse(localStorage.getItem('nhau-settings')) || {};
  // Bản cũ lưu sẵn 'low' cho điện thoại dù người chơi chưa chọn: bỏ đi để dùng mặc định mới.
  if (!saved.qualityPicked) delete saved.quality;
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
const hearsKaraoke = () => !!mic.singer && meA?.f === STAGE.floor;
function applyVolumes() {
  if (!audio) return;
  const t = audio.currentTime, karaoke = hearsKaraoke();
  buses.ambience.gain.setTargetAtTime(settings.ambience / 100, t, 0.05);
  buses.sfx.gain.setTargetAtTime(settings.sfx / 100, t, 0.05);
  buses.karaoke.gain.setTargetAtTime(karaoke ? settings.karaoke / 100 : 0, t, 0.3);
  // Đang nghe karaoke thì nhạc nền nhỏ dần rồi tắt, ở tầng khác nhạc nền vẫn chạy
  buses.music.gain.setTargetAtTime(karaoke ? 0 : (settings.music / 100) * 0.9, t, karaoke ? 0.6 : 1.2);
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
function startBgm() {
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
  else if (!document.hidden) audio.resume();
  syncVideo();
});
// Điện thoại chỉ cho bật âm thanh trong lúc người dùng chạm: khoá màn hình/chuyển app quay lại mà âm thanh
// còn dừng ("suspended" / iOS "interrupted") thì lần chạm kế tiếp bật lại.
for (const ev of ['pointerdown', 'touchend', 'keydown']) {
  addEventListener(ev, () => {
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
function stopSong() {
  songNodes.forEach((n) => { try { n.stop(); } catch {} });
  songNodes = [];
}
function playSong(seed, startAtServer) {
  stopSong();
  const a = ac();
  let s = seed + 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const BEAT = 0.5, BARS = SONG_MS / 1000 / (BEAT * 4);
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
    songNodes.push(o);
  };
  for (let bar = 0; bar < BARS; bar++) {
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
  }
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

const tv = { player: null, yt: null, startAt: 0, failed: false, local: false, localMute: false, fallbackTimer: null };

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
  clearTimeout(tv.fallbackTimer);
  Object.assign(tv, { yt: track.yt, startAt, failed: false, local: false });
  $('tv-title').textContent = `🎤 ${track.title}${track.by ? ' · ' + track.by : ''}`;
  const buf = await localBuffer(track.yt);
  if (tv.yt !== track.yt) return; // đã đổi bài trong lúc tải
  if (buf) {
    try { tv.player?.stopVideo?.(); } catch {}
    tv.local = true;
    local.buf = buf;
    $('tv').classList.add('hidden');
    startLocal((serverNow() - startAt) / 1000);
    syncVideo();
    applyVolumes();
    return;
  }
  $('tv').classList.remove('hidden');
  let YT;
  try { YT = await loadYT(); } catch { videoFailed(); return; }
  if (tv.yt !== track.yt) return; // đã đổi bài trong lúc tải
  const start = Math.max(0, (serverNow() - startAt) / 1000);
  if (!tv.player) {
    tv.player = new YT.Player('tv-player', {
      width: '100%', height: '100%', videoId: track.yt,
      playerVars: { autoplay: 1, start: Math.floor(start), playsinline: 1, rel: 0 },
      events: {
        onReady: () => syncVideo(),
        onStateChange: (e) => {
          // Video hết thì người hát trả mic cho người tiếp theo.
          if (e.data === 0 && mic.singer === myId && tv.yt) send({ t: 'mic-leave' });
        },
        onError: videoFailed,
      },
    });
  } else {
    tv.player.loadVideoById({ videoId: track.yt, startSeconds: start });
  }
}

function stopVideo() {
  clearTimeout(tv.fallbackTimer);
  tv.yt = null;
  tv.local = false;
  stopLocal();
  try { tv.player?.stopVideo?.(); } catch {}
  $('tv').classList.add('hidden');
}

function videoFailed() {
  if (!tv.yt || tv.failed) return;
  tv.failed = true;
  toast('Video này không phát được ở đây, chuyển sang beat tự chế 🎹');
  $('tv').classList.add('hidden');
  playSong(mic.song, mic.startAt);
  // Beat tự chế chỉ dài SONG_MS, hết beat thì người hát tự trả mic.
  const left = mic.startAt + SONG_MS - serverNow();
  if (mic.singer === myId) tv.fallbackTimer = setTimeout(() => send({ t: 'mic-leave' }), Math.max(0, left));
}

// Nhạc từ file trên máy: khớp giờ server, cả tầng sân khấu nghe như nhau (xem hearsKaraoke).
function syncLocal() {
  if (!local.src || !local.gain) return;
  const a = ac(), elapsed = (serverNow() - tv.startAt) / 1000;
  if (elapsed < local.buf.duration && Math.abs(a.currentTime - local.at - elapsed) > 2.5) startLocal(elapsed);
  const off = !hearsKaraoke() || tv.localMute || muted || (document.hidden && !settings.bgPlay);
  local.gain.gain.setTargetAtTime(off ? 0 : settings.karaoke / 100, a.currentTime, 0.3);
}

// Giữ video khớp giờ server; âm lượng theo tầng như syncLocal.

function syncVideo() {
  if (tv.local && tv.yt) return syncLocal();
  const p = tv.player;
  if (!p?.getPlayerState || !tv.yt || tv.failed) return;
  const elapsed = (serverNow() - tv.startAt) / 1000;
  const st = p.getPlayerState();
  if (elapsed < 0) {
    if (st === 1) p.pauseVideo();
    return;
  }
  if (st === -1 || st === 2 || st === 5) p.playVideo();
  if (st === 1 && Math.abs(p.getCurrentTime() - elapsed) > 2.5) p.seekTo(elapsed, true);
  p.setVolume(settings.karaoke);
  if (!hearsKaraoke() || tv.localMute || muted || settings.karaoke === 0 || (document.hidden && !settings.bgPlay)) p.mute();
  else p.unMute();
}
setInterval(syncVideo, 1000);

$('tv-toggle').onclick = () => $('tv').classList.toggle('collapsed');
$('tv-sound').onclick = () => {
  tv.localMute = !tv.localMute;
  $('tv-sound').textContent = tv.localMute ? '🔇' : '🔊';
  syncVideo();
};

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

// force: mở ngay cả khi vẫn đang giữ mic (vừa gửi mic-leave để đổi bài, server chưa kịp báo lại).
function openSongPicker(force = false) {
  if (!force && mic.singer === myId) return;
  if (!force && inMicQueue()) return toast('Bạn đang xếp hàng rồi, chờ tới lượt nhé!');
  $('song-hint').textContent = features.ytSearch
    ? 'Chọn bài là có video karaoke kèm lời chạy chữ.'
    : 'Bài có 🎬 sẽ phát video karaoke. Bài khác dùng beat tự chế, hoặc dán link YouTube karaoke ở trên.';
  $('song-search').value = '';
  $('song-url').value = '';
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
    b.onclick = () => { songGenre = g; renderSongs(); };
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
  if (!songs.length) list.innerHTML = '<p class="small">Không có bài nào khớp. Dán link YouTube ở dưới nhé!</p>';
}

function joinMic(payload, title) {
  send({ t: 'mic-join', ...payload });
  closeModal();
  toast(`Đã xếp hàng hát “${title}” 🎤`);
}

$('song-search').addEventListener('input', renderSongs);
$('btn-songs-close').onclick = closeModal;
$('btn-song-url').onclick = () => {
  const url = $('song-url').value.trim();
  if (!parseYouTube(url)) return toast('Link YouTube không hợp lệ');
  joinMic({ url }, 'bài tự chọn');
};

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
const net = { ws: null, online: false, offset: 0, lastSent: 0, lastKey: '', sameOrigin: null };
const serverNow = () => Date.now() + net.offset;
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
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: state.name, look: state.look }));
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'welcome') welcomed = true;
    onMessage(m);
  };
  ws.onclose = () => {
    if (state.leaving || net.full) return;
    if (!welcomed) { goOffline(); return; }
    net.online = false;
    toast('Mất kết nối, đang nối lại…');
    for (const id of [...remotes.keys()]) removeRemote(id);
    if (meA.seat) unseatActor(meA);
    setTimeout(connect, 2000);
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
    case 'act':
      if (m.k === 'pour' && meA.seat) {
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
      if (meA.seat) reply({ t: 'chat', id: myId, table: meA.seat.table, text: m.text.trim().slice(0, CHAT_MAX) });
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
      net.offset = m.now - Date.now();
      lastDayK = -1;
      updateDayNight();
      m.players.forEach(addRemote);
      TABLES.forEach((T) => T.dishes.clear());
      m.dishes.forEach((items, table) => items.forEach((item) => serveDish(table, item, true)));
      features = m.features || features;
      setMic(m.mic);
      placeAt(meA, Math.random() * 2 - 1, 2.6, Math.PI, 0);
      roomState.clear();
      (m.rooms || []).forEach((rm) => onMessage(rm));
      (m.tabs || []).forEach((tb) => onMessage(tb));
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
      seatActor(a, m.table, m.idx);
      if (a === meA) onSitMine();
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
    case 'sit-fail':
      toast(m.locked ? `🔒 ${tableName(TABLES[m.table])} đã khoá, gõ cửa cũng không ai mở đâu!` : `${tableName(TABLES[m.table])} hết ghế rồi, thử bàn khác nhé!`);
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
        if (m.to === myId) {
          toast(`${a.name} mời bạn một ly! 🍻`);
          if (meA.seat && state.fill < 0.5) setFill(0.95);
        }
      } else if (m.k === 'dance' || m.k === 'dance-stop') {
        a.dancing = m.k === 'dance';
        if (a.dancing) speak(a, '💃 nhảy nào!', 1800);
      } else playAct(a, m.k);
      break;
    }
    case 'dish': {
      const T = TABLES[m.table], dish = MENU[m.item];
      if (T.floor === 0) {
        serveDish(m.table, m.item);
        speak(chef, `🔥 ${dish.name} có ngay!`, 2500);
      } else {
        // Món lên tầng trên đi bằng thang tời: đèn thang tời tầng đó sáng, kêu "ding", rồi món ra bàn.
        speak(chef, `🔥 ${dish.name} · gửi thang tời lên ${FLOOR_NAMES[T.floor]}`, 2800);
        dumbwaiterLamps[T.floor].userData.until = performance.now() + 2600;
        setTimeout(() => {
          serveDish(m.table, m.item);
          if (meA.f === T.floor && Math.hypot(meA.rx - DUMBWAITER.x, meA.rz - DUMBWAITER.z) < 12) dingSound();
          if (T.floor === 1) speak(waiter, `Món ${dish.name} lên rồi ạ!`, 2500);
        }, 1500);
      }
      if (meA.f === 0 && Math.hypot(meA.rx - chef.rx, meA.rz - chef.rz) < 9) noiseHit(1.2, 3000, 0.08, 'highpass');
      if (m.by !== myId) speak(actorById(m.by), `gọi ${MENU[m.item].icon} ${MENU[m.item].name}`, 2500);
      break;
    }
    case 'dishes':
      TABLES[m.table].dishes.clear();
      break;
    case 'tab':
      tabs[m.table] = { items: m.items || [], pours: m.pours || 0, paidBy: m.paidBy ?? null, paidName: m.paidName ?? null };
      if (modal === 'bill' && meA?.seat?.table === m.table) showBill();
      break;
    case 'paid': {
      if (m.by === myId) {
        state.paid += m.total;
        toast(`💸 Bạn đã thanh toán ${fmt(m.total)} cho cả bàn. Hào phóng quá!`);
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
      cam.yaw = Math.PI / 2;
      cam.pitch = 0.3;
      toast(`🎤 Đến lượt bạn: ${mic.track?.title || 'hát đi nào'}!`);
    } else if (singer) {
      speak(singer, `🎤 ${mic.track?.title || 'lên hát đây!'}`, 3000);
    }
  } else {
    playingKey = '';
    stopSong();
    stopVideo();
  }
  stageLight.intensity = mic.singer ? 8 : 0;
  applyVolumes(); // có người hát thì tắt nhạc nền
  if (!mic.singer) for (const a of allActors()) a.dancing = false;
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
    change.onclick = () => { send({ t: 'mic-leave' }); openSongPicker(true); };
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

const OVERLAYS = { donate: 'overlay-donate', start: 'overlay-start', menu: 'overlay-menu', songs: 'overlay-songs', settings: 'overlay-settings', elevator: 'overlay-elevator', poem: 'overlay-poem', bill: 'overlay-bill', end: 'overlay-end' };
function openModal(name) {
  modal = name;
  for (const [k, id] of Object.entries(OVERLAYS)) $(id).classList.toggle('hidden', k !== name);
}
function closeModal() {
  modal = null;
  for (const id of Object.values(OVERLAYS)) $(id).classList.add('hidden');
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
  if (lvl > state.drunkLevel && DRUNK_LEVELS[lvl].msg) toast(DRUNK_LEVELS[lvl].msg);
  state.drunkLevel = lvl;
}

function setFill(f) {
  state.fill = f;
  meA.person.liquid.scale.y = Math.max(0.001, f);
  meA.person.liquid.visible = f > 0.02;
}

let menuCat = null; // nhóm món đang lọc, null = tất cả
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
    const b = document.createElement('button');
    b.className = 'menu-item';
    b.innerHTML = `<b>${m.icon} ${m.name}</b><small>${fmt(m.price)}</small>`;
    b.onclick = () => {
      send({ t: 'order', item: i });
      toast(`Đã gọi ${m.icon} ${m.name}`);
    };
    wrap.appendChild(b);
  });
}

// ================= Hành động của mình =================
// Nhảy theo nhạc karaoke: chỉ khi có người đang hát và mình đứng ở tầng có sân khấu.
const canDance = () => !!mic.singer && mic.singer !== myId && !!meA && !meA.seat && meA.f === STAGE.floor && state.started;
function toggleDance(on = !meA?.dancing) {
  if (!meA || modal || state.passedOut) return;
  if (on && !canDance()) return toast(mic.singer ? 'Lên sân thượng đứng gần sân khấu rồi nhảy nhé!' : 'Chưa ai hát, nhảy gì đây 😆');
  if (!!meA.dancing === on) return;
  meA.dancing = on;
  sendAct(on ? 'dance' : 'dance-stop');
  if (on) speak(meA, '💃 quẩy lên!', 1800);
}

function onSitMine() {
  if (meA.dancing) toggleDance(false);
  moveTarget = pending = null;
  state.fill = 0;
  setFill(0);
  cam.yaw = meA.yaw + Math.PI;
  cam.pitch = 0.5;
  cam.dist = Math.min(cam.dist, 3);
  const T = TABLES[meA.seat.table];
  if (T === chuBaTable) setTimeout(() => speak(chuBa, 'Ngồi đây con, uống với chú ly rượu.'), 400);
  toast(`Đã ngồi ${tableName(T)} · 2 rót · 1 dzô · 5 gọi mồi`);
  $('chat-log').innerHTML = '';
  addChatLine(null, `Đã ngồi ${tableName(T)}. Chỉ người cùng bàn thấy tin nhắn của bạn.`);
  renderLockButton();
}

function addChatLine(name, text) {
  const log = $('chat-log');
  const line = document.createElement('div');
  if (name) {
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
  if (text && meA?.seat) send({ t: 'chat', text: text.slice(0, CHAT_MAX) });
  input.value = '';
  input.blur(); // trả phím về cho game
});
$('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.target.value = '';
    e.target.blur();
  }
});
function onStandMine(T) {
  const dx = meA.x - T.x, dz = meA.z - T.z, d = Math.hypot(dx, dz) || 1;
  placeAt(meA, T.x + (dx / d) * 1.75, T.z + (dz / d) * 1.75);
  busy = null;
  renderLockButton();
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
$('btn-lock').onclick = () => {
  const st = roomState.get(meA?.seat?.table);
  if (st) send({ t: 'room-lock', locked: !st.locked });
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
let lastWhere = '', heardFloor = -1; // heardFloor: tầng lúc cập nhật âm lượng karaoke gần nhất
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
  if (meA.seat) { send({ t: 'stand' }); return; }
  if (focus) focus.action();
}

function sendAct(k, extra) {
  send({ t: 'act', k, ...extra });
}

function pour() {
  if (modal || state.passedOut) return;
  if (!meA.seat) return toast('Ngồi vào bàn đã rồi rót nhé (click vào bàn)');
  if (busy) return;
  if (state.fill > 0.5) return toast('Ly còn đầy kìa, dzô đi! (1)');
  pourSound(); // lượt rót được server ghi vào hoá đơn bàn
  playAct(meA, 'pour');
  sendAct('pour');
  busy = { t: 0, dur: 0.9, tick: (k) => setFill(k * 0.95) };
}

function cheers() {
  if (modal || state.passedOut) return;
  if (!meA.seat) return toast('Phải ngồi vào bàn mới dzô được!');
  if (busy) return;
  if (state.fill < 0.5) return toast('Ly rỗng mà đòi dzô à? Rót đi đã! (2)');
  const T = TABLES[meA.seat.table];
  playAct(meA, 'cheers');
  sendAct('cheers');
  onAnyAct(meA, 'cheers');
  if (T === chuBaTable) {
    playAct(chuBa, 'cheers');
    setTimeout(() => speak(chuBa, pick(LINES.chuBaCheers)), 200);
  }
  setTimeout(() => clinkSound(), 400);
  const from = state.fill;
  busy = {
    t: 0, dur: 2.1,
    tick: (k) => setFill(from * (1 - clamp((k - 0.45) / 0.45, 0, 1))),
    done: () => {
      state.cheers++;
      // Có mồi trên bàn thì ngấm chậm hơn.
      state.drunk += drinkOf(T.id).strength - Math.min(T.dishes.children.length, 5);
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

function offerDrink(a) {
  if (state.passedOut) return;
  playAct(meA, 'offer');
  speak(meA, `🍻 mời ${a.name} một ly`, 2500);
  sendAct('offer', { to: a.id });
}

function openMenu() {
  if (state.passedOut) return;
  const T = meA.seat ? TABLES[meA.seat.table] : null;
  $('menu-target').textContent = T ? `Món sẽ mang ra ${tableName(T)}` : 'Ngồi vào bàn để gọi mồi nhé. Bao cả quán thì đứng đâu cũng được!';
  $('menu-items').querySelectorAll('button').forEach((b) => (b.disabled = !T));
  openModal('menu');
}

// Mỗi lần có người dzô: âm thanh + đếm cho giờ vàng.
function onAnyAct(a, k) {
  if (k === 'cheers') {
    if (golden.active) golden.count++;
    if (a !== meA && meA.seat && a.seat?.table === meA.seat.table) setTimeout(() => clinkSound(0.7), 400);
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
  T.dishes.add(plate);
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
    ${T && total ? `<div class="row"><span>Nếu chia ${people} người</span><span>${fmt(Math.ceil(total / people / 1000) * 1000)}/người</span></div>` : ''}
    ${extras ? `<div class="row"><span>Bạn đã trả riêng (lạc, bao quán)</span><span>${fmt(extras)}</span></div>` : ''}
    <div class="bill-status ${tab?.paidBy ? 'paid' : ''}">${status}</div>
    <div class="note">🩺 Đã uống rượu bia thì không lái xe. Nhậu online thì an toàn tuyệt đối 😉</div>`;

  const pay = $('btn-pay');
  pay.disabled = !canPay;
  pay.textContent = tab?.paidBy ? '✅ Đã thanh toán' : !tab || !tab.items.length ? '💸 Gọi món trước đã' : `💸 Thanh toán ${fmt(total)}`;
  // Đã gục thì không quay lại bàn được, chỉ còn tăng 2 hoặc về nhà.
  $('btn-bill-back').classList.toggle('hidden', state.passedOut);
  if (modal !== 'bill') openModal('bill');
}

// Lưu thống kê khi kết thúc cuộc (tăng 2 / về nhà), không phải mỗi lần xem hoá đơn.
function saveSession() {
  if (!state.started || state.saved) return;
  state.saved = true;
  const spent = state.paid + state.extras.reduce((s, m) => s + m.price, 0) + state.rounds * ROUND_PRICE;
  const s = loadStats();
  saveStats({ sessions: s.sessions + 1, cheers: s.cheers + state.cheers, spent: s.spent + spent });
}

function resetSession() {
  saveSession();
  state.saved = false;
  Object.assign(state, {
    drunk: 0, drunkLevel: 0, cheers: 0, waters: 0, paid: 0, extras: [], rounds: 0,
    startedAt: Date.now(), passedOut: false,
  });
  setFill(0);
  updateDrunk();
  $('fade').style.opacity = 0;
}

// Popup chào về nhà chưa rời quán thật: ✕ là ở lại quán, "Quay lại quán" mới kết thúc cuộc và vào lại từ đầu.
function leaveForHome() {
  openModal('end');
}
function closeEnd() {
  // Đã gục thì không ngồi tiếp được, quay về hoá đơn để chọn tăng 2 hoặc về nhà.
  if (state.passedOut) showBill();
  else closeModal();
}

// ================= Giờ vàng =================
const golden = { active: false, count: 0, startedFor: -1 };
function updateGolden() {
  const now = serverNow();
  const phase = now % GOLDEN_EVERY;
  const slot = Math.floor(now / GOLDEN_EVERY);
  const el = $('golden');
  if (phase < GOLDEN_MS && state.started) {
    if (golden.startedFor !== slot) {
      golden.startedFor = slot;
      golden.count = 0;
      golden.active = true;
    }
    const sec = Math.floor(phase / 1000);
    el.classList.remove('hidden');
    el.innerHTML = sec < 3
      ? `<div class="sub-text">⭐ GIỜ VÀNG · cả quán cùng dzô ⭐</div><div class="big-text">${3 - sec}</div>`
      : `<div class="big-text">DZÔ!!!</div><div class="sub-text">${golden.count} lượt dzô cùng lúc${meA.seat ? ' · bấm 1 để dzô' : ' · ngồi vào bàn để dzô'}</div>`;
    $('golden-timer').textContent = '';
  } else {
    golden.active = false;
    el.classList.add('hidden');
    const left = Math.ceil((GOLDEN_EVERY - phase) / 1000);
    $('golden-timer').textContent = `⭐ Giờ vàng sau ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
}

// ================= Điều khiển =================
const keys = {};
const ACTIONS = {
  cheers, pour, water: drinkWater, interact,
  wave: () => emote('wave'),
  clap: () => emote('clap'),
  menu: () => openMenu(),
  stand: () => meA?.seat && !modal && send({ t: 'stand' }),
  dance: () => toggleDance(),
};

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'Enter' && !modal && meA?.seat) {
    e.preventDefault();
    $('chat-input').focus();
    return;
  }
  keys[e.code] = true;
  if (modal) {
    if (e.code === 'Escape' && modal === 'settings') closeSettings();
    else if (e.code === 'Escape' && modal === 'end') closeEnd();
    else if (e.code === 'Escape' && modal === 'donate') closeDonate();
    else if (e.code === 'Escape' && (modal === 'elevator' || modal === 'poem')) closeModal();
    else if (e.code === 'Escape' && (modal === 'menu' || modal === 'songs' || (modal === 'bill' && !state.passedOut))) closeModal();
    return;
  }
  const map = {
    Digit1: 'cheers', Space: 'cheers', Digit2: 'pour', KeyR: 'pour', Digit3: 'wave', Digit4: 'clap',
    Digit5: 'menu', KeyM: 'menu', Digit6: 'water', KeyN: 'water', KeyE: 'interact', Digit7: 'dance',
  };
  if (map[e.code]) {
    e.preventDefault();
    ACTIONS[map[e.code]]();
  }
  if (e.code === 'KeyB') showBill();
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

function pickAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const f = meA?.f ?? 0;
  const here = clickables.filter((o) => floorOf(o.userData.click) === f);
  for (const hit of raycaster.intersectObjects(here, false)) {
    if (hit.object === meA?.hit) continue;
    return { info: hit.object.userData.click };
  }
  groundPlane.constant = -f * FLOOR_H;
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, p)) return { point: p };
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
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
    if (pinchDist) cam.dist = clamp(cam.dist * (pinchDist / d), 1.6, 9);
    pinchDist = d;
  } else if (p.moved) {
    canvas.classList.add('dragging');
    cam.yaw -= dx * 0.006;
    cam.pitch = clamp(cam.pitch + dy * 0.004, 0.05, 1.35);
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  if (p.moved || pointers.size > 0 || modal || !state.started || state.passedOut || mic.singer === myId || riding || wcBusy) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (!hit) return;
  if (meA.seat) {
    if (hit.info?.tableId === meA.seat.table) return;
    if (hit.info?.kind === 'player') {
      // Mời ly người khác thì không cần đứng dậy nếu đủ gần.
      const pos = hit.info.pos();
      if (Math.hypot(pos.x - meA.x, pos.z - meA.z) <= hit.info.range) { hit.info.action(); return; }
    }
    send({ t: 'stand' });
  }
  if (hit.info) {
    pending = hit.info;
    const pos = hit.info.pos();
    moveTarget = { x: pos.x, z: pos.z };
  } else {
    pending = null;
    const B = FLOOR_BOUNDS[meA.f];
    moveTarget = { x: clamp(hit.point.x, B.minX, B.maxX), z: clamp(hit.point.z, B.minZ, B.maxZ) };
    marker.position.set(moveTarget.x, meA.f * FLOOR_H + 0.04, moveTarget.z);
    marker.visible = true;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.6, 9);
}, { passive: false });

document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
  ACTIONS[b.dataset.act]();
  b.blur(); // để phím Space không bấm lại nút
}));

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
    if (!o.isPointLight || o === stageLight || o === stoveLight) return;
    o.userData.base ??= o.intensity;
    o.intensity = o.userData.base * lerp(1, 0.4, k);
  });
}

let lastDayK = -1;
function updateDayNight() {
  const h = vnHours(), k = dayFactor(h);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  $('clock').textContent = `${k >= 0.5 ? '☀️' : '🌙'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${
    k === 1 ? 'Ban ngày' : k === 0 ? 'Ban đêm' : h < 12 ? 'Bình minh' : 'Hoàng hôn'}`;
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
    <li>Lên <b>sân khấu karaoke</b> trên sân thượng để hát. Mỗi 10 phút có <b>giờ vàng</b>, cả quán cùng dzô</li>`;
  $('chat-input').placeholder = 'Nhắn cho cả bàn…';
}
$('prompt').addEventListener('click', () => interact());
$('player-name').addEventListener('input', () => ($('preview-name').textContent = $('player-name').value.trim() || 'Khách'));

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
  state.name = $('player-name').value.trim().slice(0, 20) || 'Khách';
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
  placeAt(meA, Math.random() * 2 - 1, 2.6, Math.PI, 0);
  setFill(0);
  updateDrunk();

  state.started = true;
  state.startedAt = Date.now();
  net.full = false;
  $('hud').classList.remove('hidden');
  if (!audio) startAmbience();
  startBgm();
  ac().resume();
  closeModal();
  connect();
  updatePeople();
  setTimeout(() => toast('Click vào một bàn để ngồi. Không có nát, chỉ có dzô 🍻'), 800);
};
$('btn-menu-close').onclick = closeModal;
$('btn-menu-bill').onclick = showBill;
$('btn-round').onclick = () => { send({ t: 'round' }); closeModal(); };
$('btn-bill').onclick = () => !modal && showBill();
$('btn-leave').onclick = leaveForHome;
$('btn-again').onclick = () => { resetSession(); closeModal(); toast('Tăng 2! 🍻'); };
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
    saveSettings();
    renderSettings();
    applyVolumes();
    syncVideo();
  });
}
let settingsReturn = null;
function openSettings() {
  settingsReturn = modal;
  $('controls-copy').innerHTML = $('controls-list').innerHTML;
  renderSettings();
  openModal('settings');
}
function closeSettings() {
  if (settingsReturn === 'start') openModal('start');
  else closeModal();
}
$('btn-settings').onclick = openSettings;
$('btn-start-settings').onclick = openSettings;
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
$('btn-start-donate').onclick = openDonate;
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
    $('player-name').value = localStorage.getItem('nhau3d-name') || '';
    $('preview-name').textContent = $('player-name').value || 'Khách';
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
    busy.t += dt;
    const k = Math.min(1, busy.t / busy.dur);
    busy.tick?.(k);
    if (k >= 1) {
      const done = busy.done;
      busy = null;
      done?.();
    }
  }
  if (meA.seat || modal || state.passedOut || mic.singer === myId || riding || wcBusy) return;

  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  let vx = -sy * f + cy * s, vz = -cy * f - sy * s;
  if ((f || s || moveTarget) && meA.dancing) toggleDance(false);
  if (f || s) {
    moveTarget = pending = null;
    marker.visible = false;
  } else if (moveTarget) {
    const dx = moveTarget.x - meA.x, dz = moveTarget.z - meA.z, d = Math.hypot(dx, dz);
    if (d < 0.12) {
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
  p.body.position.y = (p.seated ? SEAT_DROP : 0) + (a.singing ? Math.abs(Math.sin(t * 6)) * 0.04 : 0)
    + (a.dancing && !p.seated ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);

  a.animT += dt;
  if (a.anim === 'cheers' && a.animT > 0.8) { a.anim = 'drink'; a.animT = 0; }
  const dur = { drink: 1.3, wave: 1.6, clap: 1.8, pour: 0.9, water: 1.2, offer: 1.4 }[a.anim];
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
  }
  if (a.singing) { rx = -2.5; rz = -0.45; }
  if (a.dancing && !p.seated) {
    // tay vung lên xuống so le theo nhịp
    rx = -2.4 + Math.sin(t * 6) * 0.6;
    lx = -2.4 + Math.sin(t * 6 + Math.PI) * 0.6;
    rz = -0.3 - Math.sin(t * 3) * 0.2;
    lz = 0.3 + Math.sin(t * 3) * 0.2;
  }
  if (a.fixedArms) rx = lx = a.fixedArms + (a.stir ? Math.sin(t * 5) * 0.25 : 0);
  const k = Math.min(1, dt * 10);
  const [L, R] = p.arms;
  R.rotation.x += (rx - R.rotation.x) * k;
  R.rotation.z += (rz - R.rotation.z) * k;
  L.rotation.x += (lx - L.rotation.x) * k;
  L.rotation.z += (lz - L.rotation.z) * k;
  p.cup.rotation.x = -R.rotation.x + (a.anim === 'drink' ? -0.9 : 0);
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
  p.head.rotation.x = talking && a.kind === 'npc' ? Math.sin(t * 14) * 0.08 : 0;
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

function updateFocus() {
  focus = null;
  const el = $('prompt');
  const chatOn = !!meA?.seat && state.started;
  const danceBtn = $('btn-dance');
  danceBtn.classList.toggle('hidden', !canDance() && !meA?.dancing);
  danceBtn.classList.toggle('on', !!meA?.dancing);
  danceBtn.querySelector('span').textContent = meA?.dancing ? 'Thôi nhảy' : 'Nhảy';
  $('btn-stand').classList.toggle('hidden', !chatOn);
  $('chat').classList.toggle('hidden', !chatOn);
  if (!chatOn && document.activeElement === $('chat-input')) $('chat-input').blur();
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
  camera.rotateZ(Math.sin(t * 0.9) * 0.08 * k);
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
    if (meA.f !== heardFloor) {
      heardFloor = meA.f;
      applyVolumes();
      syncVideo();
    }
    meA._sp = Math.hypot(meA.x - px, meA.z - pz) / Math.max(dt, 1e-4);
  }
  updateWorld(dt, t);
  for (const a of [...allActors(), ...npcs]) updateActor(a, dt, t);
  if (state.started) {
    updateChatter(dt);
    updateGolden();
    sendMove();
  }
  updateVisibility();
  updateFocus();
  updateCamera(dt, t);
  updateTags();
  renderer.render(scene, camera);
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
window.__nhau = { state, rideElevator, cam, audioInfo: () => ({ bgmStep: BGM.step, music: buses.music?.gain.value, ctx: audio?.state }), get me() { return meA; }, get localPlaying() { return !!local.src && { t: +(audio.currentTime - local.at).toFixed(1), dur: +local.buf.duration.toFixed(1), gain: +local.gain.gain.value.toFixed(2) }; }, remotes, TABLES, send, pour, cheers, emote, get mic() { return mic; } };
