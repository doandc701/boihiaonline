// Trò chơi cùng bàn (xem shared/games.js): mỗi bàn tối đa một trò. Server quyết định mọi kết quả ngẫu nhiên
// rồi gửi cho cả bàn qua toTable, giữ tiền cược trong "pot" và trả cho người thắng / hoàn khi huỷ.
import {
  GAMES, BETS, MIN_PLAYERS, LOBBY_MS, RPS_MS, RPS_ROUNDS, QUIZ_MS, SPIN_MS, RESULT_MS, QUIZ, DARES, rpsResult,
} from '../shared/games.js';

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const roll = () => 1 + Math.floor(Math.random() * 6);

// h: { toTable, send, spend, payBill, billOf, penalize, fmtMoney }
export function createGames(h) {
  let nextId = 1;
  const games = new Map(); // `${room.id}:${table}` -> game
  const keyOf = (room, table) => `${room.id}:${table}`;

  const joined = (g) => [...g.players.values()].filter((x) => x.status === 'in');
  const view = (g) => ({
    t: 'game', id: g.id, kind: g.kind, table: g.table, phase: g.phase, host: g.host, hostName: g.hostName, bet: g.bet,
    pot: g.pot, endsAt: g.endsAt,
    set: g.set, players: [...g.players.values()].map(({ p, status, why, stop }) => ({ id: p.id, name: p.name, status, why, stop: !!stop })),
    ...g.pub,
  });
  const emit = (g) => h.toTable(g.room, g.table, view(g));
  const later = (g, ms, fn) => { clearTimeout(g.timer); g.timer = setTimeout(fn, ms); };

  function finish(g) {
    clearTimeout(g.timer);
    games.delete(keyOf(g.room, g.table));
  }
  // Huỷ: hoàn tiền cược cho mọi người đã giữ.
  function cancel(g, reason, ended = false) {
    for (const x of g.players.values()) if (x.paid) h.spend(x.p, -x.paid);
    g.phase = 'cancel';
    g.pub = { reason, ended };
    emit(g);
    finish(g);
  }
  // Kết quả: chia pot cho người thắng (không ai thắng thì hoàn), người thua bị phạt uống (penalty).
  function result(g, { winners = [], losers = [], penalty = true, ...extra }) {
    const payouts = {};
    if (g.pot) {
      if (winners.length) {
        const share = Math.floor(g.pot / winners.length);
        winners.forEach((x, i) => (payouts[x.p.id] = share + (i === 0 ? g.pot - share * winners.length : 0)));
      } else for (const x of g.players.values()) if (x.paid) payouts[x.p.id] = (payouts[x.p.id] || 0) + x.paid;
      for (const [id, amt] of Object.entries(payouts)) h.spend(g.players.get(id).p, -amt);
    }
    if (penalty) for (const x of losers) if (x.status === 'in') h.penalize(g.room, x.p);
    g.phase = 'result';
    g.endsAt = Date.now() + RESULT_MS;
    g.pub = { ...g.pub, ...extra, winners: winners.map((x) => x.p.id), losers: losers.map((x) => x.p.id), penalty, payouts };
    emit(g);
    later(g, RESULT_MS, () => nextRound(g));
  }

  // ---------- Chơi liên tục: hết ván tự sang ván mới với những người còn chơi ----------
  // Ai bấm "Dừng chơi" (x.stop) thì nghỉ từ ván sau; còn dưới 2 người thì kết thúc.
  function nextRound(g) {
    if (games.get(keyOf(g.room, g.table)) !== g) return;
    const ended = (reason) => { g.players = new Map(); g.pot = 0; cancel(g, reason, true); };
    if (g.kind === 'bill') return finish(g); // bốc thăm chịu bill chỉ một lần
    const keep = [];
    for (const x of g.players.values()) {
      if (x.status !== 'in' || x.stop || x.p.seat?.table !== g.table || g.room.players.get(x.p.id) !== x.p) continue;
      const why = canStake(x.p, g);
      if (why) { h.send(x.p.ws, { t: 'notice', msg: why.msg }); continue; }
      keep.push(x.p);
    }
    if (keep.length < MIN_PLAYERS) return ended(`Hết ${g.set} ván${keep.length ? ', không đủ người chơi tiếp' : ''}. Cảm ơn cả bàn!`);
    g.id = nextId++;
    g.set++;
    g.pot = 0;
    g.pub = {};
    g.round = 0;
    g.moves = null;
    g.players = new Map(keep.map((p) => [p.id, { p, status: 'in', paid: 0 }]));
    if (g.bet) for (const x of g.players.values()) { h.spend(x.p, g.bet); x.paid = g.bet; g.pot += g.bet; }
    play(g);
  }
  function stop(room, p) {
    const g = p.seat && games.get(keyOf(room, p.seat.table));
    const x = g?.players.get(p.id);
    if (!x) return;
    if (g.phase === 'lobby') return setStatus(g, p, false);
    x.stop = true;
    h.send(p.ws, { t: 'notice', msg: '🎲 Bạn sẽ nghỉ sau ván này' });
    emit(g);
  }

  // ---------- Bắt đầu chơi sau khi nhận lời ----------
  function play(g) {
    const ins = joined(g);
    if (ins.length < MIN_PLAYERS) {
      // Nói rõ vì sao: ai không nhận lời, ai không vào được (nợ quán, ví không đủ cược…)
      const outs = [...g.players.values()].filter((x) => x.status !== 'in');
      const detail = outs.map((x) => `${x.p.name} ${x.why || (x.status === 'out' ? 'không chơi' : 'không trả lời')}`).join('; ');
      return cancel(g, `Cần ít nhất ${MIN_PLAYERS} người nhận lời, mới có ${ins.length}${detail ? ` (${detail})` : ''}`);
    }
    g.phase = 'play';
    const tail = (fn) => later(g, SPIN_MS, fn);
    switch (g.kind) {
      case 'chai': {
        const target = pickOne(ins);
        g.pub = { target: target.p.id, seat: target.p.seat?.idx ?? 0, turns: 3 + Math.floor(Math.random() * 3) };
        g.endsAt = Date.now() + SPIN_MS;
        emit(g);
        tail(() => result(g, { losers: [target], winners: ins.filter((x) => x !== target), dare: pickOne(DARES) }));
        break;
      }
      case 'xingau': {
        const rolls = Object.fromEntries(ins.map((x) => [x.p.id, [roll(), roll(), roll()]]));
        const sum = (id) => rolls[id].reduce((a, b) => a + b, 0);
        g.pub = {};
        g.endsAt = Date.now() + SPIN_MS;
        emit(g); // bát xóc rung, chưa lộ điểm
        tail(() => {
          const scores = ins.map((x) => sum(x.p.id)), lo = Math.min(...scores), hi = Math.max(...scores);
          if (lo === hi) return result(g, { winners: [], losers: ins, rolls, tie: true }); // ai cũng bằng điểm: cả bàn cùng uống
          result(g, { winners: ins.filter((x) => sum(x.p.id) === hi), losers: ins.filter((x) => sum(x.p.id) === lo), rolls });
        });
        break;
      }
      case 'bill': {
        const target = pickOne(ins);
        g.pub = { target: target.p.id };
        g.endsAt = Date.now() + SPIN_MS;
        emit(g);
        tail(() => {
          const total = h.billOf(g.room, g.table);
          const ok = total > 0 && target.p.seat?.table === g.table && h.payBill(g.room, target.p, g.table);
          result(g, { losers: [target], winners: [], penalty: false, total, paid: !!ok });
        });
        break;
      }
      case 'ott':
        g.round = 0;
        g.alive = ins;
        rpsRound(g);
        break;
      case 'dovui': {
        const q = pickOne(QUIZ), order = [0, 1, 2].sort(() => Math.random() - 0.5);
        g.answer = order.indexOf(q.c);
        g.moves = Object.fromEntries(ins.map((x) => [x.p.id, null]));
        g.pub = { q: q.q, a: order.map((i) => q.a[i]), answered: [] };
        g.endsAt = Date.now() + QUIZ_MS;
        emit(g);
        later(g, QUIZ_MS, () => quizResolve(g));
        break;
      }
    }
  }

  function rpsRound(g) {
    g.round++;
    g.moves = Object.fromEntries(g.alive.map((x) => [x.p.id, null]));
    g.pub = { round: g.round, answered: [], last: g.pub?.reveal || null };
    g.endsAt = Date.now() + RPS_MS;
    emit(g);
    later(g, RPS_MS, () => rpsResolve(g));
  }
  function rpsResolve(g) {
    const moves = Object.fromEntries(g.alive.filter((x) => g.players.get(x.p.id)?.status === 'in').map((x) => [x.p.id, g.moves[x.p.id]]));
    const r = rpsResult(moves);
    const reveal = moves;
    if (!r) {
      if (g.round >= RPS_ROUNDS) return result(g, { winners: [], losers: g.alive, reveal, tie: true }); // hoà mãi: cả bàn cùng uống
      g.pub = { ...g.pub, reveal };
      return rpsRound(g);
    }
    const byId = (id) => g.players.get(id);
    result(g, { winners: r.winners.map(byId), losers: r.losers.map(byId), reveal });
  }
  function quizResolve(g) {
    const ins = joined(g);
    const right = ins.filter((x) => g.moves[x.p.id] === g.answer);
    result(g, { winners: right, losers: ins.filter((x) => !right.includes(x)), answer: g.answer, picks: g.moves });
  }

  // Người chơi chọn (oẳn tù tì / đáp án); đủ người chọn thì xử lý luôn không chờ hết giờ.
  function move(room, p, m) {
    const g = p.seat && games.get(keyOf(room, p.seat.table));
    if (!g || g.phase !== 'play' || g.players.get(p.id)?.status !== 'in' || !(p.id in (g.moves || {}))) return;
    if (g.moves[p.id] !== null && g.moves[p.id] !== undefined) return; // đã chọn rồi
    if (g.kind === 'ott' && ['keo', 'bua', 'bao'].includes(m.move)) g.moves[p.id] = m.move;
    else if (g.kind === 'dovui' && [0, 1, 2].includes(m.move)) g.moves[p.id] = m.move;
    else return;
    g.pub.answered = Object.keys(g.moves).filter((id) => g.moves[id] !== null);
    const live = joined(g).map((x) => x.p.id).filter((id) => id in g.moves);
    if (live.every((id) => g.moves[id] !== null)) return g.kind === 'ott' ? rpsResolve(g) : quizResolve(g);
    emit(g);
  }

  // ---------- Mời / nhận lời ----------
  // Ai không vào được trò: trả về { msg (báo riêng người đó), short (hiện cho cả bàn) }.
  // Trò không cược thì ai cũng chơi được, kể cả đang nợ hay hết tiền (thua chỉ phải uống).
  function canStake(p, g) {
    if (g.kind === 'bill') {
      if (p.wallet.debt > 0) return { msg: '📒 Bạn đang nợ quán, trả nợ rồi mới bốc thăm chịu bill được', short: 'đang nợ quán' };
      const total = h.billOf(g.room, g.table);
      if (p.wallet.money < total) return { msg: `💸 Ví còn ${h.fmtMoney(p.wallet.money)}, không đủ trả cả hoá đơn ${h.fmtMoney(total)}`, short: 'ví không đủ trả bill' };
    } else if (g.bet) {
      if (p.wallet.debt > 0) return { msg: '📒 Bạn đang nợ quán, trả nợ rồi mới chơi có cược được', short: 'đang nợ quán' };
      if (p.wallet.money < g.bet) return { msg: `💸 Ví không đủ ${h.fmtMoney(g.bet)} để cược`, short: 'ví không đủ tiền cược' };
    }
    return null;
  }
  function setStatus(g, p, ok) {
    const x = g.players.get(p.id);
    if (!x || x.status !== 'pending') return;
    if (ok) {
      const why = canStake(p, g);
      if (why) { h.send(p.ws, { t: 'notice', msg: why.msg }); x.status = 'out'; x.why = why.short; }
      else {
        x.status = 'in';
        if (g.bet) { h.spend(p, g.bet); x.paid = g.bet; g.pot += g.bet; }
      }
    } else x.status = 'out';
    if ([...g.players.values()].every((y) => y.status !== 'pending')) return play(g);
    emit(g);
  }

  function start(room, p, m, seated) {
    if (!p.seat) return h.send(p.ws, { t: 'notice', msg: 'Ngồi vào bàn rồi mới rủ cả bàn chơi được nhé!' });
    const table = p.seat.table, kind = m.kind;
    if (!GAMES[kind]) return;
    if (games.has(keyOf(room, table))) return h.send(p.ws, { t: 'notice', msg: '🎲 Bàn đang chơi một trò rồi, chờ xong nhé!' });
    const others = seated.filter((o) => o !== p);
    if (!others.length) return h.send(p.ws, { t: 'notice', msg: '🎲 Bàn mới có mình bạn, rủ thêm người ngồi cùng đã!' });
    if (kind === 'bill' && !(h.billOf(room, table) > 0)) return h.send(p.ws, { t: 'notice', msg: '🧾 Bàn chưa có hoá đơn để bốc thăm, gọi món đã!' });
    const bet = GAMES[kind].bet && BETS.includes(m.bet) ? m.bet : 0;
    const g = {
      id: nextId++, set: 1, room, table, kind, bet, pot: 0, phase: 'lobby', host: p.id, hostName: p.name, pub: {},
      players: new Map(seated.map((o) => [o.id, { p: o, status: 'pending', paid: 0 }])), endsAt: Date.now() + LOBBY_MS,
    };
    const why = canStake(p, g);
    if (why) return h.send(p.ws, { t: 'notice', msg: why.msg });
    games.set(keyOf(room, table), g);
    later(g, LOBBY_MS, () => {
      for (const x of g.players.values()) if (x.status === 'pending') x.status = 'out';
      play(g);
    });
    setStatus(g, p, true); // chủ trò tự tham gia
  }
  function join(room, p, m) {
    const g = p.seat && games.get(keyOf(room, p.seat.table));
    if (g?.phase === 'lobby') setStatus(g, p, !!m.ok);
  }

  // Đứng dậy / rời quán: lúc đang mời thì hoàn cược; đang chơi thì mất cược (vẫn nằm trong pot).
  // Còn dưới 2 người thì huỷ, hoàn hết.
  function leaveTable(room, p, table) {
    const g = games.get(keyOf(room, table));
    const x = g?.players.get(p.id);
    if (!x || g.phase === 'result') return;
    if (g.phase === 'lobby') {
      if (x.paid) { h.spend(p, -x.paid); g.pot -= x.paid; x.paid = 0; }
      g.players.delete(p.id);
      if (!g.players.size || p.id === g.host && joined(g).length === 0) return cancel(g, 'Chủ trò đã rời bàn');
      if ([...g.players.values()].every((y) => y.status !== 'pending')) return play(g);
      return emit(g);
    }
    x.status = 'left';
    if (joined(g).length < MIN_PLAYERS) return cancel(g, `${p.name} đã rời bàn, không đủ người chơi`);
    if (g.moves && p.id in g.moves) {
      delete g.moves[p.id];
      const live = joined(g).map((y) => y.p.id).filter((id) => id in g.moves);
      if (live.every((id) => g.moves[id] !== null)) return g.kind === 'ott' ? rpsResolve(g) : quizResolve(g);
    }
    emit(g);
  }

  // Tắt server: hoàn mọi tiền cược đang giữ.
  function cancelAll() {
    for (const g of [...games.values()]) if (g.phase !== 'result') cancel(g, 'Quán tạm đóng cửa');
  }
  const current = (room, table) => games.get(keyOf(room, table));

  return { start, join, move, stop, leaveTable, cancelAll, view: (room, table) => { const g = current(room, table); return g && view(g); } };
}
