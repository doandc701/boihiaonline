// Server Bơi Hia Dứt Cạn: phục vụ file tĩnh + WebSocket realtime cho từng quán.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  ROOMS, CAPACITY, TABLES, MENU, ACTS, SHIRTS, HAIRS, FLOOR_BOUNDS, STAGE,
  SONG_MS, MAX_SONG_MS, MIC_DELAY_MS, ROUND_COOLDOWN_MS, MAX_DISHES, CHAT_MAX, seatPos, nearestFreeSeat, tabTotal,
  START_MONEY, ROUND_PRICE, VENDOR_PRICE, FISH, BEACH, ITEMS, BAG_MAX, BEACH_AREA, FISH_ZONE_Z, pickWeighted, drinkOfTable, nearTrader,
} from '../shared/world.js';
import { SONGS, parseYouTube, YT_ID } from '../shared/songs.js';
import { voiceEnabled, voiceUrl, voiceCsp, voiceRoom, voiceToken } from './voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
// Chế độ dev (npm run dev): sửa file là trình duyệt tự tải lại, sửa server thì node --watch tự khởi động lại.
const DEV = process.env.DEV === '1' || process.argv.includes('--dev');
const BOOT_ID = Date.now().toString(36);
// Chống lạm dụng: số kết nối tối đa mỗi IP, thời gian chờ gói hello, các origin được phép (rỗng = cùng host).
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 4;
const HELLO_TIMEOUT_MS = 10000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
// Behind a reverse proxy, set TRUST_PROXY=1 so X-Forwarded-For is used for per-IP limits.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com",
    `connect-src 'self' ws: wss:${voiceCsp}`,
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// ---------- File tĩnh ----------
function serveStatic(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end(); return; }
  let base = path.join(ROOT, 'public');
  if (p.startsWith('/shared/')) {
    base = path.join(ROOT, 'shared');
    p = p.slice('/shared'.length);
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(base, p));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

// ---------- Trạng thái quán ----------
// ROOMS=quan-1,quan-2: server chỉ mở các cơ sở này (mỗi cơ sở một server). Bỏ trống thì mở tất cả.
const ACTIVE_ROOMS = (process.env.ROOMS || '').split(',').map((s) => s.trim()).filter(Boolean);
const rooms = new Map(ROOMS.filter((r) => !ACTIVE_ROOMS.length || ACTIVE_ROOMS.includes(r.id)).map((r) => [r.id, {
  ...r,
  players: new Map(),
  seats: new Map(), // "bàn:ghế" -> id người chơi
  dishes: TABLES.map(() => []),
  tabs: TABLES.map(() => newTab()), // hoá đơn chung từng bàn
  // queue: [{ id, track }]; track: { title, by, yt } (yt = null thì phát beat tự chế)
  mic: { singer: null, startAt: 0, endsAt: 0, song: 0, track: null, queue: [] },
  micTimer: null,
  dirty: new Set(),
  privateRooms: new Map(), // id bàn phòng riêng -> { owner, locked }
  holds: new Map(), // bàn trống còn nợ, đang giữ chỗ: id bàn -> { until, timer }
  beach: new Map(), // đồ trôi dạt trên bãi: id -> { id, k, x, z }
  notes: [], // lời nhắn người chơi thả vào chai: { text, from }
  chatAll: [], // tin nhắn gần nhất của kênh cả quán, gửi cho người mới vào
}]));
const CHAT_ALL_KEEP = 30;
for (const room of rooms.values()) scheduleBeach(room);
let nextId = 1;

// ---------- Ví tiền (tiền ảo) ----------
// Mỗi trình duyệt có một mã pid riêng (lưu trong localStorage), ví gắn với pid nên vào lại vẫn còn tiền.
const wallets = new Map(); // pid -> { money, bag: [kind], debt, seen }
let walletsDirty = false; // (giữ lại cho các chỗ cũ; saveState tự so nội dung để biết có cần ghi không)

// ---------- Lưu trạng thái qua các lần khởi động lại / deploy ----------
// Lưu ví (tiền, giỏ, sổ nợ) và từng cơ sở: hoá đơn, mồi trên bàn, chat cả quán. Server mới bật lên nạp lại;
// bàn còn hoá đơn chưa trả được giữ chỗ cho khách nối lại ngồi tiếp (xem restoreState).
// Có UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN thì lưu lên Upstash Redis: giữ được qua deploy trên host
// không có ổ đĩa lâu dài (Render free xoá ổ đĩa mỗi lần deploy). Không có thì ghi file data/state.json.
const STORE = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? { url: process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), token: process.env.UPSTASH_REDIS_REST_TOKEN } : null;
const STATE_KEY = `boihia:state:${ACTIVE_ROOMS.join(',') || 'all'}`;
const STATE_FILE = process.env.STATE_FILE || process.env.WALLET_FILE || path.join(ROOT, 'data', 'state.json');
async function redis(cmd) {
  const r = await fetch(STORE.url, {
    method: 'POST', headers: { Authorization: `Bearer ${STORE.token}` }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Upstash ${r.status}`);
  return (await r.json()).result;
}
async function readState() {
  try {
    const raw = STORE ? await redis(['GET', STATE_KEY]) : fs.readFileSync(STATE_FILE, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    if (STORE) console.error('readState', e.message);
    return null;
  }
}
function snapshot() {
  const cutoff = Date.now() - 60 * 24 * 3600 * 1000; // bỏ ví không ai vào 60 ngày
  for (const [pid, w] of wallets) if (w.seen < cutoff) wallets.delete(pid);
  return {
    at: Date.now(),
    wallets: Object.fromEntries(wallets),
    rooms: Object.fromEntries([...rooms].map(([id, r]) => [id, { tabs: r.tabs, dishes: r.dishes, chatAll: r.chatAll }])),
  };
}
let lastSaved = '';
async function saveState() {
  const json = JSON.stringify(snapshot());
  if (json === lastSaved) return;
  try {
    if (STORE) await redis(['SET', STATE_KEY, json]);
    else {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE + '.tmp', json);
      fs.renameSync(STATE_FILE + '.tmp', STATE_FILE);
    }
    lastSaved = json;
  } catch (e) { console.error('saveState', e.message); }
}
setInterval(saveState, 30000).unref();
// Tắt server (deploy bản mới, Render chuyển máy...): báo khách để họ tự nối lại, lưu trạng thái rồi mới thoát.
let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const room of rooms.values()) broadcast(room, { t: 'restart' });
  await Promise.race([saveState(), new Promise((r) => setTimeout(r, 6000))]);
  process.exit(0);
});
function walletOf(pid) {
  if (!wallets.has(pid)) wallets.set(pid, { money: START_MONEY, bag: [], seen: Date.now() });
  const w = wallets.get(pid);
  w.seen = Date.now();
  walletsDirty = true;
  return w;
}
const walletMsg = (p) => ({ t: 'wallet', money: p.wallet.money, bag: p.wallet.bag, debt: p.wallet.debt || 0 });
const fmtMoney = (n) => n.toLocaleString('vi-VN') + 'đ';
// Tiền bàn đang nợ (hoá đơn chưa ai trả).
const owedBy = (room, p) => {
  if (!p.seat) return 0;
  const tab = room.tabs[p.seat.table];
  return tab.paidBy ? 0 : tabTotal(TABLES[p.seat.table], tab);
};
// Gọi thêm chỉ khi ví đủ trả cả hoá đơn bàn đang nợ cộng món mới, để bàn luôn có người trả được.
function canAfford(room, p, extra) {
  if (p.wallet.debt > 0) {
    send(p.ws, { t: 'broke', msg: `📒 Bạn còn nợ quán ${fmtMoney(p.wallet.debt)} từ lần trước. Ra quầy thu ngân trả nợ rồi gọi tiếp nhé!` });
    return false;
  }
  const need = owedBy(room, p) + extra;
  if (p.wallet.money >= need) return true;
  send(p.ws, { t: 'broke', msg: `💸 Ví còn ${fmtMoney(p.wallet.money)}, chưa đủ ${fmtMoney(need)} (gồm cả hoá đơn bàn). Ra biển câu cá, nhặt ốc kiếm thêm nhé!` });
  return false;
}
function spend(p, amount) {
  p.wallet.money -= amount;
  walletsDirty = true;
  send(p.ws, walletMsg(p));
}

// ---------- Đồ trôi dạt trên bãi biển ----------
const BEACH_MAX = 10;
let nextBeachId = 1;
const beachMsg = (room) => ({ t: 'beach', items: [...room.beach.values()] });
function spawnBeach(room) {
  if (!room.players.size || room.beach.size >= BEACH_MAX) return;
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n && room.beach.size < BEACH_MAX; i++) {
    const it = pickWeighted(BEACH), id = nextBeachId++;
    const x = BEACH_AREA.minX + Math.random() * (BEACH_AREA.maxX - BEACH_AREA.minX);
    const z = BEACH_AREA.minZ + Math.random() * (BEACH_AREA.maxZ - BEACH_AREA.minZ);
    room.beach.set(id, { id, k: it.k, x: +x.toFixed(2), z: +z.toFixed(2) });
  }
  broadcast(room, beachMsg(room));
}
function scheduleBeach(room) {
  setTimeout(() => { spawnBeach(room); scheduleBeach(room); }, 60000 + Math.random() * 90000).unref();
}

// Lời nhắn trong chai: thơ nhậu, câu thả thính, và lời người chơi thả lại biển.
const BOTTLE_NOTES = [
  'Rượu ngon không có bạn hiền, không mua không phải không tiền không mua.',
  'Uống đi em, rượu chẳng say đâu, say là vì nụ cười em đó.',
  'Anh không say rượu, anh say em.',
  'Đời người được mấy lần say, say tình thì khổ, say này thì vui.',
  'Ai đọc được lời này: tối nay nhớ về nhà an toàn nhé!',
  'Nắng có mũ, mưa có ô, còn em có anh lo.',
  'Một ly cho người ở lại, một ly cho người đã xa.',
  'Bia lạnh, mồi ngon, anh em đủ: thế là đời đẹp.',
  'Cậu có biết biển rộng bao nhiêu không? Không bằng nỗi nhớ tớ dành cho cậu.',
  'Hôm nay dzô hết mình, mai đi làm hết sức.',
];
// owed: pid -> số tiền người đó gọi (món + ly bia của mình), dùng khi phải tự thu; members: pid từng ngồi bàn này.
// pid là chìa khoá ví nên không bao giờ gửi cho người khác (tabMsg chỉ gửi phần hiển thị).
function newTab() { return { items: [], pours: 0, paidBy: null, paidName: null, owed: {}, members: [] }; }
const tabMsg = (room, table) => {
  const { items, pours, paidBy, paidName } = room.tabs[table];
  return { t: 'tab', table, items, pours, paidBy, paidName, total: tabTotal(TABLES[table], room.tabs[table]) };
};
// Ghi phần của người gọi vào hoá đơn bàn.
function charge(room, p, table, amount) {
  const tab = openTab(room, table);
  tab.owed[p.pid] = (tab.owed[p.pid] || 0) + amount;
}
// Gọi thêm / rót thêm sau khi bàn đã trả tiền thì mở hoá đơn mới.
function openTab(room, table) {
  if (room.tabs[table].paidBy) room.tabs[table] = newTab();
  return room.tabs[table];
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Cooldown theo từng loại hành động, tránh một người spam broadcast tới cả quán.
function cooldown(p, key, ms) {
  const now = Date.now();
  if (now - (p.cd[key] || 0) < ms) return false;
  p.cd[key] = now;
  return true;
}
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
function broadcast(room, msg) {
  const s = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(s);
}
// Gửi cho những người đang ngồi ở một bàn (hoá đơn chỉ người cùng bàn cần).
function toTable(room, table, msg) {
  const s = JSON.stringify(msg);
  for (const o of room.players.values()) if (o.seat?.table === table && o.ws.readyState === 1) o.ws.send(s);
}
const pub = (p) => ({ id: p.id, name: p.name, look: p.look, x: p.x, z: p.z, f: p.f, yaw: p.yaw, d: p.d, seat: p.seat });
const roomMsg = (room, table) => ({ t: 'room', table, ...(room.privateRooms.get(table) || { owner: null, locked: false }) });
const micState = (room) => ({ t: 'mic', ...room.mic, queue: room.mic.queue.map((q) => ({ id: q.id, title: q.track.title })) });

function cleanName(v) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}
// So tên không phân biệt hoa thường, để "tuấn hói" và "Tuấn Hói" tính là trùng.
const nameKey = (n) => n.normalize('NFC').toLocaleLowerCase('vi');
function cleanLook(v) {
  const l = v && typeof v === 'object' ? v : {};
  const int = (x, max) => (Number.isInteger(x) && x >= 0 && x < max ? x : 0);
  return { s: int(l.s, SHIRTS.length), h: int(l.h, HAIRS.length), b: l.b ? 1 : 0 };
}

function join(room, ws, m) {
  if (room.players.size >= CAPACITY) {
    send(ws, { t: 'full' });
    ws.close();
    return null;
  }
  const name = cleanName(m.name), key = typeof m.key === 'string' ? m.key.slice(0, 64) : '';
  const reject = (msg) => { send(ws, { t: 'name-bad', msg }); ws.close(); return null; };
  if (!name) return reject('Nhập tên của bạn trước rồi mới vào quán nhé!');
  const same = [...room.players.values()].find((o) => nameKey(o.name) === nameKey(name));
  if (same) {
    // Cùng một tab kết nối lại (mạng chập chờn) thì thay kết nối cũ, người khác thì phải đổi tên.
    if (!key || same.key !== key) return reject(`Tên "${name}" đã có người dùng ở ${room.name}, chọn tên khác nhé!`);
    leave(room, same);
    same.ws.terminate();
  }
  const pid = typeof m.pid === 'string' && /^[\w-]{8,64}$/.test(m.pid) ? m.pid : `anon-${nextId}-${Math.random().toString(36).slice(2)}`;
  const p = {
    id: String(nextId++), ws, key, name, look: cleanLook(m.look), pid, wallet: walletOf(pid), canWrite: 0,
    x: Math.random() * 2 - 1, z: 2.6, f: 0, yaw: Math.PI, d: 0, seat: null, lastRound: 0, chatTokens: 3, chatLast: Date.now(), allTokens: 2, allLast: Date.now(), cd: {},
  };
  room.players.set(p.id, p);
  if (!room.beach.size) spawnBeach(room); // bãi trống thì rải ít đồ cho người mới có cái nhặt
  send(ws, {
    t: 'welcome', id: p.id, now: Date.now(), room: room.id,
    players: [...room.players.values()].filter((o) => o !== p).map(pub),
    dishes: room.dishes, mic: micState(room), features: { ytSearch: !!YOUTUBE_API_KEY, voice: voiceEnabled }, voiceLive: voiceLive(room),
    rooms: [...room.privateRooms.keys()].map((table) => roomMsg(room, table)),
    tabs: room.tabs.map((_, table) => tabMsg(room, table)),
    chatAll: room.chatAll,
    wallet: { money: p.wallet.money, bag: p.wallet.bag, debt: p.wallet.debt || 0 },
    holds: [...room.holds].map(([table, h]) => ({ table, until: h.until })),
    beach: [...room.beach.values()],
  });
  for (const o of room.players.values()) if (o !== p) send(o.ws, { t: 'join', player: pub(p) });
  return p;
}

// Kênh thoại nào đang có người bật mic: { all: số người, tables: { id bàn: số người } }.
function voiceLive(room) {
  const tables = {};
  let all = 0;
  for (const o of room.players.values()) {
    if (!o.voiceMic) continue;
    if (o.voiceMic.scope === 'all') all++;
    else tables[o.voiceMic.table] = (tables[o.voiceMic.table] || 0) + 1;
  }
  return { all, tables };
}
function setVoiceMic(room, p, mic) {
  const before = JSON.stringify(p.voiceMic || null);
  p.voiceMic = mic;
  if (JSON.stringify(mic || null) !== before) broadcast(room, { t: 'voice-live', ...voiceLive(room) });
}

function leave(room, p) {
  const hadVoiceMic = !!p.voiceMic;
  p.voiceMic = null;
  stand(room, p);
  room.players.delete(p.id);
  room.dirty.delete(p.id);
  removeFromMic(room, p.id);
  broadcast(room, { t: 'leave', id: p.id });
  if (hadVoiceMic) broadcast(room, { t: 'voice-live', ...voiceLive(room) });
}

function sit(room, p, m) {
  const T = TABLES[m.table];
  if (!T || p.seat || room.mic.singer === p.id) return;
  const priv = room.privateRooms.get(T.id);
  if (priv?.locked && priv.owner !== p.id) { send(p.ws, { t: 'sit-fail', table: T.id, locked: true }); return; }
  const hold = room.holds.get(T.id);
  if (hold && !room.tabs[T.id].members.includes(p.pid)) { send(p.ws, { t: 'sit-fail', table: T.id, held: true }); return; }
  const idx = nearestFreeSeat(T, (i) => room.seats.has(`${T.id}:${i}`), p.x, p.z);
  if (idx < 0) { send(p.ws, { t: 'sit-fail', table: T.id }); return; }
  if (hold) { // người trong nhóm quay lại: thôi giữ chỗ, nhậu tiếp hoá đơn cũ
    clearTimeout(hold.timer);
    room.holds.delete(T.id);
    broadcast(room, { t: 'hold', table: T.id, until: 0 });
  }
  if (!room.tabs[T.id].members.includes(p.pid)) room.tabs[T.id].members.push(p.pid);
  room.seats.set(`${T.id}:${idx}`, p.id);
  p.seat = { table: T.id, idx };
  p.cupFull = false; // mới ngồi xuống thì ly rỗng
  Object.assign(p, seatPos(T, idx), { f: T.floor });
  broadcast(room, { t: 'seat', id: p.id, table: T.id, idx });
  send(p.ws, tabMsg(room, T.id)); // các bàn khác không nhận cập nhật hoá đơn, nên gửi bản mới nhất khi ngồi
  // Người ngồi đầu tiên vào phòng riêng làm chủ phòng.
  if (T.private && !priv) {
    room.privateRooms.set(T.id, { owner: p.id, locked: false });
    broadcast(room, roomMsg(room, T.id));
  }
}

function setRoomLock(room, p, locked) {
  const table = p.seat?.table, priv = room.privateRooms.get(table);
  if (!priv || priv.owner !== p.id) return;
  priv.locked = !!locked;
  broadcast(room, roomMsg(room, table));
}

function stand(room, p) {
  if (!p.seat) return;
  const { table, idx } = p.seat;
  room.seats.delete(`${table}:${idx}`);
  p.seat = null;
  if (p.voiceMic?.scope === 'table') setVoiceMic(room, p, null); // rời bàn thì không còn nói ở kênh bàn
  broadcast(room, { t: 'stand', id: p.id });
  // Chủ phòng đứng dậy thì nhường cho người còn ngồi, hết người thì phòng trống và mở khoá.
  const priv = room.privateRooms.get(table);
  if (priv?.owner === p.id) {
    const next = [...room.seats].find(([k]) => k.startsWith(table + ':'));
    if (next) priv.owner = next[1];
    else room.privateRooms.delete(table);
    broadcast(room, roomMsg(room, table));
  }
  // Bàn trống: còn nợ thì giữ chỗ HOLD_MS (đi WC, lên hát rồi về), hết giờ chưa ai trả thì tự thu; không nợ thì dọn luôn.
  if (![...room.seats.keys()].some((k) => k.startsWith(table + ':'))) {
    const tab = room.tabs[table];
    if (!tab.paidBy && tabTotal(TABLES[table], tab) > 0) holdTable(room, table);
    else clearTable(room, table);
  }
}

// ---------- Giữ chỗ, tự thu tiền, sổ nợ ----------
const HOLD_MS = Number(process.env.HOLD_MS) || 3 * 60 * 1000;
function clearTable(room, table) {
  const hold = room.holds.get(table);
  if (hold) {
    clearTimeout(hold.timer);
    room.holds.delete(table);
    broadcast(room, { t: 'hold', table, until: 0 });
  }
  if (room.dishes[table].length) {
    room.dishes[table] = [];
    broadcast(room, { t: 'dishes', table, items: [] });
  }
  // Không còn ai ngồi để báo; người ngồi sau nhận hoá đơn mới khi ngồi.
  room.tabs[table] = newTab();
}
function holdTable(room, table) {
  const until = Date.now() + HOLD_MS;
  room.holds.set(table, { until, timer: setTimeout(() => settleTable(room, table), HOLD_MS) });
  broadcast(room, { t: 'hold', table, until });
}
// Hết giờ giữ chỗ mà chưa ai trả: ai gọi người nấy trả phần của mình, ví không đủ thì ghi sổ nợ.
function settleTable(room, table) {
  const tab = room.tabs[table];
  if (!tab.paidBy) {
    for (const [pid, amount] of Object.entries(tab.owed)) {
      const w = walletOf(pid), paid = Math.min(w.money, amount);
      w.money -= paid;
      w.debt = (w.debt || 0) + amount - paid;
      for (const o of room.players.values()) {
        if (o.pid !== pid) continue;
        send(o.ws, walletMsg(o));
        send(o.ws, { t: 'notice', msg: amount > paid
          ? `📒 Bàn bỏ về chưa trả: quán thu ${fmtMoney(paid)}, ghi sổ nợ ${fmtMoney(amount - paid)}`
          : `💸 Bàn bỏ về chưa trả: quán tự thu ${fmtMoney(paid)} phần bạn gọi` });
      }
    }
    walletsDirty = true;
  }
  clearTable(room, table);
}

// ---------- Mic karaoke: xếp hàng, mỗi lượt một bài ----------
function pumpMic(room) {
  const mic = room.mic;
  if (mic.singer || !mic.queue.length) return;
  const next = mic.queue.shift();
  mic.singer = next.id;
  mic.track = next.track;
  const singer = room.players.get(mic.singer);
  if (singer) {
    stand(room, singer);
    Object.assign(singer, { x: STAGE.singerX, z: STAGE.singerZ, f: STAGE.floor });
  }
  startTrack(room);
}

// Bắt đầu (hoặc bắt đầu lại khi đổi bài) bài của người đang cầm mic.
function startTrack(room) {
  const mic = room.mic;
  mic.startAt = Date.now() + MIC_DELAY_MS;
  // Với video, người hát báo xong bài (mic-leave); đây chỉ là giới hạn trên.
  mic.endsAt = mic.startAt + (mic.track.yt ? MAX_SONG_MS : SONG_MS);
  mic.song = Math.floor(Math.random() * 1000);
  armMicTimer(room);
}

// Hẹn giờ kết thúc lượt hát theo mic.endsAt (đặt lại khi biết độ dài thật của video).
function armMicTimer(room) {
  const mic = room.mic;
  clearTimeout(room.micTimer);
  room.micTimer = setTimeout(() => {
    mic.singer = null;
    mic.track = null;
    pumpMic(room);
    broadcast(room, micState(room));
  }, mic.endsAt - Date.now());
}

function removeFromMic(room, id) {
  const mic = room.mic;
  const before = mic.queue.length;
  mic.queue = mic.queue.filter((q) => q.id !== id);
  if (mic.singer === id) {
    clearTimeout(room.micTimer);
    mic.singer = null;
    mic.track = null;
    pumpMic(room);
  } else if (mic.queue.length === before) return;
  broadcast(room, micState(room));
}

function handle(room, p, m) {
  switch (m.t) {
    case 'clock': {
      // Đo giờ: máy khách gửi giờ của nó (c), server trả kèm giờ server (s) để máy khách tính độ lệch đồng hồ
      // (trừ nửa thời gian đi về). Dùng để mọi người nghe bài karaoke đúng cùng một chỗ.
      if (typeof m.c !== 'number' || !cooldown(p, 'clock', 150)) return;
      send(p.ws, { t: 'clock', c: m.c, s: Date.now() });
      break;
    }
    case 'move': {
      const d = num(m.d);
      if (d !== null) p.d = clamp(Math.round(d), 0, 100);
      if (!p.seat) {
        const x = num(m.x), z = num(m.z), yaw = num(m.yaw);
        if (x === null || z === null || yaw === null) return;
        if (Number.isInteger(m.f) && FLOOR_BOUNDS[m.f]) p.f = m.f;
        const b = FLOOR_BOUNDS[p.f];
        p.x = clamp(x, b.minX, b.maxX);
        p.z = clamp(z, b.minZ, b.maxZ);
        p.yaw = ((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      }
      room.dirty.add(p.id);
      break;
    }
    case 'sit': if (cooldown(p, 'seat', 500)) sit(room, p, m); break;
    case 'stand': if (cooldown(p, 'seat', 500)) stand(room, p); break;
    case 'act': {
      if (!ACTS.includes(m.k) || !cooldown(p, 'act', 400)) return;
      if (m.k === 'pour' && p.seat && !canAfford(room, p, drinkOfTable(TABLES[p.seat.table]).price)) return;
      const to = typeof m.to === 'string' && room.players.has(m.to) ? m.to : undefined;
      broadcast(room, { t: 'act', id: p.id, k: m.k, to });
      // Một người dzô là cả bàn cùng uống cạn.
      if (m.k === 'cheers' && p.seat) for (const o of room.players.values()) if (o.seat?.table === p.seat.table) o.cupFull = false;
      if (m.k === 'pour' && p.seat) {
        p.cupFull = true;
        openTab(room, p.seat.table).pours++;
        charge(room, p, p.seat.table, drinkOfTable(TABLES[p.seat.table]).price);
        toTable(room, p.seat.table, tabMsg(room, p.seat.table));
      }
      break;
    }
    case 'refill': {
      // Ly rỗng mà cả bàn dzô thì tự rót: tính vào hoá đơn như một lượt rót, không diễn động tác rót.
      if (!p.seat || !cooldown(p, 'refill', 1000)) return;
      if (!canAfford(room, p, drinkOfTable(TABLES[p.seat.table]).price)) return;
      p.cupFull = true;
      openTab(room, p.seat.table).pours++;
      charge(room, p, p.seat.table, drinkOfTable(TABLES[p.seat.table]).price);
      toTable(room, p.seat.table, tabMsg(room, p.seat.table));
      break;
    }
    case 'pour-round': {
      // Gọi em rót bia: em rót lần lượt cho mọi người cùng bàn đang có ly rỗng, mỗi ly tính một lượt rót.
      if (!p.seat || !cooldown(p, 'pour-round', 2000)) return;
      const table = p.seat.table;
      // Người đang nợ quán thì chưa được rót (cũng như chưa được gọi món).
      const ids = [...room.players.values()].filter((o) => o.seat?.table === table && !o.cupFull && !(o.wallet.debt > 0))
        .sort((a, b) => a.seat.idx - b.seat.idx).map((o) => o.id);
      if (!ids.length) { send(p.ws, { t: 'notice', msg: 'Ly ai cũng đầy rồi, dzô đi! 🍻' }); return; }
      if (!canAfford(room, p, drinkOfTable(TABLES[table]).price * ids.length)) return;
      const price = drinkOfTable(TABLES[table]).price;
      for (const id of ids) {
        const o = room.players.get(id);
        o.cupFull = true;
        charge(room, o, table, price); // ai uống ly nào ghi phần người đó
      }
      openTab(room, table).pours += ids.length;
      broadcast(room, { t: 'pour-round', table, by: p.id, ids });
      toTable(room, table, tabMsg(room, table));
      break;
    }
    case 'order': {
      if (!Number.isInteger(m.item) || !MENU[m.item] || !p.seat || !cooldown(p, 'order', 500)) return;
      if (!canAfford(room, p, MENU[m.item].price)) return;
      const list = room.dishes[p.seat.table];
      list.push(m.item);
      if (list.length > MAX_DISHES) list.shift();
      broadcast(room, { t: 'dish', table: p.seat.table, item: m.item, by: p.id });
      const tab = openTab(room, p.seat.table);
      if (tab.items.length < 200) tab.items.push(m.item);
      charge(room, p, p.seat.table, MENU[m.item].price);
      toTable(room, p.seat.table, tabMsg(room, p.seat.table));
      break;
    }
    case 'pay': {
      // Chỉ người đang ngồi bàn, bàn đã gọi món, và chưa ai trả mới thanh toán được.
      if (!p.seat || !cooldown(p, 'pay', 1000)) return;
      const table = p.seat.table, tab = room.tabs[table];
      if (tab.paidBy) { send(p.ws, { t: 'notice', msg: `Bàn này ${tab.paidName} đã thanh toán rồi 💸` }); return; }
      if (!tab.items.length) { send(p.ws, { t: 'notice', msg: 'Bàn chưa gọi món nào, gọi món trước rồi mới tính tiền nhé!' }); return; }
      const bill = tabTotal(TABLES[table], tab);
      if (p.wallet.money < bill) {
        send(p.ws, { t: 'broke', msg: `💸 Ví còn ${fmtMoney(p.wallet.money)}, không đủ trả ${fmtMoney(bill)}. Nhờ người khác trả, hoặc ra biển kiếm thêm nhé!` });
        return;
      }
      spend(p, bill);
      tab.paidBy = p.id;
      tab.paidName = p.name;
      toTable(room, table, { t: 'paid', table, by: p.id, name: p.name, total: tabTotal(TABLES[table], tab) });
      toTable(room, table, tabMsg(room, table));
      break;
    }
    case 'pay-debt': {
      if (!(p.wallet.debt > 0) || !cooldown(p, 'pay-debt', 1000)) return;
      if (p.f !== 0 || Math.hypot(p.x - 4.8, p.z + 1.7) > 3.5) { send(p.ws, { t: 'notice', msg: '📒 Ra quầy thu ngân tầng 1 trả nợ nhé!' }); return; }
      const paid = Math.min(p.wallet.money, p.wallet.debt);
      if (!paid) { send(p.ws, { t: 'broke', msg: `📒 Ví trống trơn, chưa trả nợ được. Ra biển kiếm thêm nhé!` }); return; }
      p.wallet.money -= paid;
      p.wallet.debt -= paid;
      walletsDirty = true;
      send(p.ws, walletMsg(p));
      send(p.ws, { t: 'debt-paid', paid, left: p.wallet.debt });
      break;
    }
    case 'round': {
      if (Date.now() - p.lastRound < ROUND_COOLDOWN_MS) {
        send(p.ws, { t: 'notice', msg: 'Vừa bao xong mà, đợi chút nữa nhé!' });
        return;
      }
      if (p.wallet.debt > 0) { send(p.ws, { t: 'broke', msg: `📒 Còn nợ quán ${fmtMoney(p.wallet.debt)}, trả nợ ở quầy thu ngân rồi hẵng bao nhé!` }); return; }
      if (p.wallet.money < ROUND_PRICE) {
        send(p.ws, { t: 'broke', msg: `💸 Bao cả quán cần ${fmtMoney(ROUND_PRICE)}, ví chỉ còn ${fmtMoney(p.wallet.money)}.` });
        return;
      }
      p.lastRound = Date.now();
      spend(p, ROUND_PRICE);
      broadcast(room, { t: 'round', id: p.id, name: p.name });
      break;
    }
    case 'mic-join':
      // Mỗi lần mic-join có thể gọi ra YouTube, giới hạn để server không bị dùng làm nguồn spam request.
      if (!cooldown(p, 'mic', 3000)) { send(p.ws, { t: 'notice', msg: 'Đợi chút rồi chọn bài lại nhé' }); return; }
      joinMic(room, p, m).catch((e) => console.error('joinMic', e));
      break;
    case 'buy-vendor': {
      if (!cooldown(p, 'vendor', 1500)) return;
      if (p.wallet.debt > 0) { send(p.ws, { t: 'broke', msg: `📒 Còn nợ quán ${fmtMoney(p.wallet.debt)}, trả nợ ở quầy thu ngân trước nhé!` }); return; }
      if (p.wallet.money < VENDOR_PRICE) { send(p.ws, { t: 'broke', msg: '💸 Hết tiền mua lạc rồi, ra biển kiếm thêm nhé!' }); return; }
      spend(p, VENDOR_PRICE);
      send(p.ws, { t: 'vendor-ok' });
      break;
    }
    case 'fish': {
      // Câu cá: đứng ở mép nước tầng trệt. power (0..1) là độ chuẩn khi giật cần trong mini-game.
      if (p.seat || p.f !== 0 || p.z < FISH_ZONE_Z - 0.5) { send(p.ws, { t: 'notice', msg: 'Ra sát mép nước rồi mới thả câu được!' }); return; }
      if (!cooldown(p, 'fish', 4000)) return;
      if (p.wallet.bag.length >= BAG_MAX) { send(p.ws, { t: 'notice', msg: '🎒 Giỏ đầy rồi, bán bớt đi đã!' }); return; }
      const power = Math.min(1, Math.max(0, num(m.power) ?? 0));
      if (power < 0.25) { send(p.ws, { t: 'catch', k: null }); break; }
      // Giật càng chuẩn càng dễ dính cá to; giật lệch nhiều thì hay vớt phải dép.
      const pool = FISH.map((f) => ({ ...f, w: f.junk ? f.w * (1.6 - power) : f.w * (f.price >= 100000 ? power * power * 1.6 : 1) }));
      const fish = pickWeighted(pool);
      p.wallet.bag.push(fish.k);
      walletsDirty = true;
      send(p.ws, { t: 'catch', k: fish.k });
      send(p.ws, walletMsg(p));
      if (fish.rare) broadcast(room, { t: 'notice', msg: `🎣 ${p.name} vừa câu được ${fish.icon} ${fish.name}!` });
      break;
    }
    case 'pickup': {
      const it = room.beach.get(m.id);
      if (!it || p.f !== 0 || Math.hypot(p.x - it.x, p.z - it.z) > 2.5 || !cooldown(p, 'pickup', 300)) return;
      if (p.wallet.bag.length >= BAG_MAX) { send(p.ws, { t: 'notice', msg: '🎒 Giỏ đầy rồi, bán bớt đi đã!' }); return; }
      room.beach.delete(it.id);
      p.wallet.bag.push(it.k);
      walletsDirty = true;
      send(p.ws, { t: 'picked', k: it.k });
      send(p.ws, walletMsg(p));
      broadcast(room, beachMsg(room));
      break;
    }
    case 'sell': {
      // m.k: bán một món loại đó; m.all: bán sạch giỏ
      if (!cooldown(p, 'sell', 250)) return;
      if (!nearTrader(p)) { send(p.ws, { t: 'notice', msg: '🧺 Mang đồ ra sạp Bà Tư (chân bậc xuống biển) mới bán được nhé!' }); return; }
      const bag = p.wallet.bag;
      let gain = 0;
      if (m.all) {
        for (const k of bag) gain += ITEMS[k]?.price || 0;
        p.wallet.bag = [];
      } else {
        const i = bag.indexOf(m.k);
        if (i < 0) return;
        bag.splice(i, 1);
        gain = ITEMS[m.k]?.price || 0;
      }
      // Đang nợ quán thì tiền bán được trừ nợ trước.
      const toDebt = Math.min(p.wallet.debt || 0, gain);
      if (toDebt) p.wallet.debt -= toDebt;
      p.wallet.money += gain - toDebt;
      walletsDirty = true;
      send(p.ws, walletMsg(p));
      send(p.ws, { t: 'sold', gain, toDebt });
      break;
    }
    case 'open-bottle': {
      const i = p.wallet.bag.indexOf('chai');
      if (i < 0 || !cooldown(p, 'bottle', 800)) return;
      p.wallet.bag.splice(i, 1);
      walletsDirty = true;
      const own = room.notes.filter((n) => n.pid !== p.pid);
      const note = own.length && Math.random() < 0.5
        ? own[Math.floor(Math.random() * own.length)]
        : { text: BOTTLE_NOTES[Math.floor(Math.random() * BOTTLE_NOTES.length)], from: '' };
      p.canWrite = Math.min(3, p.canWrite + 1); // mở chai rồi mới được thả lời nhắn của mình lại biển
      send(p.ws, walletMsg(p));
      send(p.ws, { t: 'bottle', text: note.text, from: note.from });
      break;
    }
    case 'write-note': {
      if (p.canWrite < 1 || typeof m.text !== 'string' || !cooldown(p, 'note', 3000)) return;
      const text = m.text.slice(0, 500).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!text) return;
      p.canWrite--;
      room.notes.push({ text, from: p.name, pid: p.pid });
      if (room.notes.length > 200) room.notes.shift();
      send(p.ws, { t: 'notice', msg: '🍾 Đã thả lời nhắn ra biển. Ai đó sẽ nhặt được!' });
      break;
    }
    case 'mic-duration': {
      // Người hát báo độ dài video đang phát: lượt hát kéo dài đúng hết bài (tối đa MAX_SONG_MS).
      const mic = room.mic, sec = num(m.sec);
      if (mic.singer !== p.id || !mic.track?.yt || m.yt !== mic.track.yt || sec === null || !cooldown(p, 'mic-duration', 1000)) return;
      mic.endsAt = mic.startAt + Math.min(Math.max(sec, 10) * 1000 + 5000, MAX_SONG_MS);
      armMicTimer(room);
      broadcast(room, micState(room));
      break;
    }
    case 'mic-leave':
      if (cooldown(p, 'mic-leave', 500)) removeFromMic(room, p.id);
      break;
    case 'invite': {
      // Mời ly: cả hai phải đang ngồi. Người được mời có 15 giây để trả lời.
      const o = room.players.get(m.to);
      if (!o || o === p || !p.seat || !o.seat || !cooldown(p, 'invite', 3000)) return;
      p.inviteTo = { id: o.id, at: Date.now() };
      send(o.ws, { t: 'invite', id: p.id });
      break;
    }
    case 'invite-reply': {
      const o = room.players.get(m.to);
      if (!o || o.inviteTo?.id !== p.id || Date.now() - o.inviteTo.at > 15000) return;
      o.inviteTo = null;
      send(o.ws, { t: 'invite-reply', id: p.id, ok: !!m.ok });
      break;
    }
    case 'voice-mic': {
      // Máy khách báo đang bật/tắt mic (không qua LiveKit nên không tốn phút). Server báo cả quán biết kênh nào đang
      // có người nói để máy khác chỉ vào kênh nghe lúc đó; không ai nói thì không ai ở trong kênh, không tốn phút.
      if (!voiceEnabled) return;
      const scope = m.scope === 'table' ? 'table' : 'all';
      setVoiceMic(room, p, !m.on || (scope === 'table' && !p.seat) ? null : { scope, table: scope === 'table' ? p.seat.table : null });
      break;
    }
    case 'voice-token': {
      // Vé vào kênh thoại: 'table' chỉ cấp khi đang ngồi bàn (kênh riêng của bàn), 'all' là cả cơ sở.
      if (!voiceEnabled || !cooldown(p, 'voice', 1500)) return;
      const scope = m.scope === 'table' ? 'table' : 'all';
      if (scope === 'table' && !p.seat) { send(p.ws, { t: 'notice', msg: 'Ngồi vào bàn rồi mới nói chuyện với cả bàn được nhé!' }); return; }
      const lkRoom = voiceRoom(room.id, scope, p.seat?.table);
      send(p.ws, { t: 'voice-token', scope, table: p.seat?.table ?? null, url: voiceUrl, token: voiceToken({ room: lkRoom, gameId: p.id, name: p.name }) });
      break;
    }
    case 'yt-search': {
      if (typeof m.q !== 'string') return;
      const q = m.q.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!q) return;
      if (!cooldown(p, 'yt-search', 2000)) { send(p.ws, { t: 'notice', msg: 'Tìm chậm thôi, đợi chút rồi tìm tiếp nhé' }); return; }
      ytSearch(q)
        .then((items) => send(p.ws, { t: 'yt-results', q: m.q, items }))
        .catch((e) => {
          console.error('ytSearch', e.message);
          send(p.ws, { t: 'yt-results', q: m.q, items: [], error: true });
        });
      break;
    }
    case 'room-lock':
      if (cooldown(p, 'lock', 500)) setRoomLock(room, p, m.locked);
      break;
    case 'chat': {
      // scope 'all': cả quán đều thấy, ai cũng chat được nhưng chậm hơn.
      // Còn lại: chỉ người đang ngồi mới chat, và chỉ người cùng bàn nhận được.
      if (typeof m.text !== 'string' || (m.scope !== 'all' && !p.seat)) return;
      const text = m.text.slice(0, 500).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
      if (!text) return;
      const now = Date.now();
      if (m.scope === 'all') {
        p.allTokens = Math.min(2, p.allTokens + (now - p.allLast) / 4000);
        p.allLast = now;
        if (p.allTokens < 1) {
          send(p.ws, { t: 'notice', msg: 'Chat cả quán chậm lại chút, để người khác nói với 😅' });
          return;
        }
        p.allTokens--;
        const line = { t: 'chat', scope: 'all', id: p.id, name: p.name, text, at: now };
        room.chatAll.push(line);
        if (room.chatAll.length > CHAT_ALL_KEEP) room.chatAll.shift();
        broadcast(room, line);
        break;
      }
      p.chatTokens = Math.min(3, p.chatTokens + (now - p.chatLast) / 1500);
      p.chatLast = now;
      if (p.chatTokens < 1) {
        send(p.ws, { t: 'notice', msg: 'Từ từ thôi, nói chậm lại chút 😅' });
        return;
      }
      p.chatTokens--;
      const table = p.seat.table;
      const msg = JSON.stringify({ t: 'chat', id: p.id, table, text });
      for (const o of room.players.values()) if (o.seat?.table === table && o.ws.readyState === 1) o.ws.send(msg);
      break;
    }
  }
}

// ---------- Chọn bài & tìm video ----------
const ytCache = new Map(); // id bài -> { yt, title } | null

// Kiểm tra video tồn tại và cho phép nhúng (oEmbed trả 401 nếu bị chặn nhúng), lấy tiêu đề.
async function checkVideo(yt) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + yt)}`,
      { signal: AbortSignal.timeout(4000) });
    if (r.status === 401 || r.status === 403) return { ok: false, msg: 'Video này không cho phát ngoài YouTube, chọn video khác nhé' };
    if (!r.ok) return { ok: false, msg: 'Không tìm thấy video này' };
    const j = await r.json();
    return { ok: true, title: String(j.title || '').slice(0, 80) };
  } catch {
    return { ok: true, title: '' }; // Không gọi được YouTube thì vẫn cho hát, client tự xử lý lỗi phát.
  }
}

async function searchKaraoke(song) {
  if (ytCache.has(song.id)) return ytCache.get(song.id);
  let found = null;
  if (YOUTUBE_API_KEY) {
    try {
      const q = `${song.title} ${song.by} karaoke`;
      const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true'
        + `&maxResults=1&regionCode=VN&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const id = r.ok ? (await r.json()).items?.[0]?.id?.videoId : null;
      if (id) found = { yt: id };
    } catch {}
    ytCache.set(song.id, found);
  }
  return found;
}

// ---------- Tìm bài trên YouTube ----------
// Có YOUTUBE_API_KEY thì dùng API chính thức; không có thì đọc trang kết quả tìm kiếm của YouTube.
// Chỉ trả video cho phép nhúng, vì video phải chiếu được trên màn hình sân khấu.
const searchCache = new Map(); // câu tìm -> { at, items }
const SEARCH_TTL = 30 * 60 * 1000;
const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
  Cookie: 'CONSENT=YES+cb; SOCS=CAI', // bỏ qua trang hỏi cookie ở châu Âu
};

// Tìm đúng câu người chơi gõ: ra cả bài gốc, MV, remix; muốn karaoke thì người chơi tự gõ thêm "karaoke".
async function ytSearch(q) {
  const key = q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.items;
  let items = YOUTUBE_API_KEY ? await apiSearch(q) : await pageSearch(q);
  if (!YOUTUBE_API_KEY) {
    const checks = await Promise.all(items.map((v) => checkVideo(v.id)));
    items = items.filter((_, i) => checks[i].ok);
  }
  items = items.slice(0, 10);
  if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(key, { at: Date.now(), items });
  return items;
}

async function apiSearch(query) {
  const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true'
    + `&maxResults=12&regionCode=VN&relevanceLanguage=vi&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`YouTube API ${r.status}`);
  return ((await r.json()).items || []).map((it) => ({
    id: it.id?.videoId, title: decodeEntities(it.snippet?.title || ''), channel: it.snippet?.channelTitle || '', duration: '',
  })).filter((v) => YT_ID.test(v.id || ''));
}

async function pageSearch(query) {
  // sp=EgIQAQ%3D%3D: chỉ lấy video (bỏ kênh, playlist)
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D&hl=vi&gl=VN`;
  const r = await fetch(url, { headers: YT_HEADERS, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  return parseResultsPage(await r.text()).slice(0, 14);
}

function parseResultsPage(html) {
  const m = html.match(/(?:var ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) return [];
  let data;
  try { data = JSON.parse(m[1]); } catch { return []; }
  const out = [], seen = new Set();
  const text = (t) => t?.simpleText ?? (t?.runs || []).map((x) => x.text).join('') ?? '';
  (function walk(o) {
    if (!o || typeof o !== 'object' || out.length >= 20) return;
    const v = o.videoRenderer;
    if (v && YT_ID.test(v.videoId || '') && !seen.has(v.videoId) && v.lengthText) { // không có lengthText là đang livestream
      seen.add(v.videoId);
      out.push({ id: v.videoId, title: text(v.title), channel: text(v.ownerText || v.longBylineText), duration: text(v.lengthText) });
    }
    for (const k in o) walk(o[k]);
  })(data);
  return out;
}

const decodeEntities = (s) => s.replace(/&(amp|quot|#39|lt|gt);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[e]);

async function joinMic(room, p, m) {
  const mic = room.mic;
  // change: người đang hát chọn bài khác; bài cũ vẫn phát tới khi bài mới sẵn sàng.
  const change = !!m.change && mic.singer === p.id;
  if ((mic.singer === p.id && !change) || mic.queue.some((q) => q.id === p.id) || p.micPending) return;
  p.micPending = true;
  let track = null;
  try {
    if (typeof m.url === 'string') {
      const yt = parseYouTube(m.url.slice(0, 200));
      if (!yt) { send(p.ws, { t: 'notice', msg: 'Link YouTube không hợp lệ' }); return; }
      const v = await checkVideo(yt);
      if (!v.ok) { send(p.ws, { t: 'notice', msg: v.msg }); return; }
      track = { title: v.title || 'Bài tự chọn', by: '', yt };
    } else {
      const song = SONGS.find((s) => s.id === m.song);
      if (!song) return;
      const found = song.yt ? { yt: song.yt } : await searchKaraoke(song);
      track = { title: song.title, by: song.by, yt: found?.yt || null };
    }
  } finally {
    p.micPending = false;
  }
  // Có thể người chơi đã rời quán trong lúc chờ tìm video.
  if (room.players.get(p.id) !== p) return;
  if (change) {
    if (mic.singer !== p.id) return; // vừa hết bài hoặc rời mic trong lúc chờ
    mic.track = track;
    startTrack(room);
    broadcast(room, micState(room));
    return;
  }
  if (mic.singer === p.id || mic.queue.some((q) => q.id === p.id)) return;
  mic.queue.push({ id: p.id, track });
  pumpMic(room);
  broadcast(room, micState(room));
}

// ---------- HTTP + WebSocket ----------
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/__reload')) {
    // Kênh tự tải lại cho chế độ dev. Không ở chế độ dev thì trả 204 để trình duyệt thôi kết nối.
    if (!DEV) { res.writeHead(204).end(); return; }
    if (reloadClients.size >= 50) { res.writeHead(503).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`event: boot\ndata: ${BOOT_ID}\n\n`);
    reloadClients.add(res);
    req.on('close', () => reloadClients.delete(res));
    return;
  }
  if (req.url.startsWith('/api/rooms')) {
    // Trang trên host tĩnh (Vercel) đọc sĩ số từ domain khác nên cần CORS; dữ liệu này công khai.
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify([...rooms.values()].map((r) => ({ id: r.id, name: r.name, count: r.players.size, capacity: CAPACITY }))));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  serveStatic(req, res);
});

const connPerIp = new Map(); // ip -> số kết nối đang mở

function clientIp(req) {
  if (TRUST_PROXY) {
    // Render đứng sau Cloudflare: CF-Connecting-IP / True-Client-IP do Cloudflare ghi đè nên tin được.
    // Không dùng phần tử đầu của X-Forwarded-For vì client tự gửi được; phần tử cuối do proxy gần nhất thêm vào.
    const cf = String(req.headers['cf-connecting-ip'] || req.headers['true-client-ip'] || '').trim();
    if (cf) return cf;
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || '';
}

// Chặn trang web khác mở WebSocket tới server bằng trình duyệt của người chơi.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // client không phải trình duyệt; vẫn bị giới hạn theo IP
  if (ALLOWED_ORIGINS.length) return ALLOWED_ORIGINS.includes(origin);
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 2048, perMessageDeflate: false,
  verifyClient: ({ req }, cb) => {
    if (!originAllowed(req)) return cb(false, 403, 'Forbidden');
    if ((connPerIp.get(clientIp(req)) || 0) >= MAX_CONN_PER_IP) return cb(false, 429, 'Too many connections');
    cb(true);
  },
});

wss.on('connection', (ws, req) => {
  // Thiếu listener 'error' thì một socket lỗi sẽ làm sập cả process.
  ws.on('error', () => ws.terminate());
  const ip = clientIp(req);
  connPerIp.set(ip, (connPerIp.get(ip) || 0) + 1);
  ws.on('close', () => {
    const n = (connPerIp.get(ip) || 1) - 1;
    if (n > 0) connPerIp.set(ip, n); else connPerIp.delete(ip);
  });
  const room = rooms.get(new URL(req.url, 'http://x').searchParams.get('room'));
  if (!room) {
    send(ws, { t: 'notice', msg: 'Không có cơ sở này' });
    ws.close();
    return;
  }
  let p = null;
  // Kết nối không gửi hello thì không được giữ chỗ mãi.
  const helloTimer = setTimeout(() => { if (!p) ws.terminate(); }, HELLO_TIMEOUT_MS);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  // Giới hạn ~20 tin nhắn/giây mỗi người; vượt quá nhiều thì ngắt kết nối.
  const bucket = { tokens: 20, last: Date.now(), dropped: 0 };
  ws.on('message', (raw, isBinary) => {
    const now = Date.now();
    bucket.tokens = Math.min(20, bucket.tokens + (now - bucket.last) / 50);
    bucket.last = now;
    if (bucket.tokens < 1) {
      if (++bucket.dropped > 100) ws.close(1008, 'rate limit');
      return;
    }
    bucket.tokens--;
    bucket.dropped = Math.max(0, bucket.dropped - 1);
    if (isBinary) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (!p) {
      if (m.t === 'hello') {
        p = join(room, ws, m);
        if (p) clearTimeout(helloTimer);
      }
      return;
    }
    handle(room, p, m);
  });
  ws.on('close', () => {
    clearTimeout(helloTimer);
    if (p && room.players.get(p.id) === p) leave(room, p);
  });
});

// Gom vị trí, gửi 10 lần/giây.
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.dirty.size) continue;
    const list = [];
    for (const id of room.dirty) {
      const p = room.players.get(id);
      if (p) list.push([p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), p.d, p.f]);
    }
    room.dirty.clear();
    broadcast(room, { t: 'moves', list });
  }
}, 100);

// Ngắt kết nối chết.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

// ---------- Tự tải lại khi sửa file (chỉ chế độ dev) ----------
const reloadClients = new Set();
if (DEV) {
  let timer = null;
  const notify = (file) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`🔄 ${file} đã thay đổi, tải lại ${reloadClients.size} trình duyệt`);
      for (const res of reloadClients) res.write('event: reload\ndata: 1\n\n');
    }, 120);
  };
  for (const dir of ['public', 'shared']) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, (_, file) => notify(`${dir}/${file}`));
  }
  setInterval(() => { for (const res of reloadClients) res.write(': ping\n\n'); }, 25000);
}

if (!rooms.size) throw new Error(`ROOMS=${process.env.ROOMS} không khớp cơ sở nào trong shared/world.js`);
// Nạp trạng thái lần chạy trước (ví, hoá đơn, mồi trên bàn, chat) trước khi mở cửa đón khách.
function restoreState(data) {
  // File ví kiểu cũ (data/wallets.json) chỉ có danh sách ví.
  const ws = data.wallets || (data.rooms ? {} : data);
  for (const [pid, w] of Object.entries(ws)) if (w && typeof w.money === 'number') wallets.set(pid, w);
  for (const [id, saved] of Object.entries(data.rooms || {})) {
    const room = rooms.get(id);
    if (!room || !Array.isArray(saved.tabs)) continue;
    room.chatAll = Array.isArray(saved.chatAll) ? saved.chatAll.slice(-CHAT_ALL_KEEP) : [];
    TABLES.forEach((T, table) => {
      const t = saved.tabs[table] || {}, tab = newTab();
      tab.items = (t.items || []).filter((i) => Number.isInteger(i) && MENU[i]);
      tab.pours = Number.isInteger(t.pours) ? t.pours : 0;
      tab.paidBy = t.paidBy || null;
      tab.paidName = t.paidName || null;
      tab.owed = t.owed && typeof t.owed === 'object' ? t.owed : {};
      tab.members = Array.isArray(t.members) ? t.members : [];
      room.tabs[table] = tab;
      room.dishes[table] = (saved.dishes?.[table] || []).filter((i) => Number.isInteger(i) && MENU[i]);
      // Lúc này chưa ai ngồi: bàn còn nợ thì giữ chỗ cho khách nối lại, không thì dọn.
      if (!tab.paidBy && tabTotal(T, tab) > 0) holdTable(room, table);
      else clearTable(room, table);
    });
  }
}
const savedState = await readState();
if (savedState) {
  restoreState(savedState);
  lastSaved = JSON.stringify(snapshot());
  console.log(`Nạp lại trạng thái lúc ${new Date(savedState.at || Date.now()).toLocaleString('vi-VN')}: ${wallets.size} ví`);
}
server.listen(PORT, () => console.log(`🍻 Bơi Hia Dứt Cạn đang mở cửa: http://localhost:${PORT} · ${[...rooms.keys()].join(', ')}${DEV ? '  (dev: sửa file là tự cập nhật)' : ''}`));
