// Thoại qua LiveKit (server trung chuyển âm thanh): server game chỉ cấp vé (JWT) cho đúng kênh,
// âm thanh đi thẳng giữa trình duyệt và LiveKit. Thiếu một trong ba biến môi trường thì tắt thoại.
//   LIVEKIT_URL         wss://<project>.livekit.cloud
//   LIVEKIT_API_KEY     API key của project
//   LIVEKIT_API_SECRET  API secret của project
import crypto from 'node:crypto';

const URL = (process.env.LIVEKIT_URL || '').trim();
const KEY = (process.env.LIVEKIT_API_KEY || '').trim();
const SECRET = (process.env.LIVEKIT_API_SECRET || '').trim();

export const voiceEnabled = !!(URL && KEY && SECRET);
export const voiceUrl = URL;
// Trang cần được phép gọi tới LiveKit (wss cho âm thanh, https để LiveKit chọn vùng máy chủ gần nhất).
export const voiceCsp = voiceEnabled ? ` ${URL.replace(/^ws/, 'http')} ${URL}` : '';

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

// Tên phòng LiveKit cho từng kênh: cả cơ sở, hoặc riêng một bàn.
export const voiceRoom = (roomId, scope, table) => `boihia-${roomId}-${scope === 'table' ? `ban-${table}` : 'ca-quan'}`;

// Vé vào phòng thoại: nghe được, nói được, sống 2 tiếng. identity bắt đầu bằng id người chơi trong game
// để trình duyệt biết ai đang nói và hiện biểu tượng trên đầu đúng nhân vật.
export function voiceToken({ room, gameId, name, ttlSec = 2 * 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: KEY,
    sub: `${gameId}.${crypto.randomBytes(4).toString('hex')}`,
    name,
    nbf: now - 10,
    exp: now + ttlSec,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
  };
  const body = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}`;
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
