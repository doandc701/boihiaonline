// Thoại trong quán qua LiveKit. Mỗi lúc chỉ ở một kênh: cả cơ sở ('all') hoặc riêng bàn đang ngồi ('table').
// Thư viện LiveKit chỉ tải khi bật thoại lần đầu, nên ai không dùng thoại không tốn thêm gì.
const LK_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2.20.2/dist/livekit-client.esm.mjs';
let lkPromise = null;
const loadLK = () => (lkPromise ??= import(LK_URL));

// Tự ngắt để tiết kiệm phút miễn phí của LiveKit (tính theo thời gian ở trong kênh, kể cả chỉ nghe):
// chuyển tab / khoá máy quá HIDDEN_MS, hoặc cả kênh không ai nói quá IDLE_MS.
const HIDDEN_MS = 60 * 1000;
const IDLE_MS = 3 * 60 * 1000;

// hooks: onState({ scope, table, mic, connecting }), onSpeakers(Set<gameId>), onPeers(Map<gameId, name>),
// onError(msg), onAutoLeave(reason)
export function createVoice(hooks) {
  const v = {
    room: null, scope: null, table: null, mic: false, connecting: false, seq: 0, // seq: lần nối gần nhất
    blocked: new Set(), // id người chơi mình tắt tiếng
    audio: new Map(), // sid track -> { el, gameId }
    muteAll: false,
    lastTalk: 0, // lần gần nhất có người nói trong kênh
    hiddenTimer: 0,
  };
  // Hết thời gian thì ngắt và báo lý do để giao diện nhắc người chơi bấm 🎧 vào lại.
  const autoLeave = (reason) => { if (v.room) { leave(); hooks.onAutoLeave?.(reason); } };
  setInterval(() => {
    if (v.room && !v.connecting && Date.now() - v.lastTalk > IDLE_MS) autoLeave('idle');
  }, 30000);
  document.addEventListener('visibilitychange', () => {
    clearTimeout(v.hiddenTimer);
    if (document.hidden && v.room) v.hiddenTimer = setTimeout(() => autoLeave('hidden'), HIDDEN_MS);
  });
  const gameIdOf = (participant) => String(participant?.identity || '').split('.')[0];
  const emit = () => hooks.onState?.({ scope: v.scope, table: v.table, mic: v.mic, connecting: v.connecting });
  const peers = () => {
    const map = new Map();
    for (const p of v.room?.remoteParticipants.values() || []) map.set(gameIdOf(p), p.name || '');
    hooks.onPeers?.(map);
  };
  const applyMute = () => {
    for (const { el, gameId } of v.audio.values()) el.muted = v.muteAll || v.blocked.has(gameId);
  };

  async function join(scope, table, url, token) {
    await leave();
    const seq = ++v.seq;
    v.connecting = true;
    v.scope = scope;
    v.table = table;
    emit();
    try {
      const LK = await loadLK();
      if (seq !== v.seq) return; // đã bấm rời hoặc đổi kênh trong lúc tải
      const room = new LK.Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      v.room = room;
      room
        .on(LK.RoomEvent.TrackSubscribed, (track, pub, participant) => {
          if (track.kind !== 'audio') return;
          const el = track.attach();
          el.dataset.voice = '1';
          document.body.appendChild(el);
          v.audio.set(track.sid, { el, gameId: gameIdOf(participant) });
          applyMute();
        })
        .on(LK.RoomEvent.TrackUnsubscribed, (track) => {
          const a = v.audio.get(track.sid);
          if (a) { track.detach(a.el); a.el.remove(); v.audio.delete(track.sid); }
        })
        .on(LK.RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (speakers.length) v.lastTalk = Date.now();
          hooks.onSpeakers?.(new Set(speakers.map(gameIdOf)));
        })
        .on(LK.RoomEvent.ParticipantConnected, peers)
        .on(LK.RoomEvent.ParticipantDisconnected, peers)
        .on(LK.RoomEvent.Disconnected, () => {
          if (v.room !== room) return;
          cleanup();
          hooks.onError?.('Mất kết nối thoại');
        });
      await room.connect(url, token);
      if (seq !== v.seq) { room.disconnect(); return; } // đã rời trong lúc đang nối
      await room.startAudio().catch(() => {});
      v.connecting = false;
      v.lastTalk = Date.now(); // vừa vào thì tính từ lúc này
      peers();
      emit();
    } catch (e) {
      if (seq !== v.seq) return;
      cleanup();
      hooks.onError?.(`Không vào được kênh thoại (${e?.message || e})`);
    }
  }

  function cleanup() {
    for (const { el } of v.audio.values()) el.remove();
    v.audio.clear();
    v.room = null;
    v.scope = v.table = null;
    v.mic = v.connecting = false;
    hooks.onSpeakers?.(new Set());
    hooks.onPeers?.(new Map());
    emit();
  }

  async function leave() {
    const room = v.room;
    if (!room && !v.connecting) return;
    v.seq++;
    v.room = null;
    try { await room?.disconnect(); } catch {}
    cleanup();
  }

  // Bật/tắt mic của mình (trình duyệt hỏi quyền micro lần đầu).
  async function setMic(on) {
    if (!v.room || v.connecting) return false;
    try {
      await v.room.localParticipant.setMicrophoneEnabled(on);
      v.mic = on;
      v.lastTalk = Date.now();
    } catch (e) {
      v.mic = false;
      hooks.onError?.(e?.name === 'NotAllowedError' ? 'Trình duyệt chưa cho dùng micro. Bấm vào biểu tượng ổ khoá trên thanh địa chỉ để cho phép nhé.' : `Không bật được micro (${e?.message || e})`);
    }
    emit();
    return v.mic;
  }

  return {
    join, leave, setMic,
    get scope() { return v.scope; },
    get table() { return v.table; },
    get mic() { return v.mic; },
    get connecting() { return v.connecting; },
    // Tắt tiếng một người (chỉ ở máy mình)
    toggleBlock(gameId) {
      if (v.blocked.has(gameId)) v.blocked.delete(gameId); else v.blocked.add(gameId);
      applyMute();
      return v.blocked.has(gameId);
    },
    isBlocked: (gameId) => v.blocked.has(gameId),
    setMuteAll(on) { v.muteAll = on; applyMute(); },
  };
}
