// Server Bơi Hia Dứt Cạn: phục vụ file tĩnh + WebSocket realtime cho từng quán.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  ROOMS, CAPACITY, TABLES, MENU, ACTS, SHIRTS, HAIRS, FLOOR_BOUNDS, STAGE,
  SONG_MS, MAX_SONG_MS, MIC_DELAY_MS, ROUND_COOLDOWN_MS, MAX_DISHES, CHAT_MAX, seatPos, nearestFreeSeat, tabTotal,
} from '../shared/world.js';
import { SONGS, parseYouTube } from '../shared/songs.js';

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
    "connect-src 'self' ws: wss:",
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
}]));
let nextId = 1;
function newTab() { return { items: [], pours: 0, paidBy: null, paidName: null }; }
const tabMsg = (room, table) => ({ t: 'tab', table, ...room.tabs[table], total: tabTotal(TABLES[table], room.tabs[table]) });
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
  return String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) || 'Khách';
}
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
  const p = {
    id: String(nextId++), ws, name: cleanName(m.name), look: cleanLook(m.look),
    x: Math.random() * 2 - 1, z: 2.6, f: 0, yaw: Math.PI, d: 0, seat: null, lastRound: 0, chatTokens: 3, chatLast: Date.now(), cd: {},
  };
  room.players.set(p.id, p);
  send(ws, {
    t: 'welcome', id: p.id, now: Date.now(), room: room.id,
    players: [...room.players.values()].filter((o) => o !== p).map(pub),
    dishes: room.dishes, mic: micState(room), features: { ytSearch: !!YOUTUBE_API_KEY },
    rooms: [...room.privateRooms.keys()].map((table) => roomMsg(room, table)),
    tabs: room.tabs.map((_, table) => tabMsg(room, table)),
  });
  for (const o of room.players.values()) if (o !== p) send(o.ws, { t: 'join', player: pub(p) });
  return p;
}

function leave(room, p) {
  stand(room, p);
  room.players.delete(p.id);
  room.dirty.delete(p.id);
  removeFromMic(room, p.id);
  broadcast(room, { t: 'leave', id: p.id });
}

function sit(room, p, m) {
  const T = TABLES[m.table];
  if (!T || p.seat || room.mic.singer === p.id) return;
  const priv = room.privateRooms.get(T.id);
  if (priv?.locked && priv.owner !== p.id) { send(p.ws, { t: 'sit-fail', table: T.id, locked: true }); return; }
  const idx = nearestFreeSeat(T, (i) => room.seats.has(`${T.id}:${i}`), p.x, p.z);
  if (idx < 0) { send(p.ws, { t: 'sit-fail', table: T.id }); return; }
  room.seats.set(`${T.id}:${idx}`, p.id);
  p.seat = { table: T.id, idx };
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
  broadcast(room, { t: 'stand', id: p.id });
  // Chủ phòng đứng dậy thì nhường cho người còn ngồi, hết người thì phòng trống và mở khoá.
  const priv = room.privateRooms.get(table);
  if (priv?.owner === p.id) {
    const next = [...room.seats].find(([k]) => k.startsWith(table + ':'));
    if (next) priv.owner = next[1];
    else room.privateRooms.delete(table);
    broadcast(room, roomMsg(room, table));
  }
  // Bàn trống thì dọn mồi và xoá hoá đơn.
  if (![...room.seats.keys()].some((k) => k.startsWith(table + ':'))) {
    if (room.dishes[table].length) {
      room.dishes[table] = [];
      broadcast(room, { t: 'dishes', table, items: [] });
    }
    // Không còn ai ngồi để báo; người ngồi sau nhận hoá đơn mới khi ngồi.
    room.tabs[table] = newTab();
  }
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
  mic.startAt = Date.now() + MIC_DELAY_MS;
  // Với video, người hát báo xong bài (mic-leave); đây chỉ là giới hạn trên.
  mic.endsAt = mic.startAt + (mic.track.yt ? MAX_SONG_MS : SONG_MS);
  mic.song = Math.floor(Math.random() * 1000);
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
      const to = typeof m.to === 'string' && room.players.has(m.to) ? m.to : undefined;
      broadcast(room, { t: 'act', id: p.id, k: m.k, to });
      if (m.k === 'pour' && p.seat) {
        openTab(room, p.seat.table).pours++;
        toTable(room, p.seat.table, tabMsg(room, p.seat.table));
      }
      break;
    }
    case 'order': {
      if (!Number.isInteger(m.item) || !MENU[m.item] || !p.seat || !cooldown(p, 'order', 500)) return;
      const list = room.dishes[p.seat.table];
      list.push(m.item);
      if (list.length > MAX_DISHES) list.shift();
      broadcast(room, { t: 'dish', table: p.seat.table, item: m.item, by: p.id });
      const tab = openTab(room, p.seat.table);
      if (tab.items.length < 200) tab.items.push(m.item);
      toTable(room, p.seat.table, tabMsg(room, p.seat.table));
      break;
    }
    case 'pay': {
      // Chỉ người đang ngồi bàn, bàn đã gọi món, và chưa ai trả mới thanh toán được.
      if (!p.seat || !cooldown(p, 'pay', 1000)) return;
      const table = p.seat.table, tab = room.tabs[table];
      if (tab.paidBy) { send(p.ws, { t: 'notice', msg: `Bàn này ${tab.paidName} đã thanh toán rồi 💸` }); return; }
      if (!tab.items.length) { send(p.ws, { t: 'notice', msg: 'Bàn chưa gọi món nào, gọi món trước rồi mới tính tiền nhé!' }); return; }
      tab.paidBy = p.id;
      tab.paidName = p.name;
      toTable(room, table, { t: 'paid', table, by: p.id, name: p.name, total: tabTotal(TABLES[table], tab) });
      toTable(room, table, tabMsg(room, table));
      break;
    }
    case 'round': {
      if (Date.now() - p.lastRound < ROUND_COOLDOWN_MS) {
        send(p.ws, { t: 'notice', msg: 'Vừa bao xong mà, đợi chút nữa nhé!' });
        return;
      }
      p.lastRound = Date.now();
      broadcast(room, { t: 'round', id: p.id, name: p.name });
      break;
    }
    case 'mic-join':
      // Mỗi lần mic-join có thể gọi ra YouTube, giới hạn để server không bị dùng làm nguồn spam request.
      if (!cooldown(p, 'mic', 3000)) { send(p.ws, { t: 'notice', msg: 'Đợi chút rồi chọn bài lại nhé' }); return; }
      joinMic(room, p, m).catch((e) => console.error('joinMic', e));
      break;
    case 'mic-leave':
      if (cooldown(p, 'mic-leave', 500)) removeFromMic(room, p.id);
      break;
    case 'room-lock':
      if (cooldown(p, 'lock', 500)) setRoomLock(room, p, m.locked);
      break;
    case 'chat': {
      // Chỉ người đang ngồi mới chat, và chỉ người cùng bàn nhận được.
      if (!p.seat || typeof m.text !== 'string') return;
      const text = m.text.slice(0, 500).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
      if (!text) return;
      const now = Date.now();
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

async function joinMic(room, p, m) {
  const mic = room.mic;
  if (mic.singer === p.id || mic.queue.some((q) => q.id === p.id) || p.micPending) return;
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
  if (room.players.get(p.id) !== p || mic.singer === p.id || mic.queue.some((q) => q.id === p.id)) return;
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
    if (p) leave(room, p);
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
server.listen(PORT, () => console.log(`🍻 Bơi Hia Dứt Cạn đang mở cửa: http://localhost:${PORT} · ${[...rooms.keys()].join(', ')}${DEV ? '  (dev: sửa file là tự cập nhật)' : ''}`));
