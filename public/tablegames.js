// Trò chơi cùng bàn, phía trình duyệt: hộp chọn trò, bảng trò chơi gọn ở dưới màn hình, và cảnh 3D trên bàn
// (chai xoay, bát xóc, bốc thăm). Kết quả do server quyết định (server/games.js); ở đây chỉ hiển thị.
import { GAMES, GAME_KINDS, BETS, RPS, SPIN_MS } from '/shared/games.js';

// ctx: { THREE, $, send, toast, speak, openModal, closeModal, modal(), fmt, escapeHtml, actorById, me(), myId(),
//        TABLES, seatPos, floors, serverNow, online(), penaltyDrink() }
export function createTableGames(ctx) {
  const { THREE, $ } = ctx;
  let game = null; // tin 'game' mới nhất của bàn mình
  let pickKind = 'chai', pickBet = 0;
  let hidden = false; // người chơi bấm Ẩn bảng
  let spin = null; // { obj, from, to, t0, dur }
  let anim = null; // hiệu ứng đang chạy trên bàn (bát xóc / bốc thăm)
  let penaltyDone = 0, shownResult = 0;

  // ---------- Hộp chọn trò (mở bằng nút 🎲) ----------
  function openPicker() {
    if (!ctx.me()?.seat) return ctx.toast('Ngồi vào bàn rồi mới rủ cả bàn chơi được nhé!');
    if (!ctx.online()) return ctx.toast('Cần kết nối với quán mới chơi trò được');
    if (game && game.phase !== 'result' && game.phase !== 'cancel') { hidden = false; render(); return ctx.toast('🎲 Bàn đang chơi rồi, xem bảng dưới màn hình nhé'); }
    renderPicker();
    ctx.openModal('games');
  }
  function renderPicker() {
    const list = $('games-list');
    list.innerHTML = '';
    for (const k of GAME_KINDS) {
      const g = GAMES[k], b = document.createElement('button');
      b.className = 'game-card' + (k === pickKind ? ' on' : '');
      b.innerHTML = `<span class="ico">${g.icon}</span><span><b>${g.name}</b><small>${g.rule}</small></span>`;
      b.onclick = () => { pickKind = k; renderPicker(); };
      list.appendChild(b);
    }
    const bets = $('games-bets');
    bets.innerHTML = '';
    const canBet = GAMES[pickKind].bet;
    for (const v of BETS) {
      const b = document.createElement('button');
      b.textContent = v ? `${v / 1000}k` : 'Không cược';
      b.className = v === pickBet && canBet ? 'on' : '';
      b.disabled = !canBet && v > 0;
      b.onclick = () => { pickBet = v; renderPicker(); };
      bets.appendChild(b);
    }
    if (!canBet) bets.querySelector('button').classList.add('on');
    $('games-bet-row').classList.toggle('dim', !canBet);
  }
  $('btn-games-go').onclick = () => {
    ctx.send({ t: 'game-start', kind: pickKind, bet: GAMES[pickKind].bet ? pickBet : 0 });
    ctx.closeModal();
    hidden = false;
  };
  $('btn-games-close').onclick = () => ctx.closeModal();

  // ---------- Bảng trò chơi dưới màn hình ----------
  const panel = $('game-panel');
  $('btn-game-hide').onclick = () => { hidden = true; render(); };
  const mine = () => game?.players.find((x) => x.id === ctx.myId());
  const nameOf = (id) => game?.players.find((x) => x.id === id)?.name || ctx.actorById(id)?.name || '…';
  const STATUS = { pending: '⏳', in: '✅', out: '—', left: '🚶' };

  function render() {
    const g = game;
    panel.classList.toggle('hidden', !g || hidden || !ctx.me()?.seat || ctx.me().seat.table !== g.table);
    if (!g || panel.classList.contains('hidden')) return;
    const def = GAMES[g.kind], me = mine();
    $('game-title').textContent = `${def.icon} ${def.name}${g.kind !== 'bill' && g.phase !== 'lobby' ? ` · ván ${g.set}` : ''}${g.bet ? ` · cược ${g.bet / 1000}k` : ''}${g.pot ? ` · pot ${ctx.fmt(g.pot)}` : ''}`;
    $('game-players').innerHTML = g.players.map((x) => {
      const res = g.phase === 'result' ? (g.losers.includes(x.id) ? ' lose' : g.winners.includes(x.id) ? ' win' : '') : '';
      const pay = g.phase === 'result' && g.payouts?.[x.id] ? ` <small>+${ctx.fmt(g.payouts[x.id])}</small>` : '';
      const ans = g.phase === 'play' && g.answered?.includes(x.id) ? ' ✔️' : '';
      const stopTag = x.stop ? ' <small class="why">(nghỉ ván sau)</small>' : '';
      const why = x.why ? ` <small class="why">(${ctx.escapeHtml(x.why)})</small>` : '';
      return `<span class="gp${res}">${STATUS[x.status] || ''} ${ctx.escapeHtml(x.name)}${ans}${pay}${why}${stopTag}</span>`;
    }).join('');
    const act = $('game-actions');
    act.innerHTML = '';
    const btn = (text, fn, cls = '') => {
      const b = document.createElement('button');
      b.textContent = text;
      b.className = cls;
      b.onclick = fn;
      act.appendChild(b);
    };
    let status = '';
    if (g.phase === 'lobby') {
      status = `${ctx.escapeHtml(g.hostName)} rủ cả bàn chơi. ${def.rule}`;
      if (me?.status === 'pending') {
        btn(g.kind === 'bill' ? '🧾 Chơi' : g.bet ? `🎲 Chơi (cược ${g.bet / 1000}k)` : '🎲 Chơi', () => ctx.send({ t: 'game-join', ok: true }), 'go');
        btn('Thôi', () => ctx.send({ t: 'game-join', ok: false }), 'ghost');
      } else if (me?.status === 'in') status = 'Đã vào chơi, chờ mọi người nhận lời…';
    } else if (g.phase === 'play') {
      if (g.kind === 'chai') status = '🍾 Chai đang xoay…';
      else if (g.kind === 'xingau') status = '🎲 Đang xóc bát…';
      else if (g.kind === 'bill') status = '🧾 Đang bốc thăm người chịu bill…';
      else if (g.kind === 'ott') {
        status = `Lượt ${g.round}: ra Kéo / Búa / Bao!${g.last ? ` (lượt trước hoà: ${Object.values(g.last).map((m) => RPS[m]?.icon || '🙈').join(' ')})` : ''}`;
        if (me?.status === 'in' && !g.answered?.includes(me.id)) for (const [k, r] of Object.entries(RPS)) btn(`${r.icon} ${r.name}`, () => ctx.send({ t: 'game-move', move: k }), 'go');
      } else if (g.kind === 'dovui') {
        status = `❓ ${ctx.escapeHtml(g.q)}`;
        if (me?.status === 'in' && !g.answered?.includes(me.id)) g.a.forEach((a, i) => btn(`${'ABC'[i]}. ${a}`, () => ctx.send({ t: 'game-move', move: i }), 'go'));
        else if (me?.status === 'in') status += ' — đã chọn, chờ mọi người…';
      }
    } else if (g.phase === 'result') {
      status = resultText(g) + (g.kind !== 'bill' ? '<br><small>Ván mới tự bắt đầu sau vài giây…</small>' : '');
    }
    // Chơi liên tục tới khi tự bấm dừng
    if (g.kind !== 'bill' && g.phase !== 'lobby' && me?.status === 'in') {
      if (me.stop) btn('⏸ Nghỉ sau ván này', () => {}, 'ghost');
      else btn('⏹ Dừng chơi', () => ctx.send({ t: 'game-stop' }), 'ghost stop');
    }
    $('game-status').innerHTML = status;
    act.classList.toggle('quiz', g.kind === 'dovui' && g.phase === 'play');
  }
  function resultText(g) {
    const L = g.losers.map(nameOf).map(ctx.escapeHtml).join(', ');
    switch (g.kind) {
      case 'chai': return `🍾 Chai chỉ vào <b>${L}</b>: uống cạn! Thử thách: <i>${ctx.escapeHtml(g.dare)}</i>`;
      case 'xingau': {
        const pts = Object.entries(g.rolls).map(([id, r]) => `${ctx.escapeHtml(nameOf(id))} ${r.join('·')}=${r.reduce((a, b) => a + b, 0)}`).join(' | ');
        return g.tie ? `🎲 Bằng điểm hết, cả bàn cùng dzô! (${pts})` : `🎲 ${pts}<br>Thấp nhất <b>${L}</b> uống!`;
      }
      case 'ott': {
        const show = Object.entries(g.reveal || {}).map(([id, m]) => `${ctx.escapeHtml(nameOf(id))} ${RPS[m]?.icon || '🙈'}`).join(' · ');
        return g.tie ? `✊ Hoà mãi, cả bàn cùng dzô! (${show})` : `✊ ${show}<br>Thua: <b>${L}</b> uống!`;
      }
      case 'dovui': return `❓ Đáp án: <b>${'ABC'[g.answer]}. ${ctx.escapeHtml(g.a[g.answer])}</b>${L ? `<br>Sai hoặc không trả lời: <b>${L}</b> uống!` : '<br>Cả bàn đều đúng! 🎉'}`;
      case 'bill': return g.paid ? `🧾 <b>${L}</b> bốc trúng, trả cả hoá đơn ${ctx.fmt(g.total)}!` : `🧾 <b>${L}</b> bốc trúng nhưng chưa trả được hoá đơn.`;
    }
    return '';
  }
  // Thanh thời gian còn lại
  function tickTimer() {
    const bar = $('game-timer');
    if (!game || !game.endsAt || game.phase === 'cancel') { bar.style.width = '0'; return; }
    const total = game.phase === 'lobby' ? 15000 : game.phase === 'result' ? 6000 : Math.max(1, game.endsAt - (game.t0 || game.endsAt - 8000));
    bar.style.width = `${Math.max(0, Math.min(1, (game.endsAt - ctx.serverNow()) / total)) * 100}%`;
  }

  // ---------- Cảnh 3D trên bàn ----------
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d6b35, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 });
  const bottle = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 14), glass);
    body.rotation.z = Math.PI / 2;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 0.1, 12), glass);
    neck.rotation.z = -Math.PI / 2;
    neck.position.x = 0.15;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0xffcc33 }));
    label.rotation.z = Math.PI / 2;
    bottle.add(body, neck, label);
  }
  const bowl = new THREE.Group();
  {
    const m = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 20), m);
    plate.position.y = -0.005;
    bowl.add(cup, plate);
  }
  function place(obj, T) {
    obj.position.set(T.x, 0.62, T.z);
    ctx.floors[T.floor].add(obj);
  }
  function clear3d() {
    bottle.removeFromParent();
    bowl.removeFromParent();
    spin = anim = null;
  }
  const ease = (k) => 1 - Math.pow(1 - k, 3);

  function onGame(m) {
    const prev = game;
    if (m.phase === 'cancel') {
      ctx.toast(m.ended ? `🎲 ${m.reason}` : `🎲 Huỷ trò chơi: ${m.reason}`);
      game = null;
      clear3d();
      render();
      return;
    }
    game = { ...m, t0: prev?.id === m.id && prev.phase === m.phase && prev.round === m.round ? prev.t0 : ctx.serverNow() };
    if (prev?.id !== m.id) hidden = false;
    const T = ctx.TABLES[m.table];
    if (m.phase === 'lobby' && prev?.id !== m.id && m.host !== ctx.myId()) ctx.toast(`🎲 ${m.hostName} rủ cả bàn chơi ${GAMES[m.kind].name}!`);
    if (m.phase === 'play' && prev?.phase !== 'play') startPlayAnim(m, T);
    if (m.phase === 'result' && shownResult !== m.id) {
      shownResult = m.id;
      showResult(m, T);
    }
    render();
    if (m.phase === 'result') setTimeout(() => { if (game?.id === m.id) { game = null; clear3d(); render(); } }, 8000); // không có ván sau thì dọn
  }

  function startPlayAnim(m, T) {
    clear3d();
    if (m.kind === 'chai') {
      place(bottle, T);
      const s = ctx.seatPos(T, m.seat), to = Math.atan2(-(s.z - T.z), s.x - T.x);
      const from = bottle.rotation.y;
      spin = { from, to: to + Math.PI * 2 * (m.turns + Math.ceil((from - to) / (Math.PI * 2))), t0: performance.now(), dur: SPIN_MS - 300 };
    } else if (m.kind === 'xingau') {
      place(bowl, T);
      anim = { kind: 'shake', t0: performance.now() };
    } else if (m.kind === 'bill') {
      anim = { kind: 'draw', t0: performance.now(), i: 0, ids: m.players.filter((x) => x.status === 'in').map((x) => x.id), next: 0 };
    }
  }
  function showResult(m, T) {
    for (const id of m.losers) {
      const a = ctx.actorById(id);
      if (!a) continue;
      if (m.kind === 'bill') ctx.speak(a, '🧾 Chịu bill!', 4000);
      else ctx.speak(a, m.kind === 'chai' ? '🍾 Trúng rồi! Uống!' : '😵 Phạt 1 ly!', 3500);
    }
    for (const id of m.winners) { const a = ctx.actorById(id); if (a) ctx.speak(a, m.payouts?.[id] ? `🤑 +${m.payouts[id] / 1000}k` : '😎 Thoát!', 3000); }
    if (m.kind === 'xingau') {
      for (const [id, r] of Object.entries(m.rolls)) { const a = ctx.actorById(id); if (a && !m.losers.includes(id) && !m.winners.includes(id)) ctx.speak(a, `🎲 ${r.join('·')}`, 3000); }
      bowl.removeFromParent();
    }
    if (m.kind === 'ott') for (const [id, mv] of Object.entries(m.reveal || {})) { const a = ctx.actorById(id); if (a && !m.losers.includes(id) && !m.winners.includes(id)) ctx.speak(a, RPS[mv]?.icon || '🙈', 3000); }
    // Mình thua: uống phạt (server đã tính ly này vào hoá đơn)
    if (m.penalty && m.losers.includes(ctx.myId()) && penaltyDone !== m.id) {
      penaltyDone = m.id;
      setTimeout(() => ctx.penaltyDrink(), 900);
    }
  }

  function update() {
    tickTimer();
    if (spin) {
      const k = Math.min(1, (performance.now() - spin.t0) / spin.dur);
      bottle.rotation.y = spin.from + (spin.to - spin.from) * ease(k);
      if (k >= 1) spin = null;
    }
    if (anim?.kind === 'shake') {
      const t = (performance.now() - anim.t0) / 1000;
      const T = ctx.TABLES[game?.table ?? 0];
      bowl.position.x = T.x + Math.sin(t * 40) * 0.03;
      bowl.position.y = 0.62 + Math.abs(Math.sin(t * 20)) * 0.04;
      bowl.rotation.z = Math.sin(t * 33) * 0.15;
    }
    if (anim?.kind === 'draw' && anim.ids.length) {
      // Bóng 🧾 chạy vòng quanh bàn, chậm dần rồi dừng ở người bị bốc (server báo ở kết quả)
      const t = performance.now() - anim.t0;
      if (t >= anim.next && t < SPIN_MS - 200) {
        const a = ctx.actorById(anim.ids[anim.i++ % anim.ids.length]);
        if (a) ctx.speak(a, '🧾 ?', 260);
        anim.next = t + 120 + (t / SPIN_MS) * 380;
      }
    }
  }
  setInterval(() => { if (game && game.phase !== 'result') render(); }, 1000); // cập nhật lại khi người chơi đứng dậy / đổi bàn

  // Rời bàn thì ẩn bảng, dọn cảnh
  function onSeatChanged() {
    if (game && ctx.me()?.seat?.table !== game.table) { game = null; clear3d(); }
    render();
  }

  // Bàn cần góc nhìn công bằng (camera nhìn từ trên xuống cả bàn): lúc quay chai, xóc bát, bốc thăm,
  // và lúc lộ kết quả. Đố vui đang đọc câu hỏi thì giữ góc của người chơi.
  function fairView() {
    if (!game || hidden || ctx.me()?.seat?.table !== game.table) return null;
    if (game.phase === 'result') return game.table;
    if (game.phase === 'play' && game.kind !== 'dovui') return game.table;
    return null;
  }

  return { openPicker, onGame, update, onSeatChanged, fairView, get active() { return !!game; } };
}
